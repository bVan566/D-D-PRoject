// Procedural dungeon/map generation for the Play (Beta) roguelike mode. Classic
// "rooms and corridors" algorithm: scatter non-overlapping rectangular rooms, connect
// each to the next with an L-shaped corridor, scatter encounter tiles across the
// resulting floor. Deliberately plain and dependency-free -- no AI call, no cost, fast
// enough to regenerate on demand -- output is exactly the mapLayout string-array shape
// server/rulesets/*.json areas already use, so nothing downstream (data.js,
// mapScene.js, battleScene.js) needed to change to consume a generated map instead of a
// hand-authored one.

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function rectsOverlap(a, b, margin = 1) {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  );
}

function generateDungeonLayout({ width = 20, height = 14, roomCount = 6, encounterChance = 0.12 } = {}) {
  const grid = Array.from({ length: height }, () => Array(width).fill("#"));

  const carveRect = (x, y, w, h) => {
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        grid[ry][rx] = ".";
      }
    }
  };
  const carveH = (x1, x2, y) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) grid[y][x] = ".";
  };
  const carveV = (y1, y2, x) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) grid[y][x] = ".";
  };

  const rooms = [];
  let attempts = 0;
  while (rooms.length < roomCount && attempts < roomCount * 20) {
    attempts++;
    const w = randInt(3, 5);
    const h = randInt(3, 4);
    const x = randInt(1, width - w - 2);
    const y = randInt(1, height - h - 2);
    const candidate = { x, y, w, h };
    if (rooms.some((r) => rectsOverlap(candidate, r))) continue;
    rooms.push(candidate);
  }

  rooms.forEach((r) => carveRect(r.x, r.y, r.w, r.h));

  const center = (r) => ({ cx: Math.floor(r.x + r.w / 2), cy: Math.floor(r.y + r.h / 2) });
  for (let i = 1; i < rooms.length; i++) {
    const a = center(rooms[i - 1]);
    const b = center(rooms[i]);
    if (Math.random() < 0.5) {
      carveH(a.cx, b.cx, a.cy);
      carveV(a.cy, b.cy, b.cx);
    } else {
      carveV(a.cy, b.cy, a.cx);
      carveH(a.cx, b.cx, b.cy);
    }
  }

  // Scatter encounter tiles across floor tiles outside the starting room, so the
  // player always gets a few safe steps before the first possible fight.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] !== ".") continue;
      const inStartRoom = rooms[0] && x >= rooms[0].x && x < rooms[0].x + rooms[0].w && y >= rooms[0].y && y < rooms[0].y + rooms[0].h;
      if (!inStartRoom && Math.random() < encounterChance) grid[y][x] = '"';
    }
  }

  const startRoom = rooms[0] || { x: 1, y: 1, w: 1, h: 1 };
  const playerStart = { col: Math.floor(startRoom.x + startRoom.w / 2), row: Math.floor(startRoom.y + startRoom.h / 2) };

  return {
    mapLayout: grid.map((row) => row.join("")),
    playerStart,
  };
}

module.exports = { generateDungeonLayout };
