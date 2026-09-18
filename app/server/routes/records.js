const express = require("express");
const state = require("../state");
const { projectState, canSee } = require("../visibility");
const { requireCampaign, resolveRole, resolveCompanionId } = require("../middleware");
const { isConfigured, reviewSession, askWorldbuilder } = require("../agents");
const { recordUsage, summarize } = require("../usage");
const { getRuleset } = require("../rulesets");

const router = express.Router({ mergeParams: true });
router.use(requireCampaign);

function linesToArray(s) {
  return (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
}

// ---------- Character sheets ----------

// charId is "human" or a companion's character_id (there's no fixed "companion" slot
// anymore -- the party can have any number of them).
function findCharacter(characters, charId) {
  if (charId === "human") return characters.human;
  return (characters.companions || []).find((c) => c.character_id === charId) || null;
}

router.get("/sheet/:charId", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  const charId = req.params.charId;
  const character = findCharacter(view.characters, charId);
  if (!character) return res.status(404).render("not-found", { path: req.originalUrl });
  const ruleset = getRuleset(full.campaign.ruleset);
  res.render("sheet", {
    role,
    companionId,
    charId,
    character,
    abilityLabels: ruleset.abilities || {},
    currencyLabel: (ruleset.vocabulary && ruleset.vocabulary.currency) || "gp",
    campaignId: req.campaignId,
    active: "sheet-" + charId,
  });
});

router.post("/sheet/:charId", (req, res) => {
  const b = req.body;
  const charId = req.params.charId;
  state.updateSlice(req.campaignId, "characters", (chars) => {
    const c = findCharacter(chars, charId);
    if (!c) return chars;
    const updated = {
      ...c,
      hp: { current: Number(b.hp_current), max: Number(b.hp_max) },
      temp_hp: Number(b.temp_hp) || 0,
      ac: Number(b.ac) || c.ac,
      conditions: linesToArray(b.conditions),
      inventory: linesToArray(b.inventory).map((line) => ({ item: line, qty: 1 })),
      currency: { gp: Number(b.gp) || 0 },
      location: b.location ?? c.location,
    };
    if (c.private && b.private_beliefs !== undefined) {
      updated.private = {
        ...c.private,
        beliefs: linesToArray(b.private_beliefs),
        fears: linesToArray(b.private_fears),
        personal_goals: linesToArray(b.private_goals),
        suspicions: linesToArray(b.private_suspicions),
        unresolved_questions: linesToArray(b.private_questions),
      };
    }
    if (charId === "human") {
      if (b.player_notes !== undefined) updated.player_notes = b.player_notes;
      return { ...chars, human: updated };
    }
    return { ...chars, companions: chars.companions.map((comp) => (comp.character_id === charId ? updated : comp)) };
  });
  res.redirect(`/campaigns/${req.campaignId}/sheet/${charId}?role=${req.body.role || "dm"}`);
});

// ---------- Quests / threads ----------

router.get("/quests", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("quests", { role, companionId, quests: view.quests, campaignId: req.campaignId, active: "quests" });
});

router.post("/quests", (req, res) => {
  const b = req.body;
  const quest = {
    id: state.newId("quest"),
    title: b.title || "Untitled thread",
    player_visible_description: b.player_visible_description || "",
    status: b.status || "open",
    originating_event: b.originating_event || "",
    known_objectives: linesToArray(b.known_objectives),
    hidden_stakes: b.hidden_stakes || "",
    relevant_entities: linesToArray(b.relevant_entities),
    consequences_triggered: [],
    unresolved_questions: linesToArray(b.unresolved_questions),
    visibility: "public",
    provenance: `Added session ${state.readSlice(req.campaignId, "campaign").session_number}`,
  };
  state.updateSlice(req.campaignId, "quests", (list) => [...list, quest]);
  res.redirect(`/campaigns/${req.campaignId}/quests?role=dm`);
});

