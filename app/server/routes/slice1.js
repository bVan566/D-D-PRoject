// Under the Slate -- Slice 1 map UI only. A new loop beside the existing
// campaign/chat system: no campaignId, no shared state with it. Everything past the
// map (Fixer, site rooms, payout, safehouse) stays headless/print for now -- see
// server/roguelike/headlessLoop.js.

const express = require("express");
const { STAMPS, walkTo, getAttention } = require("../roguelike/district");
const { encounterTable, rollWeighted } = require("../roguelike/streetTable");
const { check } = require("../roguelike/resolution");
const { getPc, getLastEvent, setLastEvent } = require("../roguelike/uiState");

const router = express.Router();

// Read-only mirror of walkTo's legality, for rendering -- never used to actually move
// the PC (that's walkTo itself, in the POST handler below).
function isLocked(pc, stamp) {
  if (stamp.kind === "job_site") {
    return pc.active_job_id ? { locked: false, reason: null } : { locked: true, reason: "no active job" };
  }
  if (stamp.locked_by_rep > 0 && pc.rep < stamp.locked_by_rep) {
    return { locked: true, reason: `needs Rep ${stamp.locked_by_rep}` };
  }
  return { locked: false, reason: null };
}

router.get("/map", (req, res) => {
  const pc = getPc();
  const stamps = STAMPS.map((s) => ({ ...s, here: s.id === pc.at_stamp, ...isLocked(pc, s) }));
  res.render("slice1-map", { stamps, pc, event: getLastEvent() });
});

router.post("/map/walk", (req, res) => {
  const pc = getPc();
  const stamp = STAMPS.find((s) => s.id === req.body.stamp_id);
  if (stamp) {
    // No job store in this UI (Fixer isn't built yet) -- if active_job_id is set at
    // all, trust it's for the stamp being walked to, matching "Job Site only if
    // active_job_id is set" rather than fabricating a real Job record.
    const activeJob = pc.active_job_id ? { site_stamp: stamp.id } : null;
    const result = walkTo(pc, stamp, activeJob);
    if (result.ok) {
      // Reusing the existing street table + check() exactly as built for the headless
      // loop -- every successful Walk rolls it, same as "Walk there -- light random
      // encounters" in the design doc.
      const row = rollWeighted(encounterTable(getAttention()));
      let text = `Walk to ${stamp.id}: ${row.id} -- ${row.effect}`;
      if (row.id === "fight") {
        const fight = check(pc, pc.stats.reflex, 12, false);
        text += ` (roll ${fight.roll}/${fight.total} -> ${fight.hit ? "you handle it clean" : "you take a knock"})`;
      }
      setLastEvent(text);
    } else {
      setLastEvent(`Walk to ${stamp.id} refused: ${result.reason}`);
    }
  }
  res.redirect("/slice1/map");
});

module.exports = router;
