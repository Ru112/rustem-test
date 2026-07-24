const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {Store} = require("./lib/store");
const {approvalMatrix, policyFor} = require("./lib/policy");

const PORT = Number(process.env.CONTROL_CENTER_PORT || 8787);
const ENV = process.env.CONTROL_CENTER_ENV || "staging";
const API_KEY = process.env.CONTROL_CENTER_API_KEY || (ENV === "test" ? "test-api-key-1234567890" : "");
const OWNER_KEY = process.env.CONTROL_CENTER_OWNER_KEY || (ENV === "test" ? "test-owner-key-1234567890" : "");
const ALLOWED_ORIGIN = process.env.CONTROL_CENTER_ALLOWED_ORIGIN || `http://127.0.0.1:${PORT}`;
const store = new Store({persistent: ENV !== "test" || process.env.CONTROL_CENTER_TEST_PERSIST === "true"});
const rateBuckets = new Map();

if (ENV !== "test" && (API_KEY.length < 24 || OWNER_KEY.length < 24 || API_KEY === OWNER_KEY)) {
  console.error("Set distinct CONTROL_CENTER_API_KEY and CONTROL_CENTER_OWNER_KEY values of at least 24 characters.");
  process.exit(1);
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extraHeaders});
  res.end(JSON.stringify(body));
}

function safeEqual(value, expected) {
  if (!value || !expected) return false;
  const a = Buffer.from(value); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}

function authenticate(req, owner = false) {
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expected = owner ? OWNER_KEY : API_KEY;
  if (!safeEqual(bearer, expected)) throw Object.assign(new Error("Authentication required"), {statusCode:401, code:"unauthorized"});
}

function rateLimit(req) {
  const key = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key) || {start:now,count:0};
  if (now - bucket.start > 60_000) { bucket.start=now; bucket.count=0; }
  bucket.count += 1; rateBuckets.set(key,bucket);
  if (bucket.count > 120) throw Object.assign(new Error("Rate limit exceeded"), {statusCode:429, code:"rate_limited"});
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64_000) throw Object.assign(new Error("Request too large"), {statusCode:413, code:"request_too_large"});
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid JSON"), {statusCode:400, code:"invalid_json"}); }
}

function requireFields(value, fields) {
  for (const field of fields) if (typeof value[field] !== "string" || !value[field].trim()) {
    throw Object.assign(new Error(`Missing required field: ${field}`), {statusCode:400, code:"invalid_request"});
  }
}

function overview() {
  const openReports = store.state.reports.filter(r=>r.status==="open");
  const activeIncidents = store.state.incidents.filter(i=>i.status!=="resolved");
  return {
    environment:ENV === "test" ? "staging" : ENV,
    launchApproved:false,
    protectiveMode:store.state.protectiveMode,
    counts:{
      openReports:openReports.length,
      activeIncidents:activeIncidents.length,
      hiddenContent:store.state.content.filter(c=>c.hidden).length,
      restrictedUsers:store.state.users.filter(u=>u.restriction).length,
      pendingApprovals:store.state.approvals.filter(a=>a.status==="pending").length
    },
    incidents:activeIncidents.slice(0,5),
    recentProtectiveActions:store.state.content.filter(c=>c.protectiveAction).map(c=>({targetId:c.id,action:c.protectiveAction})).slice(0,5),
    recommendation:openReports.length ? "Group related open reports, verify protective hiding, then review the incident." : "No urgent staging reports. Continue control-system testing.",
    siteHealth:{public:"online-unmodified",staging:"healthy",lastBackup:store.state.backups.at(-1)?.createdAt || null}
  };
}

function approvalRequest(action, targetId, reason, payload) {
  const policy = policyFor(action);
  const approval = {id:store.newId("approval"),action,targetId,reason,payload,status:"pending",risk:policy.risk,createdAt:new Date().toISOString()};
  store.state.approvals.push(approval); store.save();
  store.audit({actor:"chatgpt",action:"approval.request",target:approval.id,details:{requestedAction:action,targetId}});
  return approval;
}

function mutate(action, target, actor, fn, details={}) {
  const policy = policyFor(action);
  if (policy.approval === "owner") throw Object.assign(new Error("Owner approval request required"), {statusCode:409,code:"owner_approval_required"});
  const result = fn();
  store.save();
  store.audit({actor,action,target,details});
  return result;
}