router.post("/quests/:qid", (req, res) => {
  const b = req.body;
  state.updateSlice(req.campaignId, "quests", (list) =>
    list.map((q) =>
      q.id === req.params.qid
        ? {
            ...q,
            status: b.status || q.status,
            consequences_triggered: b.new_consequence
              ? [...q.consequences_triggered, b.new_consequence]
              : q.consequences_triggered,
          }
        : q
    )
  );
  res.redirect(`/campaigns/${req.campaignId}/quests?role=${b.role || "dm"}`);
});

// ---------- Lore / canon / NPCs / timeline ----------

router.get("/lore", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("lore", { role, companionId, view, campaignId: req.campaignId, active: "lore" });
});

router.post("/lore/canon", (req, res) => {
  const b = req.body;
  const fact = {
    id: state.newId("fact"),
    statement: b.statement || "",
    canon_status: b.canon_status || "open_lore",
    visibility: b.visibility || "public",
    claim_type: b.claim_type || "objective_fact",
    source: b.source || "",
    session: state.readSlice(req.campaignId, "campaign").session_number,
    contradiction_flag: false,
    related_entities: linesToArray(b.related_entities),
  };
  state.updateSlice(req.campaignId, "canon", (list) => [...list, fact]);
  res.redirect(`/campaigns/${req.campaignId}/lore?role=${b.role || "lore"}`);
});

router.post("/lore/canon/:factId/flag", (req, res) => {
  const b = req.body;
  state.updateSlice(req.campaignId, "canon", (list) =>
    list.map((f) => (f.id === req.params.factId ? { ...f, contradiction_flag: true, contradiction_note: b.note || "" } : f))
  );
  res.redirect(`/campaigns/${req.campaignId}/lore?role=lore`);
});

router.post("/lore/npc", (req, res) => {
  const b = req.body;
  const npc = {
    id: state.newId("npc"),
    name: b.name || "Unnamed NPC",
    public_description: b.public_description || "",
    role: b.role_desc || "",
    location: b.location || "",
    status: b.status || "alive",
    known_information_public: linesToArray(b.known_information_public),
    hidden_motive: b.hidden_motive || "",
    provenance: b.provenance || "",
    visibility: "public",
  };
  state.updateSlice(req.campaignId, "npcs", (list) => [...list, npc]);
  res.redirect(`/campaigns/${req.campaignId}/lore?role=${b.role || "dm"}`);
});

router.post("/lore/timeline", (req, res) => {
  const b = req.body;
  const event = {
    id: state.newId("evt"),
    time_marker: b.time_marker || `Session ${state.readSlice(req.campaignId, "campaign").session_number}`,
    summary: b.summary || "",
    participants: linesToArray(b.participants),
    visibility: b.visibility || "public",
    claim_type: b.claim_type || "observed",
    provenance: b.provenance || "",
  };
  state.updateSlice(req.campaignId, "timeline", (list) => [...list, event]);
  res.redirect(`/campaigns/${req.campaignId}/lore?role=${b.role || "dm"}`);
});

// ---------- Relationships ----------

router.get("/relationships", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("relationships", { role, companionId, relationships: view.relationships, campaignId: req.campaignId, active: "relationships" });
});

router.post("/relationships/:key", (req, res) => {
  const b = req.body;
  state.updateSlice(req.campaignId, "relationships", (rels) => {
    const r = rels[req.params.key];
    if (!r) return rels;
    const delta = {
      trust: Number(b.trust_delta) || 0,
      affection: Number(b.affection_delta) || 0,
      loyalty: Number(b.loyalty_delta) || 0,
      respect: Number(b.respect_delta) || 0,
    };
    const updated = {
      ...r,
      trust: r.trust + delta.trust,
      affection: r.affection + delta.affection,
      loyalty: r.loyalty + delta.loyalty,
      respect: r.respect + delta.respect,
      status_public: b.status_public ?? r.status_public,
      private_notes: b.private_notes ?? r.private_notes,
      history: b.note
        ? [
            ...r.history,
            {
              session: state.readSlice(req.campaignId, "campaign").session_number,
              note: b.note,
              delta,
            },
          ]
        : r.history,
    };
    return { ...rels, [req.params.key]: updated };
  });
  res.redirect(`/campaigns/${req.campaignId}/relationships?role=${b.role || "dm"}`);
});

