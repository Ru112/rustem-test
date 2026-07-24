process.env.CONTROL_CENTER_ENV="test";
const test=require("node:test");
const assert=require("node:assert/strict");
const {server,store}=require("../server");

let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));base=`http://127.0.0.1:${server.address().port}`});
test.after(async()=>{await new Promise(resolve=>server.close(resolve))});
const call=(path,{method="GET",body,key="test-api-key-1234567890",headers={}}={})=>fetch(`${base}${path}`,{method,headers:{authorization:`Bearer ${key}`,"content-type":"application/json",...headers},body:body?JSON.stringify(body):undefined});

test("rejects unauthenticated access",async()=>{const response=await fetch(`${base}/v1/overview`);assert.equal(response.status,401)});
test("returns staging overview with launch disabled",async()=>{const response=await call("/v1/overview");assert.equal(response.status,200);const data=await response.json();assert.equal(data.environment,"staging");assert.equal(data.launchApproved,false)});
test("hides and restores content reversibly",async()=>{let response=await call("/v1/content/article-1/hide",{method:"POST",body:{reason:"test protection"}});assert.equal(response.status,200);assert.equal((await response.json()).hidden,true);response=await call("/v1/content/article-1/restore",{method:"POST",body:{reason:"test complete"}});assert.equal(response.status,200);assert.equal((await response.json()).hidden,false)});
test("caps temporary restrictions at 30 days",async()=>{const response=await call("/v1/users/member-8/restrict-temporary",{method:"POST",body:{reason:"test",days:31}});assert.equal(response.status,400)});
test("requires separate owner channel for protected action",async()=>{let response=await call("/v1/approvals",{method:"POST",body:{action:"deployment.rollback",targetId:"deploy-staging-1",reason:"test rollback"}});assert.equal(response.status,201);const approval=await response.json();response=await call(`/owner/approvals/${approval.id}/approve`,{method:"POST",headers:{"x-owner-confirmation":approval.id}});assert.equal(response.status,401);response=await call(`/owner/approvals/${approval.id}/approve`,{method:"POST",key:"test-owner-key-1234567890",headers:{"x-owner-confirmation":"wrong"}});assert.equal(response.status,400);response=await call(`/owner/approvals/${approval.id}/approve`,{method:"POST",key:"test-owner-key-1234567890",headers:{"x-owner-confirmation":approval.id}});assert.equal(response.status,200);assert.equal((await response.json()).status,"approved")});
test("fails closed for arbitrary routes",async()=>{const response=await call("/v1/database/query",{method:"POST",body:{sql:"select *"}});assert.equal(response.status,404)});
