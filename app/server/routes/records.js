const express = require("express");
const state = require("../state");
const { projectState, canSee } = require("../visibility");
const { requireCampaign, resolveRole } = require("../middleware");

const router = express.Router({ mergeParams: true });
router.use(requireCampaign);

function linesToArray(s) {
  return (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
}

// ---------- Character sheets ----------

router.get("/sheet/:charId", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const view = projectState(full, role);
  const charId = req.params.charId; // "human" | "companion"
  const character = view.characters[charId];
  if (!character) return res.status(404).render("not-found", { path: req.originalUrl });
  res.render("sheet", { role, charId, character, campaignId: req.campaignId, active: "sheet-" + charId });
});

router.post("/sheet/:charId", (req, res) => {
  const b = req.body;
  const charId = req.params.charId;
  state.updateSlice(req.campaignId, "characters", (chars) => {
    const c = chars[charId];
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
    if (charId === "human" && b.player_notes !== undefined) {
      updated.player_notes = b.player_notes;
    }
    return { ...chars, [charId]: updated };
  });
  res.redirect(`/campaigns/${req.campaignId}/sheet/${charId}?role=${req.body.role || "dm"}`);
});

// ---------- Quests / threads ----------

router.get("/quests", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const view = projectState(full, role);
  res.render("quests", { role, quests: view.quests, campaignId: req.campaignId, active: "quests" });
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
  const view = projectState(full, role);
  res.render("lore", { role, view, campaignId: req.campaignId, active: "lore" });
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
  const view = projectState(full, role);
  res.render("relationships", { role, relationships: view.relationships, campaignId: req.campaignId, active: "relationships" });
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
  const view = projectState(full, role);
  res.render("recap", { role, sessions: view.sessions, campaign: view.campaign, metrics: view.metrics, campaignId: req.campaignId, active: "recap" });
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

module.exports = router;
