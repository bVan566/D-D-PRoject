// Optional live-agent bridge.
//
// The state/visibility/tracking layer in this app is fully functional without this
// file doing anything (that's the part the original package was missing). This module
// is a stretch add-on: if an ANTHROPIC_API_KEY is present in the environment, the DM /
// Player Agent / Lore "Ask" buttons on the play screen will call the real Anthropic API
// using system prompts assembled from the *existing* agent spec files in
// DnD_Duo_Engine_MVP_0.2/agents and /core, combined with a role-filtered state
// projection (never the full master state) and recent play-log history.
//
// This keeps the agent specs themselves as the single source of behavioral truth
// (nothing here reimplements DM/Player/Lore judgment) while fixing the one thing the
// spec-only version cannot guarantee: the Player Agent's model call is constructed
// from a payload that structurally excludes dm_private fields, rather than relying on
// the model to decline to use secrets sitting in its own context.
//
// Two additions on top of the original bridge:
//   - Active Learning injection: approved lessons (learning.json, status "active") are
//     fed into the relevant agent's own system prompt, separately from world-fact
//     visibility. This is a deliberate split from visibility.js: hidden *narrative*
//     information (secrets, motives) is a role-visibility question; an agent's own
//     performance coaching is a different question and should reach that agent even
//     when the UI hides the scoreboard from whoever's screen is currently showing that
//     role (see visibility.js projectMetrics for why the UI suppresses it there).
//   - reviewSession(): the automatic version of what Sessions 001/002 did by hand in
//     the original package (a human read the transcript and wrote a patch note). This
//     produces PROPOSED lessons only — per the project's own Controlled Learning Policy
//     ("changes that affect persistent guidance require human approval before becoming
//     durable"), nothing here is treated as durable until a human approves it in the UI.

const fs = require("fs");
const path = require("path");
const provider = require("./providers");

const ENGINE_DIR = path.join(__dirname, "..", "..", "DnD_Duo_Engine_MVP_0.2");

function readEngineFile(relPath) {
  try {
    return fs.readFileSync(path.join(ENGINE_DIR, relPath), "utf8");
  } catch (e) {
    return "";
  }
}

const ROLE_LOCK_MATRIX = readEngineFile("core/AGENT_ROLE_LOCK_MATRIX.md");

const SYSTEM_PROMPT_SOURCES = {
  dm: ["agents/DM_AGENT_v0.2.md"],
  companion: ["agents/PLAYER_AGENT_v0.2.1.md"],
  lore: ["agents/LORE_AGENT_v0.2.1.md"],
};

// Maps a UI role to the `agent` field used in learning.json entries, matching the
// vocabulary already used in the package's own CONTROLLED_LEARNING_POLICY.md /
// PERFORMANCE_METRICS.json ("dm", "player", "lore" sections).
const ROLE_TO_LEARNING_AGENT = { dm: "dm", companion: "player_agent", lore: "lore" };

const WORLDBUILDER_PERSONA = `
You are a creative world-building collaborator for an original tabletop RPG setting.
This is NOT the Lore Agent's in-session role — during actual play, Lore only records and
retrieves; it never invents. This is a separate, explicitly out-of-character workspace
where the human is deliberately co-creating setting material with you ahead of or
between sessions.

Here, you SHOULD: propose ideas, ask questions that sharpen the setting, offer options
and alternatives, riff on what the human gives you, and push back or flag inconsistency
when something contradicts material already committed to canon (shown below).

You should NOT: silently decide anything is now true. Nothing you say here is canon
until the human explicitly commits it through the "Commit to Canon" action — say so if
asked, and don't act as if a brainstormed idea is already established. Keep suggestions
clearly framed as suggestions.
`.trim();

// Everything below talks to `provider` (server/providers/index.js), never to a
// specific vendor's API directly -- that isolation is what lets a future backend swap
// skip this file's callers entirely. isConfigured/estimateCostUsd are thin pass-
// throughs so routes only ever need to import from agents.js, never from providers/.
const isConfigured = provider.isConfigured;
const estimateCostUsd = provider.estimateCostUsd;

function formatLearning(activeLearning) {
  if (!activeLearning || !activeLearning.length) return "";
  const lines = activeLearning.map(
    (l) => `- [${l.classification}] ${l.observation} → ${l.recommended_change}`
  );
  return [
    "---",
    "ACTIVE PERFORMANCE LEARNING (human-approved, from prior sessions of THIS campaign).",
    "This is coaching about how you've been playing, not campaign canon. It may improve",
    "execution inside your existing role; it may NOT expand your authority, reveal",
    "information you're not otherwise entitled to, or change who controls what.",
    lines.join("\n"),
  ].join("\n");
}