// ---------- Session recap / end session ----------

router.get("/recap", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("recap", {
    role,
    companionId,
    sessions: view.sessions,
    campaign: view.campaign,
    metrics: view.metrics,
    learning: view.learning,
    usage: role === "dm" || role === "lore" ? summarize(full.usage) : null,
    llmConfigured: isConfigured(),
    reviewError: null,
    campaignId: req.campaignId,
    active: "recap",
  });
});

// Automatic post-session learning: reads the current play log + metrics, asks the
// model to propose lessons against the engine's own acceptance criteria, and stores
// them as status "proposed". Nothing here is durable until a human approves it below
// -- see agents.js reviewSession() header for why.
router.post("/recap/auto-review", async (req, res) => {
  const full = state.loadCampaign(req.campaignId);
  const result = await reviewSession({
    campaignTitle: full.campaign.campaign_title,
    sessionNumber: full.campaign.session_number,
    playLog: full.play_log,
    metrics: full.metrics,
  });

  if (!result.ok) {
    const view = projectState(full, "dm");
    return res.render("recap", {
      role: "dm",
      sessions: view.sessions,
      campaign: view.campaign,
      metrics: view.metrics,
      learning: view.learning,
      usage: summarize(full.usage),
      llmConfigured: isConfigured(),
      reviewError: result.reason,
      campaignId: req.campaignId,
      active: "recap",
    });
  }

  recordUsage(req.campaignId, { agentRole: "reviewer", usage: result.usage });

  const now = new Date().toISOString();
  const proposed = result.lessons.map((l) => ({
    id: state.newId("lesson"),
    agent: l.agent,
    observation: l.observation,
    classification: l.classification || "single_session",
    evidence_session: full.campaign.session_number,
    recommended_change: l.recommended_change,
    status: "proposed",
    created_at: now,
    decided_at: null,
  }));
  state.updateSlice(req.campaignId, "learning", (list) => [...list, ...proposed]);
  res.redirect(`/campaigns/${req.campaignId}/recap?role=dm`);
});

router.post("/learning/:lessonId/approve", (req, res) => {
  state.updateSlice(req.campaignId, "learning", (list) =>
    list.map((l) =>
      l.id === req.params.lessonId ? { ...l, status: "active", decided_at: new Date().toISOString() } : l
    )
  );
  res.redirect(`/campaigns/${req.campaignId}/recap?role=dm`);
});

router.post("/learning/:lessonId/reject", (req, res) => {
  state.updateSlice(req.campaignId, "learning", (list) =>
    list.map((l) =>
      l.id === req.params.lessonId ? { ...l, status: "rejected", decided_at: new Date().toISOString() } : l
    )
  );
  res.redirect(`/campaigns/${req.campaignId}/recap?role=dm`);
});

router.post("/recap/end-session", (req, res) => {
  const b = req.body;
  const campaign = state.readSlice(req.campaignId, "campaign");
  const sessionNumber = campaign.session_number;
  const summary = {
    session_number: sessionNumber,
    date: new Date().toISOString().slice(0, 10),
    compressed_summary: b.compressed_summary || "",
    major_choices: linesToArray(b.major_choices),
    discoveries: linesToArray(b.discoveries),
    resource_changes: linesToArray(b.resource_changes),
    relationship_changes: linesToArray(b.relationship_changes),
    unresolved_threads: linesToArray(b.unresolved_threads),
    dm_self_review: b.dm_self_review || "",
    player_agent_self_review: b.player_agent_self_review || "",
    human_feedback: b.human_feedback || "",
  };
  state.updateSlice(req.campaignId, "sessions", (list) => [...list, summary]);
  state.updateSlice(req.campaignId, "campaign", (c) => ({ ...c, session_number: c.session_number + 1 }));
  state.createCheckpoint(req.campaignId, `End of Session ${sessionNumber}`, "session_end");
  res.redirect(`/campaigns/${req.campaignId}/recap?role=dm`);
});

// ---------- Save / resume ----------

