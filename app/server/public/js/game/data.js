// Shared constants for the map + battle scenes. Deliberately plain data, no engine
// code, so tweaking the map or the enemy roster never means touching scene logic.

const TILE = 32;

// #=wall .=floor "=tall grass (encounter risk) ~=water (impassable, decorative)
const MAP_LAYOUT = [
  "################",
  "#..............#",
  "#..............#",
  "#....\"\"\"\"......#",
  "#....\"\"\"\"...~~.#",
  "#..............#",
  "#.......##..~~.#",
  "#.......##.....#",
  "#..............#",
  "#..............#",
  "#..............#",
  "################",
];
const MAP_COLS = MAP_LAYOUT[0].length;
const MAP_ROWS = MAP_LAYOUT.length;
const PLAYER_START = { col: 2, row: 2 };

const TILE_COLORS = {
  "#": 0x2a2733,
  ".": 0x1f3d24,
  '"': 0x3a6b2e,
  "~": 0x1c3a52,
};
const IMPASSABLE = new Set(["#", "~"]);
const ENCOUNTER_TILE = '"';
const ENCOUNTER_CHANCE = 0.35;

// Distinct placeholder colors per party slot -- no art pipeline yet, so a labeled
// colored square stands in for a sprite until someone draws a real one.
const PARTY_COLORS = [0x3f7fb1, 0x4f9e6b, 0xc9a24b, 0x9a6fc9, 0xb1543f];

// Flavor pulled straight from the engine's own combat prep
// (DnD_Duo_Engine_MVP_0.2/campaign_001/DM_PRIVATE_CONTINUATION_TEST_002.txt) rather
// than invented fresh -- same world, same stat philosophy.
const ENEMY_TEMPLATES = [
  { name: "Deserter Skirmisher", hp: 16, ac: 13, attackBonus: 4, damageDie: 6, damageBonus: 2, color: 0xb1543f },
  { name: "Deserter Skirmisher", hp: 16, ac: 13, attackBonus: 4, damageDie: 6, damageBonus: 2, color: 0xb1543f },
];
