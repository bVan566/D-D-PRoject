// Floor generation: 1-2 floors, 4-8 nodes each, types assigned at generation time (not
// by the Director later). Reuses the existing room-and-corridor grid generator
// (server/mapgen.js) for the walkable layout -- that algorithm is genre-agnostic and
// was already connectivity-tested, so it isn't rebuilt here.

const { generateDungeonLayout } = require("../mapgen");
const { newFloor, newNode } = require("./schema");

// Every non-climax floor gets exactly one Stairs down; only the climax floor also gets
// a Boss. These two are placed first and are never picked as filler.
const FILLER_TYPES = ["combat", "event", "shop", "rest", "story", "hazard"];

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function floorTilePositions(grid) {
  const positions = [];
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === ".") positions.push({ col: c, row: r });
    });
  });
  return positions;
}

function pickPositions(candidates, count, exclude) {
  const pool = candidates.filter((p) => !(p.col === exclude.col && p.row === exclude.row));
  const chosen = [];
  while (chosen.length < count && pool.length) {
    chosen.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return chosen;
}

function generateFloor({ floorNumber, siteId, isClimax = false }) {
  const { mapLayout, playerStart } = generateDungeonLayout();
  const guaranteedTypes = isClimax ? ["stairs", "boss"] : ["stairs"];
  const nodeCount = Math.max(guaranteedTypes.length, randInt(4, 8));
  const fillerCount = nodeCount - guaranteedTypes.length;
  const fillerTypes = Array.from({ length: fillerCount }, () => FILLER_TYPES[randInt(0, FILLER_TYPES.length - 1)]);
  const types = [...guaranteedTypes, ...fillerTypes];

  const positions = pickPositions(floorTilePositions(mapLayout), types.length, playerStart);

  const nodes = types.map((type, i) =>
    newNode({
      node_id: `${siteId}-f${floorNumber}-n${i}`,
      type,
      position: positions[i],
      // Rest is the only convertible type locked so far (Rest -> Combat at
      // Heat.convert_at); Stairs/Boss stay locked, everything else defaults false too.
      convertible: type === "rest",
    })
  );

  return newFloor({
    floor_id: `${siteId}-f${floorNumber}`,
    floor_number: floorNumber,
    site_id: siteId,
    layout: {
      width: mapLayout[0].length,
      height: mapLayout.length,
      grid: mapLayout,
      player_start: playerStart,
    },
    nodes,
    is_climax: isClimax,
  });
}

function generateSite({ siteId, floorCount = randInt(1, 2) } = {}) {
  const floors = [];
  for (let n = 1; n <= floorCount; n += 1) {
    floors.push(generateFloor({ floorNumber: n, siteId, isClimax: n === floorCount }));
  }
  return floors;
}

module.exports = { generateFloor, generateSite };
