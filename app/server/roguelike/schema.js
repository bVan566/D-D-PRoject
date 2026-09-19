// PC schema for "Under the Slate". One PC, one archetype, five stats. This replaces
// the pre-pivot Session/Floor/Node/Clock/PC schema entirely -- Heat/Debt-as-campaign
// is dead and is not carried forward as a source of truth anywhere in this file.

const ARCHETYPES = ["Blade", "Hacker", "Technomage", "Operator"];

// Slice 1 formulas, locked: single stat per archetype, flat archetype bonus on HP only.
function maxHp(pc) {
  return 8 + pc.stats.body + (pc.archetype === "Blade" ? 2 : 0);
}

function maxNeural(pc) {
  if (pc.archetype === "Blade") return 4 + pc.stats.tech;
  if (pc.archetype === "Technomage") return 6 + pc.stats.mind;
  return 6 + pc.stats.tech; // Hacker, Operator
}

// hp/neural store current value only -- max is always derived, never persisted.
function newPC({
  archetype,
  stats,
  cash = 0,
  rep = 0,
  home_rank = 0,
  active_job_id = null,
  at_stamp = null,
  skill_slots = 2,
  locked_skills = [],
  equipped_cards = [],
}) {
  const pc = {
    archetype,
    stats,
    cash,
    rep,
    home_rank,
    active_job_id,
    at_stamp,
    skill_slots,
    locked_skills,
    equipped_cards,
  };
  pc.hp = maxHp(pc);
  pc.neural = maxNeural(pc);
  return pc;
}

module.exports = { ARCHETYPES, newPC, maxHp, maxNeural };
