// Street-encounter table for one district. Rolled on Walk to another stamp. Higher
// district attention (0-3) weights away from "nothing" -- rumor is unaffected.

function encounterTable(attention) {
  return [
    { id: "nothing", weight: Math.max(2, 12 - 3 * attention), effect: "The street is quiet. Nothing happens." },
    { id: "shakedown", weight: 2 + attention, effect: "Local muscle leans on you for cash or goods." },
    { id: "rumor", weight: 4, effect: "Overhear something useful about a fixer or a job." },
    { id: "fight", weight: 2 + 2 * attention, effect: "Something jumps you. Resolve as a single check." },
  ];
}

function rollWeighted(rows) {
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const row of rows) {
    if (roll < row.weight) return row;
    roll -= row.weight;
  }
  return rows[rows.length - 1];
}

module.exports = { encounterTable, rollWeighted };