async function api(req,res,url) {
  rateLimit(req); authenticate(req);
  const method=req.method; const pathname=url.pathname;
  if (method==="GET" && pathname==="/v1/overview") return json(res,200,overview());
  if (method==="GET" && pathname==="/v1/health") return json(res,200,{status:"healthy",environment:ENV === "test" ? "staging" : ENV,publicSite:"untouched",timestamp:new Date().toISOString()});
  if (method==="GET" && pathname==="/v1/incidents") return json(res,200,{incidents:store.state.incidents,reports:store.state.reports});
  if (method==="GET" && pathname==="/v1/content") return json(res,200,{content:store.state.content});
  if (method==="GET" && pathname==="/v1/approvals") return json(res,200,{approvals:store.state.approvals.filter(a=>a.status==="pending")});
  if (method==="GET" && pathname==="/v1/audit") return json(res,200,{events:store.auditEvents(Number(url.searchParams.get("limit")||100))});
  if (method==="GET" && pathname==="/v1/policy") return json(res,200,{approvalMatrix});

  const data=await body(req);
  if (method==="POST" && pathname==="/v1/incidents/group") {
    if (!Array.isArray(data.reportIds)||data.reportIds.length<1) throw Object.assign(new Error("reportIds must be a non-empty array"),{statusCode:400,code:"invalid_request"});
    requireFields(data,["title","explanation"]);
    return json(res,201,mutate("incident.group",null,"chatgpt",()=>{
      const reports=store.state.reports.filter(r=>data.reportIds.includes(r.id));
      if (!reports.length) throw Object.assign(new Error("No matching reports"),{statusCode:404,code:"not_found"});
      const incident={id:store.newId("incident"),title:data.title,explanation:data.explanation,reportIds:reports.map(r=>r.id),severity:data.severity||"medium",status:"investigating",protectiveAction:data.protectiveAction||"No automatic action recorded",recommendation:data.recommendation||"Owner review recommended",createdAt:new Date().toISOString()};
      reports.forEach(r=>r.status="grouped"); store.state.incidents.push(incident); return incident;
    },{reportIds:data.reportIds}));
  }
  if (method==="POST" && pathname==="/v1/incidents/report") {
    requireFields(data,["kind","targetId","summary"]);
    return json(res,201,mutate("incident.report",data.targetId,"chatgpt",()=>{
      const report={id:store.newId("report"),kind:data.kind,targetId:data.targetId,summary:data.summary,severity:data.severity||"medium",status:"open"};
      store.state.reports.push(report); return report;
    }));
  }
  let match=pathname.match(/^\/v1\/content\/([^/]+)\/(hide|restore)$/);
  if (method==="POST"&&match) {
    const [,id,verb]=match; const item=store.state.content.find(c=>c.id===id);
    if (!item) throw Object.assign(new Error("Content not found"),{statusCode:404,code:"not_found"});
    requireFields(data,["reason"]);
    const action=`content.${verb}`;
    return json(res,200,mutate(action,id,"chatgpt",()=>{item.hidden=verb==="hide";item.protectiveAction=verb==="hide"?data.reason:null;return item;},{reason:data.reason}));
  }
  match=pathname.match(/^\/v1\/comments\/([^/]+)\/hide$/);
  if(method==="POST"&&match){
    requireFields(data,["reason"]);const item=store.state.content.find(c=>c.id===match[1]&&c.type==="comment");
    if(!item)throw Object.assign(new Error("Comment not found"),{statusCode:404,code:"not_found"});
    return json(res,200,mutate("comment.hide",item.id,"chatgpt",()=>{item.hidden=true;item.protectiveAction=data.reason;return item;}));
  }
  match=pathname.match(/^\/v1\/users\/([^/]+)\/(warn|restrict-temporary|restore)$/);
  if(method==="POST"&&match){
    const [,id,verb]=match;const user=store.state.users.find(u=>u.id===id);
    if(!user)throw Object.assign(new Error("User not found"),{statusCode:404,code:"not_found"});
    requireFields(data,["reason"]); const action=`user.${verb}`;
    if(verb==="restrict-temporary"&&(!Number.isInteger(data.days)||data.days<1||data.days>30))throw Object.assign(new Error("days must be 1-30"),{statusCode:400,code:"invalid_request"});
    return json(res,200,mutate(action,id,"chatgpt",()=>{if(verb==="warn")user.warningCount++;if(verb==="restrict-temporary")user.restriction={reason:data.reason,until:new Date(Date.now()+data.days*86400000).toISOString()};if(verb==="restore")user.restriction=null;return user;}));
  }
  if(method==="POST"&&pathname==="/v1/emergency/protect"){
    requireFields(data,["reason"]);
    return json(res,200,mutate("emergency.protect","site","chatgpt",()=>{store.state.protectiveMode=true;store.state.content.filter(c=>c.type==="story"&&c.status==="in_review").forEach(c=>{c.hidden=true;c.protectiveAction=`Emergency mode: ${data.reason}`});return {protectiveMode:true,hiddenPendingStories:true};}));
  }
  if(method==="POST"&&pathname==="/v1/backups"){
    return json(res,201,mutate("backup.create","staging","chatgpt",()=>{const backup={id:store.newId("backup"),scope:"staging-metadata",status:"completed",createdAt:new Date().toISOString()};store.state.backups.push(backup);return backup;}));
  }
  if(method==="POST"&&pathname==="/v1/github/change-requests"){
    requireFields(data,["summary","reason"]);
    return json(res,201,mutate("github.change-request",null,"chatgpt",()=>{const change={id:store.newId("change"),summary:data.summary,reason:data.reason,status:"draft_only",constraints:"No arbitrary commands or unrestricted repository access",createdAt:new Date().toISOString()};store.state.codeChangeRequests.push(change);return change;}));
  }
  if(method==="POST"&&pathname==="/v1/deployments/stage"){
    requireFields(data,["revision","reason"]);
    return json(res,201,mutate("deployment.stage","staging","chatgpt",()=>{const deployment={id:store.newId("deploy"),environment:"staging",status:"queued",revision:data.revision,reason:data.reason,createdAt:new Date().toISOString()};store.state.deployments.push(deployment);return deployment;}));
  }
  if(method==="POST"&&pathname==="/v1/approvals"){
    requireFields(data,["action","targetId","reason"]); const policy=policyFor(data.action);
    if(policy.approval!=="owner")throw Object.assign(new Error("This action does not require owner approval"),{statusCode:400,code:"approval_not_required"});
    return json(res,201,approvalRequest(data.action,data.targetId,data.reason,data.payload||{}));
  }
  throw Object.assign(new Error("Endpoint not found"),{statusCode:404,code:"not_found"});
}

