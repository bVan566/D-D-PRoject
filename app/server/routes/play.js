const express = require("express");
const state = require("../state");
const { projectState } = require("../visibility");
const { requireCampaign, resolveRole } = require("../middleware");
const { callClaude, isConfigured } = require("../agents");

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
    });
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
