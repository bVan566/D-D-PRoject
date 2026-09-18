const express = require("express");
const state = require("../state");
const { requireCampaign, resolveRole, resolveCompanionId } = require("../middleware");
const { projectState } = require("../visibility");
const { listRulesets, getRuleset } = require("../rulesets");

const router = express.Router();

router.get("/", (req, res) => {
  const campaigns = state.listCampaigns().map((c) => ({ ...c, rulesetName: getRuleset(c.ruleset).name }));
  res.render("dashboard", { campaigns });
});

router.get("/campaigns/new", (req, res) => {
  res.render("campaign-new", { error: null, form: {}, rulesets: listRulesets() });
});

router.post("/campaigns", (req, res) => {
  const b = req.body;
  if (!b.campaign_title || !b.campaign_title.trim()) {
    return res.render("campaign-new", { error: "Campaign title is required.", form: b, rulesets: listRulesets() });
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
  if (!full.characters.companions.length) {
    return res.redirect(`/campaigns/${req.campaignId}/characters/companion/new`);
  }
  res.redirect(`/campaigns/${req.campaignId}/party`);
});

router.get("/campaigns/:id/characters/human/new", requireCampaign, (req, res) => {
  const campaign = state.readSlice(req.campaignId, "campaign");
  const ruleset = getRuleset(campaign.ruleset);
  res.render("character-new-human", {
    campaign,
    abilityLabels: ruleset.abilities || {},
    currencyLabel: (ruleset.vocabulary && ruleset.vocabulary.currency) || "gp",
    characterOptions: ruleset.characterOptions || null,
  });
});

router.post("/campaigns/:id/characters/human/new", requireCampaign, (req, res) => {
  const b = req.body;
  const human = {
    character_id: "pc-human",
    controller: "human",
    name: b.name || "Unnamed",
    species: b.species || "",
    class_level: b.class_level || "",
    race_id: b.race_id || "",
    class_id: b.class_id || "",
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
    skills: Array.isArray(b.skills) ? b.skills : b.skills ? [b.skills] : [],
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
  const campaign = state.readSlice(req.campaignId, "campaign");
  const ruleset = getRuleset(campaign.ruleset);
  res.render("character-new-companion", {
    campaign,
    abilityLabels: ruleset.abilities || {},
    currencyLabel: (ruleset.vocabulary && ruleset.vocabulary.currency) || "gp",
    characterOptions: ruleset.characterOptions || null,
  });
});

router.post("/campaigns/:id/characters/companion/new", requireCampaign, (req, res) => {
  const b = req.body;
  const isFirstCompanion = state.readSlice(req.campaignId, "characters").companions.length === 0;
  const companion = {
    character_id: state.newId("pc"),
    controller: "player_agent",
    name: b.name || "Unnamed",
    species: b.species || "",
    class_level: b.class_level || "",
    race_id: b.race_id || "",
    class_id: b.class_id || "",
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
    skills: Array.isArray(b.skills) ? b.skills : b.skills ? [b.skills] : [],
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
  state.updateSlice(req.campaignId, "characters", (c) => ({ ...c, companions: [...c.companions, companion] }));

  state.updateSlice(req.campaignId, "metrics", (m) => ({
    ...m,
    player_agents: { ...m.player_agents, [companion.character_id]: state.newPlayerAgentMetrics() },
  }));

  state.updateSlice(req.campaignId, "relationships", (r) => ({
    ...r,
    [`${companion.character_id}__human`]: {
      label: `${companion.name} → ${state.readSlice(req.campaignId, "characters").human?.name || "human PC"}`,
      owner_companion_id: companion.character_id,
      status_public: "Practical cooperation. Not yet decided.",
      trust: 0,
      affection: 0,
      loyalty: 0,
      respect: 0,
      history: [],
      private_notes: "No private read yet — nothing has happened in play.",
    },
  }));

  if (isFirstCompanion) {
    state.updateSlice(req.campaignId, "campaign", (c) => ({ ...c, status: "active", session_number: Math.max(c.session_number, 1) }));
    state.createCheckpoint(req.campaignId, "Session Zero complete — characters created", "session_start");
  }
  res.redirect(`/campaigns/${req.campaignId}/party`);
});

router.get("/campaigns/:id/party", requireCampaign, (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("party", { role, companionId, view, campaignId: req.campaignId, active: "party" });
});

module.exports = router;