router.get("/saves", (req, res) => {
  const role = resolveRole(req);
  res.render("saves", { role, checkpoints: state.listCheckpoints(req.campaignId), campaignId: req.campaignId, active: "saves" });
});

router.post("/saves", (req, res) => {
  state.createCheckpoint(req.campaignId, req.body.label || "Manual save", "user_requested");
  res.redirect(`/campaigns/${req.campaignId}/saves?role=${req.body.role || "dm"}`);
});

router.post("/saves/:checkpointId/restore", (req, res) => {
  state.restoreCheckpoint(req.campaignId, req.params.checkpointId);
  res.redirect(`/campaigns/${req.campaignId}/play?role=${req.body.role || "dm"}`);
});

// ---------- World-building (out-of-character setting/IP development) ----------
//
// Deliberately not reachable from the Companion role: this is pre-canon possibility
// space, and letting the Player Agent see it would leak information its character
// hasn't legitimately learned -- the exact failure mode the engine's Player Agent spec
// exists to prevent. The DM, human, and Lore roles all have a legitimate reason to be
// here (prep, co-creation, and continuity respectively).

router.get("/worldbuilding", (req, res) => {
  const role = resolveRole(req);
  if (role === "companion") {
    return res.render("worldbuilding-blocked", { role, campaignId: req.campaignId, active: "worldbuilding" });
  }
  const full = state.loadCampaign(req.campaignId);
  const view = projectState(full, role);
  res.render("worldbuilding", {
    role,
    log: full.worldbuilding_log,
    canon: view.canon,
    llmConfigured: isConfigured(),
    campaignId: req.campaignId,
    active: "worldbuilding",
  });
});

router.post("/worldbuilding/message", async (req, res) => {
  const b = req.body;
  const role = b.role || "human";
  const message = {
    id: state.newId("wbmsg"),
    timestamp: new Date().toISOString(),
    role,
    speaker_name: b.speaker_name || role,
    content: b.content || "",
  };
  state.updateSlice(req.campaignId, "worldbuilding_log", (log) => [...log, message]);

  if (b.ask_worldbuilder) {
    const full = state.loadCampaign(req.campaignId);
    const canonSummary = full.canon
      .filter((f) => f.canon_status === "locked_canon" || f.canon_status === "dm_truth" || f.canon_status === "open_lore")
      .map((f) => `- (${f.canon_status}) ${f.statement}`)
      .join("\n");
    const result = await askWorldbuilder({
      campaignTitle: full.campaign.campaign_title,
      canonSummary,
      history: full.worldbuilding_log.slice(-20),
      userMessage: `[${message.speaker_name}] ${message.content}`,
    });
    recordUsage(req.campaignId, { agentRole: "worldbuilder", usage: result.usage });
    const reply = {
      id: state.newId("wbmsg"),
      timestamp: new Date().toISOString(),
      role: "worldbuilder",
      speaker_name: "Worldbuilder",
      content: result.ok ? result.text : `[agent bridge unavailable] ${result.reason}`,
    };
    state.updateSlice(req.campaignId, "worldbuilding_log", (log) => [...log, reply]);
  }

  res.redirect(`/campaigns/${req.campaignId}/worldbuilding?role=${role}`);
});

// The only way anything from world-building becomes real: an explicit human action
// that writes a normal canon record (same shape as /lore/canon), so it's governed by
// the exact same visibility/provenance rules as any other fact from here on.
router.post("/worldbuilding/commit", (req, res) => {
  const b = req.body;
  const fact = {
    id: state.newId("fact"),
    statement: b.statement || "",
    canon_status: b.canon_status || "open_lore",
    visibility: b.visibility || "public",
    claim_type: "objective_fact",
    source: "World-building session",
    session: state.readSlice(req.campaignId, "campaign").session_number,
    contradiction_flag: false,
    related_entities: [],
  };
  state.updateSlice(req.campaignId, "canon", (list) => [...list, fact]);
  res.redirect(`/campaigns/${req.campaignId}/worldbuilding?role=${b.role || "dm"}`);
});

module.exports = router;
