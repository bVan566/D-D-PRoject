// job_site_1: the one authored Slice 1 site. 4 rooms, linear, no second floor.
// Data only -- not wired to any resolution logic yet (resolveNode.js or otherwise).
// Hall's "Back" is a special always-available action, not represented in exits[].

const JOB_SITE_1_ROOMS = [
  {
    id: "entrance",
    type: "event",
    dc: 12,
    one_line: "A locked latch bars the way. Hack it quiet, or Force it loud (district attention +1).",
    exits: ["hall"],
  },
  {
    id: "hall",
    type: "combat",
    dc: 12,
    one_line: "Sneak, Engage, or go Back. A failed Sneak still starts the fight.",
    exits: ["objective"],
  },
  {
    id: "objective",
    type: "event",
    dc: 12,
    one_line: "The thing you came for. Taking it completes the job once you leave.",
    exits: ["exit"],
  },
  {
    id: "exit",
    type: "exit",
    dc: null,
    one_line: "Back to the district. Payout follows.",
    exits: [],
  },
];

module.exports = { JOB_SITE_1_ROOMS };
