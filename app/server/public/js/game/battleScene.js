// FF-style battle: party on the right (as if viewed over their shoulders), enemies on
// the left, a menu when it's your turn. Deliberately simple rules for a first slice --
// one flat attack roll, no spells/items yet -- wired to real party HP/AC/abilities so a
// win or loss actually means something back on the map.

function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create(data) {
    this.playerPos = data.playerPos;
    this.log = ["A Deserter patrol blocks the path!"];
    this.awaitingInput = false;

    this.cameras.main.setBackgroundColor("#12101a");
    this.add.rectangle(0, 0, MAP_COLS * TILE, MAP_ROWS * TILE, 0x12101a).setOrigin(0);

    const roster = [data.party.human, ...data.party.companions].filter(Boolean);
    this.party = roster.map((member, i) => ({
      kind: "party",
      character_id: member.character_id,
      name: member.name,
      ac: member.ac,
      hp: member.hp.current,
      hpMax: member.hp.max,
      strMod: abilityMod(member.abilities && member.abilities.str),
      color: PARTY_COLORS[i % PARTY_COLORS.length],
      defending: false,
    }));

    this.enemies = ENEMY_TEMPLATES.map((t, i) => ({
      kind: "enemy",
      name: `${t.name} ${i + 1}`,
      ac: t.ac,
      hp: t.hp,
      hpMax: t.hp,
      attackBonus: t.attackBonus,
      damageDie: t.damageDie,
      damageBonus: t.damageBonus,
      color: t.color,
    }));

    this.buildBattlerRows(this.enemies, 90);
    this.buildBattlerRows(this.party, (MAP_COLS * TILE) - 90);

    this.logText = this.add.text(16, MAP_ROWS * TILE - 78, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#e9e4d8",
      wordWrap: { width: MAP_COLS * TILE - 32 },
    });
    this.menuContainer = this.add.container(0, 0);

    this.turnOrder = [];
    this.turnIndex = 0;
    this.startRound();
  }

  buildBattlerRows(list, x) {
    const spacing = 70;
    const top = ((MAP_ROWS * TILE) - 120 - spacing * (list.length - 1)) / 2;
    list.forEach((b, i) => {
      const y = top + i * spacing;
      b.container = this.add.container(x, y);
      const body = this.add.rectangle(0, 0, 40, 40, b.color);
      // Party sprites use an initial; enemies use a number, so two enemies whose names
      // start with the same letter (or an enemy that happens to share a party member's
      // initial) never render as visually identical labels.
      const glyph = b.kind === "party" ? b.name.charAt(0).toUpperCase() : String(i + 1);
      const label = this.add
        .text(0, 0, glyph, { fontFamily: "monospace", fontSize: "18px", color: "#0a0a0a" })
        .setOrigin(0.5);
      const nameText = this.add
        .text(0, 32, b.name, { fontFamily: "monospace", fontSize: "11px", color: "#e9e4d8" })
        .setOrigin(0.5, 0);
      b.container.add([body, label, nameText]);
      b.hpBarBg = this.add.rectangle(x, y - 32, 50, 6, 0x333333).setOrigin(0.5);
      b.hpBarFg = this.add.rectangle(x - 25, y - 32, 50, 6, 0x4f9e6b).setOrigin(0, 0.5);
      this.refreshHpBar(b);
    });
  }

  refreshHpBar(b) {
    const frac = Math.max(0, b.hp / b.hpMax);
    b.hpBarFg.width = 50 * frac;
    b.hpBarFg.fillColor = frac <= 0.33 ? 0xc0503f : 0x4f9e6b;
    if (b.hp <= 0) b.container.setAlpha(0.3);
  }

  pushLog(line) {
    this.log.push(line);
    this.log = this.log.slice(-5);
    this.logText.setText(this.log.join("\n"));
  }

  alive(list) {
    return list.filter((b) => b.hp > 0);
  }

  startRound() {
    this.turnOrder = [...this.alive(this.party), ...this.alive(this.enemies)];
    this.turnIndex = 0;
    this.nextTurn();
  }

  nextTurn() {
    if (this.checkBattleEnd()) return;
    if (this.turnIndex >= this.turnOrder.length) {
      this.startRound();
      return;
    }
    const actor = this.turnOrder[this.turnIndex];
    if (actor.hp <= 0) {
      this.turnIndex++;
      this.nextTurn();
      return;
    }
    if (actor.kind === "party") {
      this.showMenu(actor);
    } else {
      this.time.delayedCall(500, () => this.enemyAct(actor));
    }
  }

  showMenu(actor) {
    this.menuContainer.removeAll(true);
    const items = ["Attack", "Defend", "Flee"];
    const bg = this.add.rectangle(0, 0, 220, 100, 0x1d1c24, 0.95).setOrigin(0).setStrokeStyle(1, 0x34313f);
    this.menuContainer.add(bg);
    const title = this.add.text(10, 6, `${actor.name}'s turn`, { fontFamily: "monospace", fontSize: "12px", color: "#c9a24b" });
    this.menuContainer.add(title);
    items.forEach((label, i) => {
      const t = this.add
        .text(10, 28 + i * 22, label, { fontFamily: "monospace", fontSize: "14px", color: "#e9e4d8" })
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#c9a24b"));
      t.on("pointerout", () => t.setColor("#e9e4d8"));
      t.on("pointerdown", () => this.chooseAction(actor, label));
      this.menuContainer.add(t);
    });
    // Centered in the empty gap between the enemy and party columns, clear of both
    // battler sprites, their (fairly wide) name labels, and the log text at the bottom.
    this.menuContainer.setPosition((MAP_COLS * TILE) / 2 - 60, 110);
  }

  chooseAction(actor, action) {
    if (action === "Attack") {
      this.showTargets(actor);
      return;
    }
    this.menuContainer.removeAll(true);
    if (action === "Defend") {
      actor.defending = true;
      this.pushLog(`${actor.name} braces for the next hit.`);
    } else if (action === "Flee") {
      if (Math.random() < 0.5) {
        this.pushLog("The party disengages and retreats!");
        this.time.delayedCall(900, () => this.endBattle(false, true));
        return;
      }
      this.pushLog(`${actor.name} tries to flee but can't break away.`);
    }
    this.turnIndex++;
    this.time.delayedCall(500, () => this.nextTurn());
  }

  showTargets(actor) {
    this.menuContainer.removeAll(true);
    const targets = this.alive(this.enemies);
    const bg = this.add.rectangle(0, 0, 220, 30 + targets.length * 22, 0x1d1c24, 0.95).setOrigin(0).setStrokeStyle(1, 0x34313f);
    this.menuContainer.add(bg);
    const title = this.add.text(10, 6, "Target:", { fontFamily: "monospace", fontSize: "12px", color: "#c9a24b" });
    this.menuContainer.add(title);
    targets.forEach((enemy, i) => {
      const t = this.add
        .text(10, 28 + i * 22, enemy.name, { fontFamily: "monospace", fontSize: "14px", color: "#e9e4d8" })
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#c9a24b"));
      t.on("pointerout", () => t.setColor("#e9e4d8"));
      t.on("pointerdown", () => this.partyAttack(actor, enemy));
      this.menuContainer.add(t);
    });
  }

  partyAttack(actor, target) {
    this.menuContainer.removeAll(true);
    const roll = rollDie(20) + actor.strMod + 2;
    if (roll >= target.ac) {
      const dmg = Math.max(1, rollDie(6) + actor.strMod);
      target.hp = Math.max(0, target.hp - dmg);
      this.refreshHpBar(target);
      this.pushLog(`${actor.name} hits ${target.name} for ${dmg}.`);
    } else {
      this.pushLog(`${actor.name} attacks ${target.name} and misses.`);
    }
    this.turnIndex++;
    this.time.delayedCall(600, () => this.nextTurn());
  }

  enemyAct(enemy) {
    const targets = this.alive(this.party);
    if (!targets.length) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const roll = rollDie(20) + enemy.attackBonus;
    if (roll >= target.ac) {
      let dmg = rollDie(enemy.damageDie) + enemy.damageBonus;
      if (target.defending) dmg = Math.ceil(dmg / 2);
      target.hp = Math.max(0, target.hp - dmg);
      this.refreshHpBar(target);
      this.pushLog(`${enemy.name} hits ${target.name} for ${dmg}.`);
    } else {
      this.pushLog(`${enemy.name} attacks ${target.name} and misses.`);
    }
    target.defending = false;
    this.turnIndex++;
    this.time.delayedCall(600, () => this.nextTurn());
  }

  checkBattleEnd() {
    if (!this.alive(this.enemies).length) {
      this.pushLog("Victory! The path is clear.");
      this.time.delayedCall(1000, () => this.endBattle(true, false));
      return true;
    }
    if (!this.alive(this.party).length) {
      this.pushLog("The party is downed... and wakes battered, but alive.");
      this.party.forEach((p) => (p.hp = 1));
      this.time.delayedCall(1200, () => this.endBattle(false, false));
      return true;
    }
    return false;
  }

  async endBattle(won, fled) {
    this.menuContainer.removeAll(true);
    if (!fled) {
      const results = this.party.map((p) => ({ character_id: p.character_id, hp_current: p.hp }));
      try {
        await fetch(`/campaigns/${window.CAMPAIGN_ID}/game/battle-result`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ results }),
        });
        // Keep the in-page copy in sync too, so re-entering battle later uses the
        // HP that was actually just persisted rather than stale page-load data.
        this.party.forEach((p) => {
          if (window.PARTY_DATA.human && window.PARTY_DATA.human.character_id === p.character_id) {
            window.PARTY_DATA.human.hp.current = p.hp;
          }
          const comp = window.PARTY_DATA.companions.find((c) => c.character_id === p.character_id);
          if (comp) comp.hp.current = p.hp;
        });
      } catch (e) {
        console.error("Failed to persist battle result", e);
      }
    }
    this.scene.stop();
    this.scene.wake("MapScene", { playerPos: this.playerPos });
  }
}
