const $=selector=>document.querySelector(selector);
let apiKey="";let ownerKey="";
const message=text=>{$("#message").textContent=text};
async function request(path,{method="GET",body,owner=false,confirmation}={}){
  const key=owner?ownerKey:apiKey;
  if(!key)throw new Error(owner?"Owner key required":"Management API key required");
  const response=await fetch(path,{method,headers:{"authorization":`Bearer ${key}`,"content-type":"application/json",...(confirmation?{"x-owner-confirmation":confirmation}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(!response.ok)throw new Error(data.message||data.error);
  return data;
}
function safeText(value){return String(value??"—")}
function renderOverview(data){
  $("#report-count").textContent=data.counts.openReports;$("#incident-count").textContent=data.counts.activeIncidents;$("#hidden-count").textContent=data.counts.hiddenContent;$("#approval-count").textContent=data.counts.pendingApprovals;
  $("#recommendation").textContent=data.recommendation;$("#public-health").textContent=data.siteHealth.public;$("#staging-health").textContent=data.siteHealth.staging;$("#backup-health").textContent=data.siteHealth.lastBackup?new Date(data.siteHealth.lastBackup).toLocaleString():"Not created";$("#health-pill").textContent=data.siteHealth.staging;
  $("#incidents").replaceChildren(...(data.incidents.length?data.incidents.map(incident=>{
    const el=document.createElement("article");el.className="item";
    const heading=document.createElement("h3");heading.textContent=incident.title;
    const explanation=document.createElement("p");explanation.textContent=incident.explanation;
    const action=document.createElement("p");action.textContent=`Protection: ${incident.protectiveAction}`;
    const recommendation=document.createElement("p");recommendation.textContent=`Next: ${incident.recommendation}`;
    el.append(heading,explanation,action,recommendation);return el;
  }):[Object.assign(document.createElement("p"),{className:"empty",textContent:"No active incidents."})]));
}
function renderApprovals(data){
  const list=data.approvals.length?data.approvals.map(approval=>{
    const el=document.createElement("article");el.className="item";
    const h=document.createElement("h3");h.textContent=approval.action;
    const p=document.createElement("p");p.textContent=`${approval.reason} — target ${approval.targetId}`;
    const meta=document.createElement("div");meta.className="meta";meta.innerHTML=`<span class="tag"></span><span class="tag"></span>`;meta.children[0].textContent=approval.risk;meta.children[1].textContent=approval.id;
    const actions=document.createElement("div");actions.className="item-actions";
    for(const decision of ["approve","reject"]){const button=document.createElement("button");button.textContent=decision==="approve"?"Approve exact action":"Reject";if(decision==="reject")button.className="reject";button.addEventListener("click",()=>decide(approval.id,decision));actions.append(button)}
    el.append(h,p,meta,actions);return el;
  }):[Object.assign(document.createElement("p"),{className:"empty",textContent:"No pending owner approvals."})];
  $("#approvals").replaceChildren(...list);
}
function renderAudit(data){
  const rows=data.events.length?data.events.slice(0,20).map(event=>{const row=document.createElement("div");row.className="audit-row";const time=document.createElement("time");time.textContent=new Date(event.timestamp).toLocaleString();const action=document.createElement("strong");action.textContent=event.action;const actor=document.createElement("span");actor.textContent=event.actor;row.append(time,action,actor);return row;}):[Object.assign(document.createElement("p"),{className:"empty",textContent:"No audit events yet."})];
  $("#audit").replaceChildren(...rows);
}
async function load(){
  apiKey=$("#api-key").value.trim()||apiKey;ownerKey=$("#owner-key").value.trim()||ownerKey;
  try{const [overview,approvals,audit]=await Promise.all([request("/v1/overview"),request("/v1/approvals"),request("/v1/audit?limit=20")]);renderOverview(overview);renderApprovals(approvals);renderAudit(audit);message("Staging overview loaded.");}
  catch(error){message(error.message)}
}
async function decide(id,decision){try{await request(`/owner/approvals/${encodeURIComponent(id)}/${decision}`,{method:"POST",owner:true,confirmation:id});message(`Approval ${decision}d and audited.`);await load()}catch(error){message(error.message)}}
$("#connect").addEventListener("click",()=>{$("#connection").hidden=!$("#connection").hidden});
$("#load").addEventListener("click",load);$("#refresh").addEventListener("click",load);
$("#protect").addEventListener("click",async()=>{const reason=$("#emergency-reason").value.trim();if(!reason)return message("An emergency reason is required.");try{await request("/v1/emergency/protect",{method:"POST",body:{reason}});message("Protective mode enabled. Pending stories were hidden, not deleted.");await load()}catch(error){message(error.message)}});
$("#backup").addEventListener("click",async()=>{try{await request("/v1/backups",{method:"POST",body:{}});message("Staging metadata backup recorded.");await load()}catch(error){message(error.message)}});
