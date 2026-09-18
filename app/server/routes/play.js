const express = require("express");
const state = require("../state");
const { projectState } = require("../visibility");
const { requireCampaign, resolveRole } = require("../middleware");
const { callClaude, isConfigured, ROLE_TO_LEARNING_AGENT } = require("../agents");
const { recordUsage } = require("../usage");

function activeLearningFor(full, role) {
  const agent = ROLE_TO_LEARNING_AGENT[role];
  return (full.learning || []).filter((l) => l.agent === agent && l.status === "active");
}

const router = express.Router({ mergeParams: true });

router.use(requireCampaign);

router.get("/play", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const view = projectState(full, role);
  res.render("play", { view, role, llmConfigured: isConfigured(), campaignId: req.campaignId, active: "play" });
});

router.post("/play/scene", (req, res) => {
  // DM-only action in spirit (the DM controls the world); not hard-blocked here since
  // this is a single-operator prototype, but the play template only exposes this form
  // on the dm role view.
  const b = req.body;
  state.updateSlice(req.campaignId, "scene", (scene) => ({
    ...scene,
    location_name: b.location_name ?? scene.location_name,
    description_public: b.description_public ?? scene.description_public,
    environment: b.environment ?? scene.environment,
    hazards: b.hazards !== undefined ? b.hazards.split("\n").map((s) => s.trim()).filter(Boolean) : scene.hazards,
    objectives_public:
      b.objectives_public !== undefined
        ? b.objectives_public.split("\n").map((s) => s.trim()).filter(Boolean)
        : scene.objectives_public,
    combat_active: b.combat_active === "on",
    dm_notes: b.dm_notes ?? scene.dm_notes,
  }));
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

// ---------- Combat / initiative tracker ----------
// The original scene schema had combat_active/round/initiative_order as fields with no
// UI behind them. This is the actual tracker: add combatants (PCs, NPCs, or enemies
// the DM wants to keep hidden until revealed), roll/enter initiative, step through
// turns and rounds, and adjust HP/conditions as it happens -- the piece of "current
// scene and session state" that was still just a checkbox.

function sortByInitiative(order) {
  return [...order].sort((a, b) => b.initiative - a.initiative);
}

router.post("/play/combat/start", (req, res) => {
  state.updateSlice(req.campaignId, "scene", (scene) => ({
    ...scene,
    combat_active: true,
    round: scene.round > 0 ? scene.round : 1,
    current_turn_index: 0,
    initiative_order: sortByInitiative(scene.initiative_order),
  }));
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/combat/end", (req, res) => {
  const scene = state.readSlice(req.campaignId, "scene");
  // Write party combatants' final HP/conditions back to their character sheets so the
  // tracker and the sheet don't quietly drift apart once combat is over.
  state.updateSlice(req.campaignId, "characters", (chars) => {
    const next = { ...chars };
    for (const c of scene.initiative_order) {
      if (c.side !== "party") continue;
      for (const key of ["human", "companion"]) {
        if (next[key] && next[key].name === c.name) {
          next[key] = { ...next[key], hp: { current: c.hp_current, max: c.hp_max }, conditions: c.conditions };
        }
      }
    }
    return next;
  });
  state.updateSlice(req.campaignId, "scene", (s) => ({
    ...s,
    combat_active: false,
    round: 0,
    current_turn_index: 0,
    initiative_order: [],
  }));
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/combat/add", (req, res) => {
  const b = req.body;
  const combatant = {
    id: state.newId("cbt"),
    name: b.name || "Unnamed",
    side: b.side || "enemy",
    initiative: Number(b.initiative) || 0,
    hp_max: Number(b.hp_max) || 1,
    hp_current: b.hp_current !== undefined ? Number(b.hp_current) : Number(b.hp_max) || 1,
    conditions: [],
    is_hidden_from_players: b.is_hidden_from_players === "on",
  };
  state.updateSlice(req.campaignId, "scene", (scene) => ({
    ...scene,
    initiative_order: sortByInitiative([...scene.initiative_order, combatant]),
  }));
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/combat/:combatantId/update", (req, res) => {
  const b = req.body;
  state.updateSlice(req.campaignId, "scene", (scene) => ({
    ...scene,
    initiative_order: scene.initiative_order.map((c) =>
      c.id === req.params.combatantId
        ? {
            ...c,
            hp_current: b.hp_current !== undefined ? Number(b.hp_current) : c.hp_current,
            conditions: b.conditions !== undefined ? b.conditions.split(",").map((s) => s.trim()).filter(Boolean) : c.conditions,
            is_hidden_from_players: b.is_hidden_from_players === "on",
          }
        : c
    ),
  }));
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/combat/:combatantId/remove", (req, res) => {
  state.updateSlice(req.campaignId, "scene", (scene) => {
    const order = scene.initiative_order.filter((c) => c.id !== req.params.combatantId);
    return {
      ...scene,
      initiative_order: order,
      current_turn_index: Math.min(scene.current_turn_index, Math.max(0, order.length - 1)),
    };
  });
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/combat/next-turn", (req, res) => {
  state.updateSlice(req.campaignId, "scene", (scene) => {
    if (!scene.initiative_order.length) return scene;
    const nextIndex = scene.current_turn_index + 1;
    const wrapped = nextIndex >= scene.initiative_order.length;
    return {
      ...scene,
      current_turn_index: wrapped ? 0 : nextIndex,
      round: wrapped ? scene.round + 1 : scene.round,
    };
  });
  res.redirect(`/campaigns/${req.campaignId}/play?role=dm`);
});

router.post("/play/message", async (req, res) => {
  const b = req.body;
  const role = b.role || "human";
  const message = {
    id: state.newId("msg"),
    timestamp: new Date().toISOString(),
    role,
    speaker_name: b.speaker_name || role,
    content: b.content || "",
    visibility: "public",
    declares_action: b.declares_action === "on",
  };
  state.updateSlice(req.campaignId, "play_log", (log) => [...log, message]);

  // Independent Player Loop instrumentation (see PLAYER_AGENT_v0.2.1.md "Learning /
  // Evaluation Signals"): count when the companion declares an action on its own,
  // rather than only reporting it narratively after the session.
  if (role === "companion" && message.declares_action) {
    state.updateSlice(req.campaignId, "metrics", (m) => ({
      ...m,
      player_agent: {
        ...m.player_agent,
        independent_action_declarations: m.player_agent.independent_action_declarations + 1,
      },
    }));
  }

  if (b.ask_agent) {
    const targetRole = b.ask_agent; // "dm" | "companion" | "lore"
    const full = state.loadCampaign(req.campaignId);
    const projected = projectState(full, targetRole);
    const history = full.play_log.slice(-20);
    const result = await callClaude({
      role: targetRole,
      projectedState: projected,
      history,
      userMessage: `[${message.speaker_name}] ${message.content}`,
      activeLearning: activeLearningFor(full, targetRole),
    });
    recordUsage(req.campaignId, { agentRole: targetRole, usage: result.usage });
    const reply = {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: targetRole,
      speaker_name: targetRole === "dm" ? "DM" : targetRole === "lore" ? "Lore" : full.characters.companion?.name || "Companion",
      content: result.ok ? result.text : `[agent bridge unavailable] ${result.reason}`,
      visibility: "public",
    };
    state.updateSlice(req.campaignId, "play_log", (log) => [...log, reply]);
  }

  res.redirect(`/campaigns/${req.campaignId}/play?role=${role}`);
});

router.post("/play/roll", (req, res) => {
  const b = req.body;
  const sides = Math.max(2, Number(b.sides) || 20);
  const count = Math.max(1, Math.min(10, Number(b.count) || 1));
  const modifier = Number(b.modifier) || 0;
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, r) => a + r, 0) + modifier;

  const entry = {
    id: state.newId("roll"),
    timestamp: new Date().toISOString(),
    role: b.role || "human",
    character: b.character || "",
    label: b.label || `${count}d${sides}${modifier ? (modifier > 0 ? "+" + modifier : modifier) : ""}`,
    rolls,
    modifier,
    total,
    dc: b.dc ? Number(b.dc) : null,
  };
  entry.outcome = entry.dc != null ? (total >= entry.dc ? "success" : "failure") : null;

  const message = {
    id: state.newId("msg"),
    timestamp: entry.timestamp,
    role: entry.role,
    speaker_name: b.character || entry.role,
    content: `🎲 ${entry.label} → [${rolls.join(", ")}]${modifier ? ` ${modifier > 0 ? "+" : ""}${modifier}` : ""} = ${total}${
      entry.dc != null ? ` vs DC ${entry.dc} — ${entry.outcome.toUpperCase()}` : ""
    }`,
    visibility: "public",
    is_roll: true,
  };
  state.updateSlice(req.campaignId, "play_log", (log) => [...log, message]);

  if (entry.role === "companion") {
    state.updateSlice(req.campaignId, "metrics", (m) => ({
      ...m,
      player_agent: {
        ...m.player_agent,
        companion_initiated_checks: m.player_agent.companion_initiated_checks + 1,
      },
    }));
  }

  res.redirect(`/campaigns/${req.campaignId}/play?role=${entry.role}`);
});

module.exports = router;
