// A: resolves a Hazard or Event node against one PC, via the one resolution function.
// No UI, no menus -- that's the battle/action renderer, a separate, later slice.

const { check, abilityModifier } = require("./resolution");

function resolveNode(node, pc) {
  if (node.type === "hazard") {
    const { stat, dc } = node.data.save;
    const bonus = abilityModifier(pc.abilities[stat]);
    const { hit } = check(pc, bonus, dc, false);
    return hit
      ? { pass: true, effect: `${pc.name} avoids it.` }
      : { pass: false, effect: `${pc.name} ${node.data.effect}` };
  }

  if (node.type === "event") {
    // No selection UI exists yet, so the first choice is the only one reachable --
    // the battle/action renderer slice is what will let a player pick among choices.
    const choice = node.data.choices[0];
    const { stat, dc } = choice.roll;
    const bonus = abilityModifier(pc.abilities[stat]);
    const { hit } = check(pc, bonus, dc, false);
    return hit ? { pass: true, effect: choice.on_success } : { pass: false, effect: choice.on_fail };
  }

  throw new Error(`resolveNode only handles hazard/event nodes, got "${node.type}"`);
}

module.exports = { resolveNode };
