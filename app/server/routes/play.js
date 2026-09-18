const express = require("express");
const state = require("../state");
const { projectState } = require("../visibility");
const { requireCampaign, resolveRole, resolveCompanionId } = require("../middleware");
const { callClaude, isConfigured, ROLE_TO_LEARNING_AGENT, extractSceneUpdate, isPass } = require("../agents");
const { recordUsage } = require("../usage");
const { getRuleset } = require("../rulesets");

function activeLearningFor(full, role) {
  const agent = ROLE_TO_LEARNING_AGENT[role];
  return (full.learning || []).filter((l) => l.agent === agent && l.status === "active");
}

const router = express.Router({ mergeParams: true });

router.use(requireCampaign);

router.get("/play", (req, res) => {
  const role = resolveRole(req);
  const full = state.loadCampaign(req.campaignId);
  const companionId = resolveCompanionId(req, full.characters.companions);
  const view = projectState(full, role, companionId);
  res.render("play", { view, role, companionId, llmConfigured: isConfigured(), campaignId: req.campaignId, active: "play" });
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
      if (next.human && next.human.name === c.name) {
        next.human = { ...next.human, hp: { current: c.hp_current, max: c.hp_max }, conditions: c.conditions };
      }
      next.companions = (next.companions || []).map((comp) =>
        comp.name === c.name ? { ...comp, hp: { current: c.hp_current, max: c.hp_max }, conditions: c.conditions } : comp
      );
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
  const companionId = role === "companion" ? b.companionId : undefined;
  const message = {
    id: state.newId("msg"),
    timestamp: new Date().toISOString(),
    role,
    character_id: companionId,
    speaker_name: b.speaker_name || role,
    content: b.content || "",
    visibility: "public",
    declares_action: b.declares_action === "on",
  };
  state.updateSlice(req.campaignId, "play_log", (log) => [...log, message]);

  // Independent Player Loop instrumentation (see PLAYER_AGENT_v0.2.1.md "Learning /
  // Evaluation Signals"): count when a companion declares an action on its own, per
  // companion -- so a multi-companion party's spotlight balance is visible per member.
  if (role === "companion" && companionId && message.declares_action) {
    state.updateSlice(req.campaignId, "metrics", (m) => ({
      ...m,
      player_agents: {
        ...m.player_agents,
        [companionId]: {
          ...m.player_agents[companionId],
          independent_action_declarations: (m.player_agents[companionId]?.independent_action_declarations || 0) + 1,
        },
      },
    }));
  }

  // ask_agent is "auto" (let the table respond naturally) | "dm" | "lore" |
  // "companion:<character_id>" -- a specific party member, since "ask the companion" is
  // ambiguous once there's more than one.
  if (b.ask_agent === "auto") {
    // A real tabletop turn isn't "human speaks, human manually names exactly one
    // responder" -- each companion gets a chance to react on its own judgment (and may
    // genuinely say nothing, see agents.js formatPassInstructions), then the DM goes
    // last and only steps in when the beat actually needs it (a ruling, a roll, moving
    // the scene forward). Re-reading state fresh before each call (rather than manually
    // threading a running history array) is what lets each later agent in the chain see
    // whatever earlier agents in this same chain already said -- the same "state is
    // cheap to re-read" pattern this whole app already relies on everywhere else.
    const continuePrompt = "(Continue the scene. React if you genuinely have something to add, or stay silent.)";

    const tryAgent = async (targetRole, targetCompanionId) => {
      const full = state.loadCampaign(req.campaignId);
      const projected = projectState(full, targetRole, targetCompanionId);
      const history = full.play_log.slice(-20);
      const result = await callClaude({
        role: targetRole,
        projectedState: projected,
        history,
        userMessage: continuePrompt,
        activeLearning: activeLearningFor(full, targetRole),
        ruleset: getRuleset(full.campaign.ruleset),
        allowPass: true,
      });
      recordUsage(req.campaignId, { agentRole: targetRole, usage: result.usage });
      if (!result.ok) {
        console.error(`Auto-chain ${targetRole} call failed:`, result.reason);
        return;
      }
      const { cleanText, sceneUpdate } = extractSceneUpdate(result.text);
      if (!cleanText || isPass(cleanText)) return;
      const speaker =
        targetRole === "dm" ? "DM" : full.characters.companions.find((c) => c.character_id === targetCompanionId)?.name || "Companion";
      const reply = {
        id: state.newId("msg"),
        timestamp: new Date().toISOString(),
        role: targetRole,
        character_id: targetRole === "companion" ? targetCompanionId : undefined,
        speaker_name: speaker,
        content: cleanText,
        visibility: "public",
      };
      state.updateSlice(req.campaignId, "play_log", (log) => [...log, reply]);
      if (sceneUpdate) {
        state.updateSlice(req.campaignId, "scene", (s) => ({
          ...s,
          location_name: sceneUpdate.location_name || s.location_name,
          description_public: sceneUpdate.description_public || s.description_public,
          environment: sceneUpdate.environment || s.environment,
        }));
      }
    };

    const companionRoster = state.readSlice(req.campaignId, "characters").companions || [];
    for (const companion of companionRoster) {
      await tryAgent("companion", companion.character_id);
    }
    await tryAgent("dm", undefined);
  } else if (b.ask_agent) {
    const [targetRole, targetCompanionId] = b.ask_agent.split(":");
    const full = state.loadCampaign(req.campaignId);
    const projected = projectState(full, targetRole, targetCompanionId);
    const history = full.play_log.slice(-20);
    const result = await callClaude({
      role: targetRole,
      projectedState: projected,
      history,
      userMessage: `[${message.speaker_name}] ${message.content}`,
      activeLearning: activeLearningFor(full, targetRole),
      ruleset: getRuleset(full.campaign.ruleset),
    });
    recordUsage(req.campaignId, { agentRole: targetRole, usage: result.usage });
    const speaker =
      targetRole === "dm"
        ? "DM"
        : targetRole === "lore"
        ? "Lore"
        : full.characters.companions.find((c) => c.character_id === targetCompanionId)?.name || "Companion";

    // Only the DM's system prompt ever asks for a trailing scene-state block (see
    // agents.js SCENE_STATE_INSTRUCTIONS) -- this is a no-op pass-through for every
    // other role, since the regex just won't match anything in their replies.
    const { cleanText, sceneUpdate } = result.ok
      ? extractSceneUpdate(result.text)
      : { cleanText: `[agent bridge unavailable] ${result.reason}`, sceneUpdate: null };

    const reply = {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: targetRole,
      character_id: targetRole === "companion" ? targetCompanionId : undefined,
      speaker_name: speaker,
      content: cleanText,
      visibility: "public",
    };
    state.updateSlice(req.campaignId, "play_log", (log) => [...log, reply]);

    // Keeps scene.location_name/description_public (and therefore which Play (Beta)
    // map area gets picked -- see routes/game.js pickArea) in sync with where the DM's
    // own narration says the party actually is, instead of only updating when someone
    // remembers to use the manual "Edit scene" form.
    if (sceneUpdate) {
      state.updateSlice(req.campaignId, "scene", (s) => ({
        ...s,
        location_name: sceneUpdate.location_name || s.location_name,
        description_public: sceneUpdate.description_public || s.description_public,
        environment: sceneUpdate.environment || s.environment,
      }));
    }
  }

  res.redirect(`/campaigns/${req.campaignId}/play?role=${role}${companionId ? `&companionId=${companionId}` : ""}`);
});

router.post("/play/roll", (req, res) => {
  const b = req.body;
  const companionId = b.role === "companion" ? b.companionId : undefined;
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
    character_id: companionId,
    speaker_name: b.character || entry.role,
    content: `🎲 ${entry.label} → [${rolls.join(", ")}]${modifier ? ` ${modifier > 0 ? "+" : ""}${modifier}` : ""} = ${total}${
      entry.dc != null ? ` vs DC ${entry.dc} — ${entry.outcome.toUpperCase()}` : ""
    }`,
    visibility: "public",
    is_roll: true,
  };
  state.updateSlice(req.campaignId, "play_log", (log) => [...log, message]);

  if (entry.role === "companion" && companionId) {
    state.updateSlice(req.campaignId, "metrics", (m) => ({
      ...m,
      player_agents: {
        ...m.player_agents,
        [companionId]: {
          ...m.player_agents[companionId],
          companion_initiated_checks: (m.player_agents[companionId]?.companion_initiated_checks || 0) + 1,
        },
      },
    }));
  }

  res.redirect(`/campaigns/${req.campaignId}/play?role=${entry.role}${companionId ? `&companionId=${companionId}` : ""}`);
});

module.exports = router;
