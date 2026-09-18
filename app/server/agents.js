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

const fs = require("fs");
const path = require("path");

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

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildSystemPrompt(role, projectedState) {
  const sources = SYSTEM_PROMPT_SOURCES[role] || [];
  const specText = sources.map(readEngineFile).join("\n\n");
  const stateText = JSON.stringify(projectedState, null, 2);
  return [
    `You are acting as the ${role.toUpperCase()} agent in the D&D Duo Engine.`,
    ROLE_LOCK_MATRIX,
    specText,
    "---",
    "The JSON below is your ENTIRE view of campaign state. It has already been filtered",
    "to only what this role is permitted to see (see server/visibility.js). Do not",
    "invent information outside it; if something is not established, say so plainly.",
    "Stay strictly in role. Do not narrate or decide for the human player's character.",
    "---",
    `CURRENT STATE (role=${role}):`,
    stateText,
  ].join("\n\n");
}

async function callClaude({ role, projectedState, history, userMessage }) {
  if (!isConfigured()) {
    return {
      ok: false,
      reason:
        "No ANTHROPIC_API_KEY configured in this environment. Live agent replies are " +
        "disabled; use the play log to record moves manually (e.g. while narrating via " +
        "a separate Claude conversation) or set ANTHROPIC_API_KEY and restart the server.",
    };
  }
  const system = buildSystemPrompt(role, projectedState);
  const messages = [
    ...history.map((m) => ({
      role: m.role === role ? "assistant" : "user",
      content: `[${m.speaker_name || m.role}] ${m.content}`,
    })),
    { role: "user", content: userMessage },
  ];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.DUO_ENGINE_MODEL || "claude-sonnet-5",
      max_tokens: 700,
      system,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, reason: `Anthropic API error ${resp.status}: ${text.slice(0, 300)}` };
  }
  const data = await resp.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  return { ok: true, text };
}

module.exports = { isConfigured, buildSystemPrompt, callClaude };
