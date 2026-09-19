// Single seam a future provider swap goes through. Today there's exactly one
// implementation (Anthropic's Claude API, api.anthropic.com). Adding a second backend
// -- BYOK against a different vendor, a secure hosted backend the product operator
// runs, a local model runtime -- means writing another file under providers/ with the
// same {isConfigured, chat, estimateCostUsd} shape and choosing between them here
// (e.g. by an env var), without changing agents.js, any route, or any view.
module.exports = require("./anthropic");
