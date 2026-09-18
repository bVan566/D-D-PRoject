// Connects "an AI call happened" to "here's what it cost" -- deliberately its own tiny
// module rather than folded into agents.js (which only knows how to talk to an AI) or
// state.js (generic persistence, no provider knowledge). Routes call recordUsage()
// after any agents.js call that returns a `usage` field.

const state = require("./state");
const { estimateCostUsd } = require("./agents");

function recordUsage(campaignId, { agentRole, usage }) {
  if (!usage) return;
  const entry = {
    id: state.newId("usage"),
    timestamp: new Date().toISOString(),
    agent_role: agentRole,
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    estimated_cost_usd: estimateCostUsd(usage),
  };
  state.updateSlice(campaignId, "usage", (list) => [...list, entry]);
}

function summarize(usageList) {
  const summary = {
    calls: usageList.length,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: 0,
    by_role: {},
  };
  for (const u of usageList) {
    summary.input_tokens += u.input_tokens;
    summary.output_tokens += u.output_tokens;
    summary.estimated_cost_usd += u.estimated_cost_usd || 0;
    summary.by_role[u.agent_role] = (summary.by_role[u.agent_role] || 0) + 1;
  }
  return summary;
}

module.exports = { recordUsage, summarize };
