const express = require("express");
const state = require("../state");
const { requireCampaign } = require("../middleware");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("dashboard", { campaigns: state.listCampaigns() });
});

router.get("/campaigns/new", (req, res) => {
  res.render("campaign-new", { error: null, form: {} });
});

router.post("/campaigns", (req, res) => {
  const b = req.body;
  if (!b.campaign_title || !b.campaign_title.trim()) {
    return res.render("campaign-new", { error: "Campaign title is required.", form: b });
  }
  const campaign = state.createCampaign(b);
  res.redirect(`/campaigns/${campaign.campaign_id}/session-zero`);
});

router.get("/campaigns/:id/session-zero", requireCampaign, (req, res) => {
  const full = state.loadCampaign(req.campaignId);
  res.render("session-zero", { campaign: full.campaign });
});

router.post("/campaigns/:id/session-zero", requireCampaign, (req, res) => {
  const b = req.body;
  state.updateSlice(req.campaignId, "campaign", (c) => ({
    ...c,
    tone: {
      ...c.tone,
      tone: b.tone || c.tone.tone,
      play_balance: b.play_balance || c.tone.play_balance,
      death_policy: b.death_policy || c.tone.death_policy,
      horror_intensity: b.horror_intensity || c.tone.horror_intensity,
      romance: b.romance || c.tone.romance,
      companion_dynamic: b.companion_dynamic || c.tone.companion_dynamic,
      difficulty: b.difficulty || c.tone.difficulty,
      content_boundaries: b.content_boundaries ?? c.tone.content_boundaries,
    },
  }));
  const full = state.loadCampaign(req.campaignId);
  if (!full.characters.human) {
    return res.redirect(`/campaigns/${req.campaignId}/characters/human/new`);
  }
  if (!full.characters.companion) {
    return res.redirect(`/campaigns/${req.campaignId}/characters/companion/new`);
  }
  res.redirect(`/campaigns/${req.campaignId}/play`);
});

router.get("/campaigns/:id/characters/human/new", requireCampaign, (req, res) => {
  res.render("character-new-human", { campaign: state.readSlice(req.campaignId, "campaign") });
});

router.post("/campaigns/:id/characters/human/new", requireCampaign, (req, res) => {
  const b = req.body;
  const human = {
    character_id: "pc-human",
    controller: "human",
    name: b.name || "Unnamed",
    species: b.species || "",
    class_level: b.class_level || "",
    background: b.background || "",
    alignment: b.alignment || "",
    abilities: {
      str: Number(b.str) || 10,
      dex: Number(b.dex) || 10,
      con: Number(b.con) || 10,
      int: Number(b.int) || 10,
      wis: Number(b.wis) || 10,
      cha: Number(b.cha) || 10,
    },
    ac: Number(b.ac) || 10,
    hp: { current: Number(b.hp_max) || 10, max: Number(b.hp_max) || 10 },
    temp_hp: 0,
    speed: Number(b.speed) || 30,
    conditions: [],
    inventory: (b.inventory || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => ({ item: line, qty: 1 })),
    currency: { gp: Number(b.gp) || 0 },
    personality: {
      traits: b.traits || "",
      ideals: b.ideals || "",
      bonds: b.bonds || "",
      flaws: b.flaws || "",
    },
    goals_public: (b.goals || "").split("\n").map((s) => s.trim()).filter(Boolean),
    location: "",
    status: "active",
    player_notes: "",
  };
  state.updateSlice(req.campaignId, "characters", (c) => ({ ...c, human }));
  res.redirect(`/campaigns/${req.campaignId}/characters/companion/new`);
});

router.get("/campaigns/:id/characters/companion/new", requireCampaign, (req, res) => {
  res.render("character-new-companion", { campaign: state.readSlice(req.campaignId, "campaign") });
});

router.post("/campaigns/:id/characters/companion/new", requireCampaign, (req, res) => {
  const b = req.body;
  const companion = {
    character_id: "pc-companion",
    controller: "player_agent",
    name: b.name || "Unnamed",
    species: b.species || "",
    class_level: b.class_level || "",
    background: b.background || "",
    alignment: b.alignment || "",
    abilities: {
      str: Number(b.str) || 10,
      dex: Number(b.dex) || 10,
      con: Number(b.con) || 10,
      int: Number(b.int) || 10,
      wis: Number(b.wis) || 10,
      cha: Number(b.cha) || 10,
    },
    ac: Number(b.ac) || 10,
    hp: { current: Number(b.hp_max) || 10, max: Number(b.hp_max) || 10 },
    temp_hp: 0,
    speed: Number(b.speed) || 30,
    conditions: [],
    inventory: (b.inventory || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => ({ item: line, qty: 1 })),
    currency: { gp: Number(b.gp) || 0 },
    personality: {
      traits: b.traits || "",
      ideals: b.ideals || "",
      bonds: b.bonds || "",
      flaws: b.flaws || "",
    },
    goals_public: (b.goals_public || "").split("\n").map((s) => s.trim()).filter(Boolean),
    location: "",
    status: "active",
    private: {
      visibility: ["companion_pc", "lore_only"],
      beliefs: (b.private_beliefs || "").split("\n").map((s) => s.trim()).filter(Boolean),
      fears: (b.private_fears || "").split("\n").map((s) => s.trim()).filter(Boolean),
      personal_goals: (b.private_goals || "").split("\n").map((s) => s.trim()).filter(Boolean),
      suspicions: [],
      unresolved_questions: [],
      relationship_opinions: {},
      tactical_preferences: (b.tactical_preferences || "").split("\n").map((s) => s.trim()).filter(Boolean),
    },
  };
  state.updateSlice(req.campaignId, "characters", (c) => ({ ...c, companion }));

  state.updateSlice(req.campaignId, "relationships", (r) => ({
    ...r,
    companion_to_human: {
      label: `${companion.name} → ${state.readSlice(req.campaignId, "characters").human?.name || "human PC"}`,
      status_public: "Practical cooperation. Not yet decided.",
      trust: 0,
      affection: 0,
      loyalty: 0,
      respect: 0,
      history: [],
      private_notes: "No private read yet — nothing has happened in play.",
      private_notes_visibility: ["companion_pc", "lore_only"],
    },
  }));

  state.updateSlice(req.campaignId, "campaign", (c) => ({ ...c, status: "active", session_number: Math.max(c.session_number, 1) }));
  state.createCheckpoint(req.campaignId, "Session Zero complete — characters created", "session_start");
  res.redirect(`/campaigns/${req.campaignId}/play`);
});

module.exports = router;
