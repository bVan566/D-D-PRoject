// Shared constants for the map + battle scenes, derived from the active campaign's
// ruleset pack (window.GAME_CONTENT, embedded by game.ejs from server/rulesets/*.json
// "game" block) rather than hardcoded here. This is what makes a fantasy campaign's
// map/enemies look and feel different from a cyberpunk one's: mapScene.js and
// battleScene.js only ever reference the constant names below, never the ruleset pack
// directly, so a new genre pack's map/tiles/enemies reach the game without touching
// either scene's logic -- the same "core engine, genre delta" split the AI narration
// and character sheet already use.

const TILE = 32;

function hexToPhaserColor(hex) {
  return parseInt(String(hex).replace("#", ""), 16);
}

const GC = window.GAME_CONTENT || {};

// #=wall .=floor "=encounter risk ~=impassable/decorative -- meaning of each symbol is
// fixed by the engine; what each one looks like and where they sit is per-ruleset.
const MAP_LAYOUT = GC.mapLayout || ["################", "#..............#", "################"];
const MAP_COLS = MAP_LAYOUT[0].length;
const MAP_ROWS = MAP_LAYOUT.length;
const PLAYER_START = GC.playerStart || { col: 1, row: 1 };

const TILE_COLORS = Object.fromEntries(
  Object.entries(GC.tileColors || {}).map(([k, v]) => [k, hexToPhaserColor(v)])
);
const IMPASSABLE = new Set(GC.impassableTiles || ["#"]);
const ENCOUNTER_TILE = GC.encounterTile || '"';
const ENCOUNTER_CHANCE = typeof GC.encounterChance === "number" ? GC.encounterChance : 0.35;
const ENCOUNTER_INTRO = GC.encounterIntro || "Something blocks the path!";

// Distinct placeholder colors per party slot -- no art pipeline yet, so a labeled
// colored square stands in for a sprite until someone draws a real one.
const PARTY_COLORS = (GC.partyColors || ["#3f7fb1", "#4f9e6b", "#c9a24b", "#9a6fc9", "#b1543f"]).map(
  hexToPhaserColor
);

const ENEMY_TEMPLATES = (GC.enemyTemplates || []).map((t) => ({ ...t, color: hexToPhaserColor(t.color) }));
