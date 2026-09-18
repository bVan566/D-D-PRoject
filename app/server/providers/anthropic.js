// Anthropic Claude provider adapter.
//
// This is the ONLY file in the project that knows how to physically reach an AI
// backend -- the literal fetch() call, the request/response shape, the auth header.
// Everything above this (agents.js, and every route/view built on it) speaks only the
// generic shape exported here: chat({system, messages, maxTokens}) -> {ok, text, usage}.
//
// Swapping or adding a provider later (a different vendor, a self-hosted backend, a
// local model runtime) means writing one more file with this same {isConfigured, chat}
// shape and pointing providers/index.js at it -- never touching agents.js, routes, or
// views. That seam is the whole point of this file's existence.

const DEFAULT_MODEL = "claude-sonnet-5";

// Rough $/million-tokens, used only to estimate spend on the Usage panel during
// testing. Not fetched live -- check https://console.anthropic.com/settings/billing
// for current rates and override via .env if these drift.
const DEFAULT_INPUT_PRICE_PER_MTOK = Number(process.env.DUO_ENGINE_INPUT_PRICE_PER_MTOK) || 3;
const DEFAULT_OUTPUT_PRICE_PER_MTOK = Number(process.env.DUO_ENGINE_OUTPUT_PRICE_PER_MTOK) || 15;

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function chat({ system, messages, maxTokens = 4096, effort = "low" }) {
  if (!isConfigured()) {
    return {
      ok: false,
      reason:
        "No ANTHROPIC_API_KEY configured. Copy .env.example to .env, add your key, and " +
        "restart the server. Everything except live agent replies works without this.",
    };
  }
  const model = process.env.DUO_ENGINE_MODEL || DEFAULT_MODEL;
  // Sonnet 5 runs internal "adaptive thinking" on every call by default, and those
  // reasoning tokens are billed against the same max_tokens cap as the visible reply --
  // so max_tokens has to leave room for both, and output_config.effort is what actually
  // controls how much the model spends thinking rather than max_tokens alone.
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return { ok: false, reason: `Anthropic API error ${resp.status}: ${text.slice(0, 300)}` };
  }
  const data = await resp.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n").trim();
  const usage = data.usage
    ? { input_tokens: data.usage.input_tokens || 0, output_tokens: data.usage.output_tokens || 0 }
    : null;
  return { ok: true, text, usage, provider: "anthropic", model };
}

function estimateCostUsd(usage) {
  if (!usage) return null;
  return (
    (usage.input_tokens / 1_000_000) * DEFAULT_INPUT_PRICE_PER_MTOK +
    (usage.output_tokens / 1_000_000) * DEFAULT_OUTPUT_PRICE_PER_MTOK
  );
}

module.exports = { name: "anthropic", isConfigured, chat, estimateCostUsd };