async function ownerApi(req,res,url) {
  rateLimit(req); authenticate(req,true);
  const match=url.pathname.match(/^\/owner\/approvals\/([^/]+)\/(approve|reject)$/);
  if(req.method!=="POST"||!match)throw Object.assign(new Error("Endpoint not found"),{statusCode:404,code:"not_found"});
  const [,id,decision]=match; const approval=store.state.approvals.find(a=>a.id===id);
  if(!approval||approval.status!=="pending")throw Object.assign(new Error("Pending approval not found"),{statusCode:404,code:"not_found"});
  if(req.headers["x-owner-confirmation"]!==id)throw Object.assign(new Error("Exact approval ID confirmation required"),{statusCode:400,code:"confirmation_mismatch"});
  approval.status=decision==="approve"?"approved":"rejected";approval.decidedAt=new Date().toISOString();
  store.save();store.audit({actor:"owner-dashboard",action:`approval.${decision}`,target:id,details:{requestedAction:approval.action}});
  return json(res,200,approval);
}

function staticFile(req,res,url) {
  const dashboardDir=path.join(__dirname,"dashboard");
  const file=url.pathname==="/"?"index.html":url.pathname.slice(1);
  if(!["index.html","app.js","styles.css","openapi.yaml"].includes(file))return false;
  const source=file==="openapi.yaml"?path.join(__dirname,"openapi.yaml"):path.join(dashboardDir,file);
  const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".yaml":"application/yaml; charset=utf-8"};
  res.writeHead(200,{"content-type":types[path.extname(source)],"content-security-policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
  fs.createReadStream(source).pipe(res);return true;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(req.method==="OPTIONS"){
      if(req.headers.origin!==ALLOWED_ORIGIN)return json(res,403,{error:"origin_not_allowed"});
      return json(res,204,{},{"access-control-allow-origin":ALLOWED_ORIGIN,"access-control-allow-headers":"authorization,content-type,x-owner-confirmation","access-control-allow-methods":"GET,POST,OPTIONS"});
    }
    if(url.pathname.startsWith("/v1/"))return await api(req,res,url);
    if(url.pathname.startsWith("/owner/"))return await ownerApi(req,res,url);
    if(staticFile(req,res,url))return;
    json(res,404,{error:"not_found"});
  }catch(error){
    const status=error.statusCode||500;
    store.audit({actor:"gateway",action:"request.error",outcome:"failure",details:{code:error.code||"internal_error",status}});
    json(res,status,{error:error.code||"internal_error",message:status===500?"Internal server error":error.message});
  }
});

if(require.main===module)server.listen(PORT,"127.0.0.1",()=>console.log(`Control Center (${ENV}) listening on http://127.0.0.1:${PORT}`));
module.exports={server,store,overview};
