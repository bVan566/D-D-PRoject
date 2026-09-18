const state = require("./state");

function requireCampaign(req, res, next) {
  const id = req.params.id;
  if (!state.campaignExists(id)) {
    return res.status(404).render("not-found", { path: req.originalUrl });
  }
  req.campaignId = id;
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

module.exports = { requireCampaign, resolveRole };
