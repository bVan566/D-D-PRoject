const state = require("./state");
const { getRuleset } = require("./rulesets");

// Turns a ruleset pack's theme block into a small :root override, so a campaign's
// chosen genre pack changes how the page actually looks (palette, font) and not just
// how the AI narrates. Values come only from our own bundled ruleset JSON files, never
// from user input, so writing them straight into a <style> tag is safe.
function themeCssFor(ruleset) {
  const t = ruleset && ruleset.theme;
  if (!t) return "";
  return (
    `:root{--bg:${t.bg};--bg-raised:${t.bgRaised};--bg-card:${t.bgCard};--border:${t.border};` +
    `--text:${t.text};--text-dim:${t.textDim};--accent:${t.accent};--accent-soft:${t.accentSoft};}` +
    `body{font-family:${t.font};}`
  );
}

function requireCampaign(req, res, next) {
  const id = req.params.id;
  if (!state.campaignExists(id)) {
    return res.status(404).render("not-found", { path: req.originalUrl });
  }
  req.campaignId = id;
  // Available to every view's nav bar without every route handler having to pass it
  // explicitly -- this engine is meant to run any campaign, not just the Greymark Road
  // demo, so the nav can't hardcode character names or assume exactly one companion.
  const characters = state.readSlice(id, "characters");
  res.locals.humanName = characters.human?.name || "Human PC";
  res.locals.companions = (characters.companions || []).map((c) => ({
    character_id: c.character_id,
    name: c.name,
  }));
  const campaign = state.readSlice(id, "campaign");
  res.locals.themeCss = themeCssFor(getRuleset(campaign.ruleset));
  next();
}

// Which "seat" is currently looking at the screen. Defaults to dm for convenience
// when running solo, but every screen exposes a role switcher because the whole point
// is that each seat sees a different, server-filtered slice of the same campaign.
function resolveRole(req) {
  const role = req.query.role || req.body.role || req.cookies?.role;
  const valid = ["dm", "human", "companion", "lore"];
  return valid.includes(role) ? role : "dm";
}

// Which specific companion a "companion" role request is speaking for. A party can
// have more than one, so role=companion alone is ambiguous -- this resolves (and
// validates against the campaign's actual party) which one. Falls back to the first
// companion if the requested id doesn't exist in this campaign, rather than erroring:
// a stale link to a removed companion shouldn't break the page, just show a
// still-correctly-scoped different seat.
function resolveCompanionId(req, companions) {
  const requested = req.query.companionId || req.body.companionId;
  if (requested && companions.some((c) => c.character_id === requested)) return requested;
  return companions.length ? companions[0].character_id : null;
}

module.exports = { requireCampaign, resolveRole, resolveCompanionId };
