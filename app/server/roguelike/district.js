// District stub: one authored district, no city generation. Player position is which
// stamp they're on (PC.at_stamp), not coordinates.

const STAMPS = [
  { id: "safehouse_1", kind: "safehouse", locked_by_rep: 0 },
  { id: "fixer_1", kind: "street_fixer", locked_by_rep: 0 },
  { id: "fixer_2", kind: "street_fixer", locked_by_rep: 10 },
  { id: "job_site_1", kind: "job_site", locked_by_rep: 0 },
  { id: "meter_stack_1", kind: "meter_stack", locked_by_rep: 0 },
];

// No pathing -- any legal stamp is reachable in one Walk from wherever at_stamp is now.
function walkTo(pc, stamp, activeJob) {
  if (stamp.kind === "job_site") {
    if (!activeJob || activeJob.site_stamp !== stamp.id) return { ok: false, reason: "no matching active job" };
  } else if (stamp.locked_by_rep > 0 && pc.rep < stamp.locked_by_rep) {
    return { ok: false, reason: "rep too low" };
  }
  pc.at_stamp = stamp.id;
  return { ok: true };
}

// One district's attention level (0-3), shared by everything that reads or writes it --
// the street table weights its roll off this, and job-site actions (e.g. Force at
// job_site_1's entrance) are what raise it. A module-level counter, not a new session
// object: there's only one district in Slice 1.
let attention = 0;

function getAttention() {
  return attention;
}

function addAttention(amount) {
  attention = Math.max(0, Math.min(3, attention + amount));
  return attention;
}

module.exports = { STAMPS, walkTo, getAttention, addAttention };
