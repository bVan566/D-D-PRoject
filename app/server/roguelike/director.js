// The Director: after a node resolves, picks exactly one legal move from the locked
// list, using only session state. Rest's own conversion at Heat.convert_at is a
// separate, already-defined mechanism (checked where a node is about to be resolved,
// not here) -- this covers what happens once resolution is done. No narration, no LLM.

function pickMove(session) {
  const heat = session.clocks.find((c) => c.name === "heat");
  const debt = session.clocks.find((c) => c.name === "debt");

  if (heat.value >= heat.max) {
    return { move: "force_scene", note: "Heat maxed -- Force Scene" };
  }
  if (debt.value >= debt.max) {
    return { move: "lock_shops", note: "Debt maxed -- shops lock" };
  }

  const options = ["escalate_heat", "reveal", "offer_bargain", "none"];
  const choice = options[Math.floor(Math.random() * options.length)];

  if (choice === "escalate_heat") {
    heat.value = Math.min(heat.max, heat.value + 1);
    return { move: "escalate_heat", note: "Heat escalates" };
  }
  if (choice === "reveal") return { move: "reveal", note: "A clue surfaces" };
  if (choice === "offer_bargain") return { move: "offer_bargain", note: "A bargain is offered" };
  return { move: "none", note: "Nothing" };
}

// Force Scene's own state-gated menu -- fight is always legal; flee needs the floor's
// exit unsealed; next floor needs an uncleared Stairs node plus objective progress or
// climax. Locked in design before this slice; formalized here since Director is what
// calls it.
function forceSceneMenu(floor, objective) {
  const menu = ["fight"];
  if (!floor.exit_sealed) menu.push("flee");
  const stairsAvailable = floor.nodes.some((n) => n.type === "stairs" && !n.cleared);
  if (stairsAvailable && (objective.progress >= objective.target || floor.is_climax)) {
    menu.push("next floor");
  }
  return menu;
}

module.exports = { pickMove, forceSceneMenu };
