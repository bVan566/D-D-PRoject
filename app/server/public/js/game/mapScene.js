// Grid-based overworld: arrow keys/WASD move the leader one tile at a time, companions
// trail behind in a follow-the-leader chain (the same trick Chrono Trigger/FF used),
// and walking onto a tall-grass tile has a chance to start a battle. No image assets --
// every "sprite" here is a colored rectangle plus a text label, on purpose, until the
// gameplay loop itself is proven fun.

class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  create(data) {
    this.moveCooldown = 0;
    this.tiles = MAP_LAYOUT.map((row) => row.split(""));

    // Draw the map once; tiles never change, so plain rectangles are enough.
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const ch = this.tiles[row][col];
        this.add
          .rectangle(col * TILE + TILE / 2, row * TILE + TILE / 2, TILE - 1, TILE - 1, TILE_COLORS[ch] ?? 0x000000)
          .setOrigin(0.5);
      }
    }

    // Party chain: index 0 is the leader (the human PC); everyone else trails behind.
    const roster = [window.PARTY_DATA.human, ...window.PARTY_DATA.companions].filter(Boolean);
    if (!roster.length) {
      this.add
        .text(MAP_COLS * TILE / 2, MAP_ROWS * TILE / 2, "No characters yet.\nCreate a human PC and at least\none companion before playing.", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#e9e4d8",
          align: "center",
        })
        .setOrigin(0.5);
      this.party = [];
      return;
    }
    const start = (data && data.playerPos) || PLAYER_START;
    // Stagger the starting file in marching order (leader, then each companion behind)
    // rather than stacking everyone on the same tile -- otherwise the last one added
    // simply renders on top and it looks like the rest of the party is missing.
    this.trail = [];
    for (let i = 1; i < roster.length; i++) this.trail.push({ col: start.col, row: start.row + i });
    this.party = roster.map((member, i) => {
      const col = i === 0 ? start.col : this.trail[i - 1].col;
      const row = i === 0 ? start.row : this.trail[i - 1].row;
      const container = this.add.container(col * TILE + TILE / 2, row * TILE + TILE / 2);
      const body = this.add.rectangle(0, 0, TILE - 8, TILE - 8, PARTY_COLORS[i % PARTY_COLORS.length]);
      const label = this.add
        .text(0, 0, member.name.charAt(0).toUpperCase(), { fontFamily: "monospace", fontSize: "16px", color: "#0a0a0a" })
        .setOrigin(0.5);
      container.add([body, label]);
      return { member, container, col, row };
    });

    this.cameras.main.setBackgroundColor("#0e1420");

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    this.statusText = this.add
      .text(6, 6, window.PARTY_DATA.human ? "" : "No human PC yet -- create one first.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#e9e4d8",
        backgroundColor: "#000000aa",
      })
      .setScrollFactor(0);
  }

  passable(col, row) {
    if (col < 0 || row < 0 || col >= MAP_COLS || row >= MAP_ROWS) return false;
    return !IMPASSABLE.has(this.tiles[row][col]);
  }

  tryMove(dx, dy) {
    const leader = this.party[0];
    const nextCol = leader.col + dx;
    const nextRow = leader.row + dy;
    if (!this.passable(nextCol, nextRow)) return;

    this.trail.unshift({ col: leader.col, row: leader.row });
    this.trail.length = Math.min(this.trail.length, this.party.length);

    leader.col = nextCol;
    leader.row = nextRow;
    leader.container.setPosition(nextCol * TILE + TILE / 2, nextRow * TILE + TILE / 2);

    for (let i = 1; i < this.party.length; i++) {
      const pos = this.trail[i - 1];
      if (!pos) continue;
      this.party[i].col = pos.col;
      this.party[i].row = pos.row;
      this.party[i].container.setPosition(pos.col * TILE + TILE / 2, pos.row * TILE + TILE / 2);
    }

    const tile = this.tiles[nextRow][nextCol];
    if (tile === ENCOUNTER_TILE && Math.random() < ENCOUNTER_CHANCE) {
      this.startBattle();
    }
  }

  startBattle() {
    const leader = this.party[0];
    this.scene.sleep();
    this.scene.launch("BattleScene", {
      playerPos: { col: leader.col, row: leader.row },
      party: window.PARTY_DATA,
    });
  }

  update(time, delta) {
    if (!this.party.length) return;
    this.moveCooldown -= delta;
    if (this.moveCooldown > 0) return;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = 1;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy);
      this.moveCooldown = 140; // ms between steps -- fast enough to feel responsive, slow enough to stay on-grid
    }
  }
}
