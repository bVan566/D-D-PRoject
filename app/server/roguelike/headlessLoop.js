// Headless Slice 1 loop: Map -> Fixer -> Walk (street table, real district attention)
// -> Site rooms (real job_site_1) -> Payout -> Safehouse. No UI -- console output only.
// Run with: node app/server/roguelike/headlessLoop.js (from the repo root).

const { newPC } = require("./schema");
const { lockedSkillsFor } = require("./cards");
const { STAMPS, walkTo, getAttention, addAttention } = require("./district");
const { newJob } = require("./job");
const { JOB_SITE_1_ROOMS } = require("./jobSite");
const { encounterTable, rollWeighted } = require("./streetTable");
const { check } = require("./resolution");
const { rankForRep } = require("./safehouse");

const ARCHETYPE_STATS = {
  Hacker: { body: 6, reflex: 8, tech: 12, mind: 10, cool: 6 },
};

function room(id) {
  return JOB_SITE_1_ROOMS.find((r) => r.id === id);
}

function printMap(pc) {
  const lines = STAMPS.map((s) => {
    const locked = s.kind !== "job_site" && s.locked_by_rep > 0 && pc.rep < s.locked_by_rep;
    const here = s.id === pc.at_stamp ? " <- here" : "";
    return `    ${s.id} (${s.kind}${locked ? ", locked" : ""})${here}`;
  });
  console.log("  Map:\n" + lines.join("\n"));
}

function resolveEntrance(pc, approach) {
  const r = room("entrance");
  for (;;) {
    const stat = approach === "force" ? pc.stats.body : pc.stats.tech;
    const result = check(pc, stat, r.dc, false);
    console.log(`    entrance (${approach}) roll ${result.roll}/${result.total} vs dc ${r.dc} -> ${result.hit ? "pass" : "fail"}`);
    if (result.hit) return;
    if (approach === "force") {
      const now = addAttention(1);
      console.log(`      Force fails but breaks the latch open loudly. District attention now ${now}.`);
      return;
    }
    console.log("      Hack fails quietly. Latch refuses -- try again.");
  }
}

function resolveHall(pc, choice) {
  const r = room("hall");
  if (choice === "engage") {
    const result = check(pc, pc.stats.reflex, r.dc, false);
    console.log(`    hall: Engage -> fight, roll ${result.roll}/${result.total} vs dc ${r.dc} -> ${result.hit ? "you win it" : "you take a beating"}`);
    return;
  }
  const result = check(pc, pc.stats.cool, r.dc, false);
  if (result.hit) {
    console.log(`    hall: Sneak roll ${result.roll}/${result.total} vs dc ${r.dc} -> pass, bypasses the fight`);
  } else {
    console.log(`    hall: Sneak roll ${result.roll}/${result.total} vs dc ${r.dc} -> fail, fight starts anyway`);
    const fight = check(pc, pc.stats.reflex, r.dc, false);
    console.log(`      fight roll ${fight.roll}/${fight.total} vs dc ${r.dc} -> ${fight.hit ? "you win it" : "you take a beating"}`);
  }
}

console.log("1. Title\n  (start)\n");

console.log("2. Archetype");
const archetype = "Hacker";
const pc = newPC({ archetype, stats: ARCHETYPE_STATS[archetype], at_stamp: "safehouse_1", locked_skills: lockedSkillsFor(archetype) });
console.log(`  PC: ${pc.archetype} | hp ${pc.hp} | neural ${pc.neural} | rep ${pc.rep}\n`);

console.log("3. Map (at_stamp)");
printMap(pc);
console.log();

console.log("4. Fixer (Take Job)");
const job = newJob({ id: "job_001", fixer_id: "fixer_1", site_stamp: "job_site_1", pay: 200, fail_burn: "The fixer's courier gets burned if you bail.", attention_risk: "low" });
job.status = "active";
pc.active_job_id = job.id;
walkTo(pc, STAMPS.find((s) => s.id === "fixer_1"), null);
console.log(`  job ${job.id} status=${job.status}, at_stamp=${pc.at_stamp}\n`);

console.log("5. Walk (street table, real district attention)");
const attentionNow = getAttention();
const row = rollWeighted(encounterTable(attentionNow));
console.log(`  Encounter roll (attention ${attentionNow}): ${row.id} -- ${row.effect}`);
if (row.id === "fight") {
  const result = check(pc, pc.stats.reflex, 12, false);
  console.log(`  Fight check: roll ${result.roll}/${result.total} vs dc 12 -> ${result.hit ? "you handle it clean" : "you take a knock"}`);
}
walkTo(pc, STAMPS.find((s) => s.id === "job_site_1"), job);
console.log(`  at_stamp=${pc.at_stamp}\n`);

console.log("6. Site rooms (job_site_1, real rooms)");
resolveEntrance(pc, "force");
resolveHall(pc, "engage");
console.log("    objective: you take the thing. Job is one step from complete.");
console.log(`    exit: leaving the site (district attention now ${getAttention()})\n`);

console.log("7. Payout (cash, Rep)");
job.status = "done";
pc.cash += job.pay;
pc.rep += 1; // placeholder, unchanged from earlier steps
pc.active_job_id = null;
console.log(`  PC.cash=${pc.cash}, PC.rep=${pc.rep}, PC.active_job_id=${pc.active_job_id}\n`);

console.log("8. Safehouse");
walkTo(pc, STAMPS.find((s) => s.id === "safehouse_1"), null);
const rankBefore = pc.home_rank;
const resolvedRank = rankForRep(pc.rep);
pc.home_rank = resolvedRank.rank;
console.log(`  at_stamp=${pc.at_stamp}, rep=${pc.rep} -> rank ${pc.home_rank} (unlocks: ${resolvedRank.unlocks.join(", ")})${pc.home_rank !== rankBefore ? " [RANK UP]" : ""}\n`);

console.log("-> back to Map (fixer_2 still locked, rep too low)");
printMap(pc);

console.log("\n--- Rep threshold demonstration ---");
console.log(`Attempting to walk to fixer_2 at rep=${pc.rep}:`, walkTo(pc, STAMPS.find((s) => s.id === "fixer_2"), null));
pc.rep = 10; // simulate enough completed jobs to cross the threshold
console.log(`Attempting to walk to fixer_2 at rep=${pc.rep}:`, walkTo(pc, STAMPS.find((s) => s.id === "fixer_2"), null));
printMap(pc);

console.log("\n--- Safehouse rank demonstration ---");
[0, 4, 8].forEach((rep) => {
  const r = rankForRep(rep);
  console.log(`  rep=${rep} -> rank ${r.rank} (unlocks: ${r.unlocks.join(", ")})`);
});
