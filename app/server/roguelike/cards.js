// Slice 1 skill-card deck: 6 shared (any archetype, if you have a slot) + 4 locked
// pairs (2 per archetype, always equipped, never swappable). Not a 60-skill tree.

const CARDS = [
  { id: "iron", name: "Iron", archetype: null, slot_ok: true, cost: 0, effect: "Shrug off some of the next hit's damage." },
  { id: "ghost", name: "Ghost", archetype: null, slot_ok: true, cost: 1, effect: "Slip past one hostile check unseen." },
  { id: "read_room", name: "Read Room", archetype: null, slot_ok: true, cost: 0, effect: "See one hidden detail in the current room before you act." },
  { id: "patch", name: "Patch", archetype: null, slot_ok: true, cost: 2, effect: "Patch yourself up for a handful of HP, right now." },
  { id: "low_pay_cut", name: "Low Pay Cut", archetype: null, slot_ok: true, cost: 0, effect: "Take a job at reduced pay in exchange for a lighter fail-burn." },
  { id: "hard_bargain", name: "Hard Bargain", archetype: null, slot_ok: true, cost: 0, effect: "Push a fixer to sweeten this job's payout once." },

  { id: "riposte", name: "Riposte", archetype: "Blade", slot_ok: false, cost: 0, effect: "After you're hit, strike back for free." },
  { id: "silent_cut", name: "Silent Cut", archetype: "Blade", slot_ok: false, cost: 1, effect: "Bonus damage against a target that hasn't acted yet." },

  { id: "node_tap", name: "Node Tap", archetype: "Hacker", slot_ok: false, cost: 1, effect: "Read or disable one nearby electronic lock or camera." },
  { id: "trace_wipe", name: "Trace Wipe", archetype: "Hacker", slot_ok: false, cost: 2, effect: "Scrub this job's trail, cutting the district attention it left." },

  { id: "vein_seal", name: "Vein Seal", archetype: "Technomage", slot_ok: false, cost: 2, effect: "Ward off one Vein effect aimed at you this scene." },
  { id: "siphon", name: "Siphon", archetype: "Technomage", slot_ok: false, cost: 0, effect: "Drain a Vein source nearby to refill some of your own Neural." },

  { id: "ghost_protocol", name: "Ghost Protocol", archetype: "Operator", slot_ok: false, cost: 1, effect: "Cut this job's fail-burn consequence in half if it goes bad." },
  { id: "cargo_veil", name: "Cargo Veil", archetype: "Operator", slot_ok: false, cost: 1, effect: "Hide what you're carrying from a shakedown check." },
];

function lockedSkillsFor(archetype) {
  return CARDS.filter((c) => c.archetype === archetype).map((c) => c.id);
}

module.exports = { CARDS, lockedSkillsFor };
