// Ruleset packs: the "stable core + genre delta" split discussed for supporting more
// than one setting (traditional fantasy, cyberpunk, etc.) on the same engine.
//
// The core resolution math never changes between packs (d20 + ability modifier vs. a
// target number, HP as a damage pool) -- that's already generic. What a pack actually
// changes is vocabulary: what the six abilities are called, what tone the AI narrates
// in, what nouns it reaches for (gold pieces vs. eurodollars, blades vs. firearms).
// Deeper mechanical deltas (a real action economy, advantage/disadvantage, per-genre
// subsystems like netrunning) are a bigger follow-on piece, not part of this pack
// mechanism yet -- see ASSESSMENT.md.
//
// Each pack is a plain JSON file in this folder; adding a new genre means adding one
// more file here, never touching agents.js, routes, or views.

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const DEFAULT_ID = "fantasy";

function listRulesets() {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")))
    .sort((a, b) => {
      if (a.id === DEFAULT_ID) return -1;
      if (b.id === DEFAULT_ID) return 1;
      return a.name.localeCompare(b.name);
    });
}

function getRuleset(id) {
  const all = listRulesets();
  return all.find((r) => r.id === id) || all.find((r) => r.id === DEFAULT_ID) || all[0];
}

module.exports = { listRulesets, getRuleset, DEFAULT_ID };
