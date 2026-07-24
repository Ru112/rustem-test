const approvalMatrix = {
  "content.hide": {risk:"low", reversible:true, approval:"none"},
  "content.restore": {risk:"low", reversible:true, approval:"none"},
  "incident.group": {risk:"low", reversible:true, approval:"none"},
  "incident.report": {risk:"low", reversible:true, approval:"none"},
  "comment.hide": {risk:"low", reversible:true, approval:"none"},
  "user.warn": {risk:"low", reversible:true, approval:"none"},
  "user.restrict-temporary": {risk:"medium", reversible:true, approval:"none", maxDays:30},
  "user.restore": {risk:"low", reversible:true, approval:"none"},
  "emergency.protect": {risk:"medium", reversible:true, approval:"none"},
  "story.publish": {risk:"medium", reversible:true, approval:"owner"},
  "backup.create": {risk:"low", reversible:true, approval:"none"},
  "github.change-request": {risk:"medium", reversible:true, approval:"none"},
  "deployment.stage": {risk:"medium", reversible:true, approval:"none"},
  "deployment.rollback": {risk:"high", reversible:true, approval:"owner"},
  "content.delete-permanent": {risk:"critical", reversible:false, approval:"owner"},
  "user.ban-permanent": {risk:"critical", reversible:false, approval:"owner"},
  "legal.respond": {risk:"critical", reversible:false, approval:"owner"},
  "financial.change": {risk:"critical", reversible:false, approval:"owner"}
};

function policyFor(action) {
  const policy = approvalMatrix[action];
  if (!policy) throw Object.assign(new Error("Action is not allowlisted"), {statusCode:403, code:"action_not_allowlisted"});
  return policy;
}

module.exports = {approvalMatrix, policyFor};
