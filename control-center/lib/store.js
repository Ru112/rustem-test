const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const seedState = {
  environment: "staging",
  launchApproved: false,
  protectiveMode: false,
  reports: [
    {id:"rep-101", kind:"privacy", targetId:"story-17", summary:"A story may identify a third party", severity:"high", status:"open"},
    {id:"rep-102", kind:"privacy", targetId:"story-17", summary:"Full workplace name appears in story", severity:"high", status:"open"},
    {id:"rep-103", kind:"conduct", targetId:"comment-31", summary:"Comment pressures author to follow advice", severity:"medium", status:"open"}
  ],
  incidents: [],
  content: [
    {id:"article-1", type:"article", title:"How response choices work", status:"draft", hidden:false},
    {id:"story-17", type:"story", title:"A light during recovery", status:"in_review", hidden:true, protectiveAction:"Automatically hidden after two privacy reports"},
    {id:"comment-31", type:"comment", title:"Comment on story-17", status:"flagged", hidden:false}
  ],
  users: [
    {id:"member-8", displayName:"Staging member 8", warningCount:0, restriction:null}
  ],
  backups: [],
  deployments: [
    {id:"deploy-staging-1", environment:"staging", status:"healthy", revision:"local-seed", createdAt:"2026-07-24T00:00:00.000Z"}
  ],
  approvals: [],
  codeChangeRequests: []
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

class Store {
  constructor({dataDir, persistent = true} = {}) {
    this.dataDir = dataDir || path.join(__dirname, "..", "data");
    this.persistent = persistent;
    this.stateFile = path.join(this.dataDir, "runtime-state.json");
    this.auditFile = path.join(this.dataDir, "audit.ndjson");
    fs.mkdirSync(this.dataDir, {recursive:true});
    this.state = this.load();
  }

  load() {
    if (this.persistent && fs.existsSync(this.stateFile)) {
      return JSON.parse(fs.readFileSync(this.stateFile, "utf8"));
    }
    return clone(seedState);
  }

  save() {
    if (!this.persistent) return;
    const temp = `${this.stateFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2), {mode:0o600});
    fs.renameSync(temp, this.stateFile);
  }

  audit({actor, action, target = null, outcome = "success", details = {}}) {
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor,
      action,
      target,
      outcome,
      details
    };
    if (this.persistent) fs.appendFileSync(this.auditFile, `${JSON.stringify(event)}\n`, {mode:0o600});
    return event;
  }

  auditEvents(limit = 100) {
    if (!this.persistent || !fs.existsSync(this.auditFile)) return [];
    return fs.readFileSync(this.auditFile, "utf8").trim().split("\n").filter(Boolean)
      .slice(-Math.min(limit, 500)).reverse().map(line => JSON.parse(line));
  }

  newId(prefix) { return `${prefix}-${crypto.randomUUID().slice(0, 8)}`; }
}

module.exports = {Store, seedState};
