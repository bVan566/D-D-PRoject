// The first "make it feel like a game" slice: a tile-based map you walk around on, and
// an FF-style battle screen when you run into trouble. This is deliberately its own
// small layer on top of the existing campaign state, not a replacement for the text
// play screen -- it reads the same characters.json (via the same visibility.js
// projection everything else uses) and writes back through a narrow endpoint, the same
// pattern as the combat tracker's end-of-fight HP sync.

const express = require("express");
const state = require("../state");
const { projectState } = require("../visibility");
const { requireCampaign } = require("../middleware");
const { getRuleset } = require("../rulesets");

const router = express.Router({ mergeParams: true });
router.use(requireCampaign);

router.get("/game", (req, res) => {
  const full = state.loadCampaign(req.campaignId);
  // The "human" projection is the right lens here: public party stats (name, HP, AC,
  // abilities) are exactly what a player controlling the whole party in a battle menu
  // needs, and nothing DM-private or another companion's private diary leaks into a
  // page that ships party data straight into client-side JS.
  const view = projectState(full, "human");
  const ruleset = getRuleset(full.campaign.ruleset);
  // Class id -> combatKit (the class's chosen-at-creation spells, or its one signature
  // martial feature) -- battleScene.js looks a party member's kit up by their class_id
  // to know what extra battle actions to offer beyond Attack/Defend/Flee.
  const classKits = {};
  ((ruleset.characterOptions && ruleset.characterOptions.classes) || []).forEach((c) => {
    if (c.combatKit) classKits[c.id] = c.combatKit;
  });
  res.render("game", {
    campaignId: req.campaignId,
    campaignTitle: full.campaign.campaign_title,
    party: view.characters,
    // The map layout, tile palette, and enemy roster all live in the ruleset pack now
    // (server/rulesets/*.json "game" block) so a cyberpunk campaign's Play (Beta)
    // screen looks and plays like a different place, not a reskinned fantasy dungeon.
    gameContent: ruleset.game || {},
    classKits,
    active: "game",
  });
});

// Applies a battle's outcome back to the real character sheets -- same idea as
// POST /play/combat/end, just triggered from the map/battle game instead of the
// text-based initiative tracker.
router.post("/game/battle-result", (req, res) => {
  const results = req.body.results; // [{ character_id, hp_current }]
  if (!Array.isArray(results)) return res.status(400).json({ ok: false, error: "results must be an array" });

  state.updateSlice(req.campaignId, "characters", (chars) => {
    const applyOne = (c) => {
      const r = results.find((x) => x.character_id === c.character_id);
      return r ? { ...c, hp: { ...c.hp, current: Math.max(0, Math.min(c.hp.max, r.hp_current)) } } : c;
    };
    return {
      human: chars.human ? applyOne(chars.human) : chars.human,
      companions: (chars.companions || []).map(applyOne),
    };
  });

  res.json({ ok: true });
});

module.exports = router;
