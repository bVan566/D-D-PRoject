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

module.exports = { STAMPS, walkTo };
