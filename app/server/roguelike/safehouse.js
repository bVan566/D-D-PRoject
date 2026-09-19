// Safehouse ranks, gated by Rep. No decoration -- just thresholds and what they unlock.

const RANKS = [
  { rank: 1, rep_required: 0, unlocks: ["cot", "small_stash", "skill_swap"] },
  { rank: 2, rep_required: 4, unlocks: ["bench_slot"] },
  { rank: 3, rep_required: 8, unlocks: ["board_slot"] },
];

function rankForRep(rep) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (rep >= r.rep_required) current = r;
  }
  return current;
}

module.exports = { RANKS, rankForRep };
