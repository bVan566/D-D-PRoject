// Under the Slate -- Slice 1 map UI only. A new loop beside the existing
// campaign/chat system: no campaignId, no shared state with it. Everything past the
// map (Fixer, site rooms, payout, safehouse) stays headless/print for now -- see
// server/roguelike/headlessLoop.js.

const express = require("express");
const { STAMPS, walkTo } = require("../roguelike/district");
const { getPc } = require("../roguelike/uiState");

const router = express.Router();

// Read-only mirror of walkTo's legality, for rendering -- never used to actually move
// the PC (that's walkTo itself, in the POST handler below).
function isLocked(pc, stamp) {
  if (stamp.kind === "job_site") return { locked: true, reason: "no active job" };
  if (stamp.locked_by_rep > 0 && pc.rep < stamp.locked_by_rep) {
    return { locked: true, reason: `needs Rep ${stamp.locked_by_rep}` };
  }
  return { locked: false, reason: null };
}

router.get("/map", (req, res) => {
  const pc = getPc();
  const stamps = STAMPS.map((s) => ({ ...s, here: s.id === pc.at_stamp, ...isLocked(pc, s) }));
  res.render("slice1-map", { stamps, pc });
});

router.post("/map/walk", (req, res) => {
  const pc = getPc();
  const stamp = STAMPS.find((s) => s.id === req.body.stamp_id);
  if (stamp) walkTo(pc, stamp, null);
  res.redirect("/slice1/map");
});

module.exports = router;