function formatActingAs(role, projectedState) {
  // A companion-role call's state projection now contains the WHOLE party's public
  // info (companions can perceive each other), but only one companion's private
  // thoughts (its own). Without this, nothing tells the model which single character
  // it is actually supposed to play versus merely perceive -- load-bearing the moment
  // there's more than one companion.
  if (role !== "companion" || !projectedState.companionId) return "";
  const mine = (projectedState.characters.companions || []).find(
    (c) => c.character_id === projectedState.companionId
  );
  if (!mine) return "";
  const others = (projectedState.characters.companions || [])
    .filter((c) => c.character_id !== projectedState.companionId)
    .map((c) => c.name);
  return [
    "---",
    `YOU ARE PLAYING: ${mine.name} (character_id: ${mine.character_id}) and ONLY this character.`,
    others.length
      ? `Other AI party members present (${others.join(", ")}) are their own independent players, not` +
        " yours to control, speak for, or decide for. You may react to them the way one party member" +
        " reacts to another -- you cannot see their private thoughts and shouldn't assume you know their intent."
      : "You are currently the only AI-controlled party member in this campaign.",
  ].join("\n");
}

function buildSystemPrompt(role, projectedState, activeLearning) {
  const sources = SYSTEM_PROMPT_SOURCES[role] || [];
  const specText = sources.map(readEngineFile).join("\n\n");
  const stateText = JSON.stringify(projectedState, null, 2);
  return [
    `You are acting as the ${role.toUpperCase()} agent in the D&D Duo Engine.`,
    ROLE_LOCK_MATRIX,
    specText,
    formatActingAs(role, projectedState),
    formatLearning(activeLearning),
    "---",
    "The JSON below is your ENTIRE view of campaign state. It has already been filtered",
    "to only what this role is permitted to see (see server/visibility.js). Do not",
    "invent information outside it; if something is not established, say so plainly.",
    "Stay strictly in role. Do not narrate or decide for the human player's character",
    "or for any other AI party member.",
    "---",
    `CURRENT STATE (role=${role}):`,
    stateText,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function callClaude({ role, projectedState, history, userMessage, activeLearning }) {
  const system = buildSystemPrompt(role, projectedState, activeLearning);
  const messages = [
    ...history.map((m) => ({
      role: m.role === role ? "assistant" : "user",
      content: `[${m.speaker_name || m.role}] ${m.content}`,
    })),
    { role: "user", content: userMessage },
  ];
  return provider.chat({ system, messages });
}

async function askWorldbuilder({ campaignTitle, canonSummary, history, userMessage }) {
  const system = [
    WORLDBUILDER_PERSONA,
    "---",
    `Campaign: ${campaignTitle}`,
    "Committed canon so far (for consistency — do not contradict this without flagging it):",
    canonSummary || "(nothing committed yet)",
  ].join("\n\n");
  const messages = [
    ...history.map((m) => ({
      role: m.role === "worldbuilder" ? "assistant" : "user",
      content: `[${m.speaker_name || m.role}] ${m.content}`,
    })),
    { role: "user", content: userMessage },
  ];
  return provider.chat({ system, messages });
}

const REVIEW_RUBRIC = `
Evaluate against these standards (drawn from the engine's own acceptance criteria):
DM: player agency preserved; no unnecessary rolls for obvious actions; failure moved
  the story forward rather than dead-ending it; did not control either PC; did not
  leak DM-private information.
PLAYER AGENT (companion): made independent choices without being prompted; declared
  actions rather than waiting passively; did not act on hidden information; showed
  believable imperfection (uncertainty, disagreement, a non-optimal choice) when the
  scene supported it; did not dominate the human player's scenes.
LORE: distinguished established fact from claim/belief; said "not established" rather
  than inventing; preserved visibility boundaries; did not steer the story.
`.trim();

async function reviewSession({ campaignTitle, sessionNumber, playLog, metrics }) {
  const system = [
    "You are a post-session reviewer for the D&D Duo Engine. Read the session transcript",
    "and produce PROPOSED lessons only — a human will approve or reject each one before it",
    "becomes durable guidance. This mirrors the project's own Controlled Learning Policy:",
    "learning may improve execution inside a role; it may never change role boundaries,",
    "information permissions, or authority.",
    REVIEW_RUBRIC,
    "---",
    "Respond with ONLY a JSON array (no prose, no markdown fences). Each element:",
    '{"agent": "dm" | "player_agent" | "lore", "observation": string, ' +
      '"classification": "single_session" | "recurring_pattern", "recommended_change": string}',
    "Produce at most 5 items. Only include a lesson if the transcript actually supports it;",
    "an empty array is a valid and often correct answer.",
  ].join("\n\n");

  const transcript = playLog
    .map((m) => `[${m.role}${m.speaker_name ? "/" + m.speaker_name : ""}] ${m.content}`)
    .join("\n");

  const messages = [
    {
      role: "user",
      content: [
        `Campaign: ${campaignTitle}, Session ${sessionNumber}`,
        `Independence metrics this session, per companion: ${JSON.stringify(metrics.player_agents)}`,
        "Transcript:",
        transcript || "(no play-log messages recorded for this session)",
      ].join("\n\n"),
    },
  ];

  const result = await provider.chat({ system, messages, maxTokens: 1000 });
  if (!result.ok) return result;
  try {
    const jsonText = result.text.replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return { ok: true, lessons: parsed, usage: result.usage };
  } catch (e) {
    return { ok: false, reason: `Could not parse reviewer output as JSON: ${e.message}`, raw: result.text };
  }
}

module.exports = {
  isConfigured,
  estimateCostUsd,
  buildSystemPrompt,
  callClaude,
  askWorldbuilder,
  reviewSession,
  ROLE_TO_LEARNING_AGENT,
};
