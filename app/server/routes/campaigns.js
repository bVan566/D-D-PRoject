const express = require("express");
const state = require("../state");
const { requireCampaign, resolveRole, resolveCompanionId } = require("../middleware");
const { projectState } = require("../visibility");
const { listRulesets, getRuleset } = require("../rulesets");
const { generateDungeonLayout } = require("../mapgen");
const { isConfigured, generateCampaignPremise } = require("../agents");

const router = express.Router();

router.get("/", (req, res) => {
  const campaigns = state.listCampaigns().map((c) => ({ ...c, rulesetName: getRuleset(c.ruleset).name }));
  res.render("dashboard", { campaigns });
});

// A roguelike run is meant to be disposable -- this is the one irreversible action in
// the app, gated by a client-side confirm() in dashboard.ejs (a local single-user tool
// doesn't need a full server-side confirmation page for this).
router.post("/campaigns/:id/delete", (req, res) => {
  state.deleteCampaign(req.params.id);
  res.redirect("/");
});

router.get("/campaigns/new", (req, res) => {
  res.render("campaign-new", { error: null, form: {}, rulesets: listRulesets() });
});

router.post("/campaigns", (req, res) => {
  const b = req.body;
  // A procedural run's title comes from the DM's generated premise later (see
  // routes/campaigns.js companion/new -- generation fires after Session Zero
  // characters exist), so only a hand-built campaign needs one typed up front.
  if (b.mode !== "procedural" && (!b.campaign_title || !b.campaign_title.trim())) {
    return res.render("campaign-new", { error: "Campaign title is required for a custom campaign.", form: b, rulesets: listRulesets() });
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
    spells: Array.isArray(b.spells) ? b.spells : b.spells ? [b.spells] : [],
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

router.post("/campaigns/:id/characters/companion/new", requireCampaign, async (req, res) => {
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
    spells: Array.isArray(b.spells) ? b.spells : b.spells ? [b.spells] : [],
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

    const campaign = state.readSlice(req.campaignId, "campaign");
    if (campaign.mode === "procedural") {
      // The core roguelike promise: a brand-new run gets its own original story and its
      // own fresh dungeon, generated the moment characters exist -- no hand-authored
      // scenario to write, and a different campaign next time produces both a
      // different map (server/mapgen.js, free/local, no AI) and a different premise
      // (agents.js generateCampaignPremise, one AI call).
      const { mapLayout, playerStart } = generateDungeonLayout();
      state.updateSlice(req.campaignId, "dungeon", () => ({
        mapLayout,
        playerStart,
        areaId: "procedural",
        generatedAt: new Date().toISOString(),
      }));

      if (isConfigured()) {
        const ruleset = getRuleset(campaign.ruleset);
        const chars = state.readSlice(req.campaignId, "characters");
        const roster = [chars.human, ...chars.companions].filter(Boolean);
        const result = await generateCampaignPremise({
          ruleset,
          tone: campaign.tone?.tone,
          difficulty: campaign.tone?.difficulty,
          characters: roster,
        });
        if (result.ok) {
          const p = result.premise || {};
          state.updateSlice(req.campaignId, "campaign", (c) => ({ ...c, campaign_title: p.campaign_title || c.campaign_title }));
          state.updateSlice(req.campaignId, "scene", (s) => ({
            ...s,
            location_name: p.location_name || s.location_name,
            description_public: p.description_public || s.description_public,
            environment: p.environment || s.environment,
            dm_notes: p.hidden_stakes ? `Generated premise secret: ${p.hidden_stakes}` : s.dm_notes,
          }));
          if (p.quest_title) {
            state.updateSlice(req.campaignId, "quests", (quests) => [
              ...quests,
              {
                id: state.newId("quest"),
                title: p.quest_title,
                player_visible_description: p.quest_description || "",
                status: "open",
                originating_event: "Generated at campaign start",
                known_objectives: [],
                hidden_stakes: p.hidden_stakes || "",
                relevant_entities: p.antagonist_hint ? [p.antagonist_hint] : [],
                consequences_triggered: [],
                unresolved_questions: [],
                visibility: "public",
                provenance: "procedural generation",
              },
            ]);
          }
        }
        // A generation failure (rate limit, parse error) isn't fatal -- the map still
        // generated, and the player lands on a blank-scene game screen exactly like a
        // manual campaign would, rather than blocking character creation on an AI call.
      }
    }

    state.createCheckpoint(req.campaignId, "Session Zero complete — characters created", "session_start");
    if (campaign.mode === "procedural") {
      return res.redirect(`/campaigns/${req.campaignId}/game`);
    }
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
