// Single in-memory PC for the Slice 1 map UI -- no login, no persistence, one
// process-lifetime player. Matches the headless loop's single-PC model; this is not a
// new state system, just the same PC object kept alive across requests instead of
// created fresh per script run.

const { newPC } = require("./schema");
const { lockedSkillsFor } = require("./cards");

const ARCHETYPE_STATS = {
  Hacker: { body: 6, reflex: 8, tech: 12, mind: 10, cool: 6 },
};

const pc = newPC({
  archetype: "Hacker",
  stats: ARCHETYPE_STATS.Hacker,
  at_stamp: "safehouse_1",
  locked_skills: lockedSkillsFor("Hacker"),
});

function getPc() {
  return pc;
}

module.exports = { getPc };
