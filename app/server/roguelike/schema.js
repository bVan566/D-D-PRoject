// Data model for the new cyberpunk roguelike loop -- Session / Floor / Node / Clock.
//
// This is a separate system beside the existing campaign/chat engine (state.js,
// agents.js, visibility.js), not a replacement or a wrapper around it. Nothing here
// reads or writes campaign slices, and nothing in the old system should come to depend
// on this module. Scope is deliberately narrow: these are the four schemas locked so
// far, as plain factory functions with the agreed Slice 1 defaults. No generation
// algorithm, no Director/move execution, no PC sheet, no residue writer, no
// persistence wiring -- those are separate, not-yet-built slices.

function newClock({ name, value = 0, max, convert_at = null, on_trigger }) {
  return { name, value, max, convert_at, on_trigger };
}

// Slice 1 has exactly two clocks, with fixed numbers -- not general-purpose config.
function newHeatClock() {
  return newClock({ name: "heat", max: 3, convert_at: 2, on_trigger: "force_scene" });
}

function newDebtClock() {
  return newClock({ name: "debt", max: 4, convert_at: null, on_trigger: "lock_shops" });
}

// type is fixed at generation and does not change identity even if the node later
// converts (Rest -> Combat at Heat.convert_at) -- original_type preserves what it was
// for residue, while type is read for all live resolution logic.
function newNode({ node_id, type, position, data = {}, convertible = false }) {
  return {
    node_id,
    type,
    original_type: type,
    convertible,
    position,
    cleared: false,
    data,
  };
}

function newFloor({ floor_id, floor_number, site_id, layout, nodes = [], is_climax = false }) {
  return {
    floor_id,
    floor_number,
    site_id,
    layout,
    nodes,
    exit_sealed: false,
    is_climax,
    status: "active",
  };
}

function newSession({
  session_id,
  seed,
  objective,
  act = 1,
  floors = [],
  encounter_budget = { used: 0, max: 8 },
  residue_in = null,
  payer,
  fail_burn,
}) {
  return {
    session_id,
    seed,
    genre_pack: "cyberpunk",
    template: "job",
    objective,
    act,
    floors,
    current_floor: 0,
    clocks: [newHeatClock(), newDebtClock()],
    encounter_budget,
    residue_in,
    payer,
    fail_burn,
    status: "active",
  };
}

module.exports = {
  newClock,
  newHeatClock,
  newDebtClock,
  newNode,
  newFloor,
  newSession,
};
