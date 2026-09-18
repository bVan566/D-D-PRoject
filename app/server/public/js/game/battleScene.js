// FF-style battle: party on the right (as if viewed over their shoulders), enemies on
// the left, a menu when it's your turn. Turn order is real 5e-style initiative (d20 +
// Dexterity modifier, rolled once per battle and held for the whole fight), and each
// party member's menu includes whatever their class actually grants -- a caster's
// chosen spells, or a martial class's one signature feature (Second Wind, Rage, Sneak
// Attack, etc.) -- on top of the universal Attack/Defend/Flee. Kept deliberately compact
// (flat per-battle use counts, no separate spell-slot/rest economy) to match the
// arcade-y pace of this first playable slice; wired to real party HP/AC/abilities so a
// win or loss still means something back on the map.

function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function rollDie(sides) {
  return 1 + Math.floor(Math.random() * sides);
}
function rollDice(count, sides, bonus = 0) {
  let total = bonus;
  for (let i = 0; i < count; i++) total += rollDie(sides);
  return Math.max(1, total);
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
  }

  create(data) {
    this.playerPos = data.playerPos;
    this.log = [ENCOUNTER_INTRO];
    this.awaitingInput = false;

    this.cameras.main.setBackgroundColor("#12101a");
    this.add.rectangle(0, 0, MAP_COLS * TILE, MAP_ROWS * TILE, 0x12101a).setOrigin(0);

    const classKits = window.CLASS_KITS || {};
    const roster = [data.party.human, ...data.party.companions].filter(Boolean);
    this.party = roster.map((member, i) => {
      const kit = classKits[member.class_id] || null;
      const castMod = kit && kit.type === "spells" ? abilityMod(member.abilities && member.abilities[kit.castingAbility]) : 0;
      const spellState =
        kit && kit.type === "spells"
          ? (member.spells || [])
              .map((id) => kit.spellChoices.from.find((s) => s.id === id))
              .filter(Boolean)
              .map((sp) => ({ ...sp, usesLeft: kit.usesPerSpellPerBattle }))
          : [];
      return {
        kind: "party",
        character_id: member.character_id,
        name: member.name,
        ac: member.ac,
        hp: member.hp.current,
        hpMax: member.hp.max,
        strMod: abilityMod(member.abilities && member.abilities.str),
        dexMod: abilityMod(member.abilities && member.abilities.dex),
        castMod,
        color: PARTY_COLORS[i % PARTY_COLORS.length],
        defending: false,
        raging: false,
        markedTarget: null,
        kit,
        spellState,
        featureUsesLeft: kit && kit.type === "feature" ? kit.feature.usesPerBattle : null,
      };
    });

    this.enemies = ENEMY_TEMPLATES.map((t, i) => ({
      kind: "enemy",
      name: `${t.name} ${i + 1}`,
      ac: t.ac,
      hp: t.hp,
      hpMax: t.hp,
      attackBonus: t.attackBonus,
      damageDie: t.damageDie,
      damageBonus: t.damageBonus,
      initiativeBonus: t.initiativeBonus ?? 2,
      color: t.color,
    }));

    this.buildBattlerRows(this.enemies, 90);
    this.buildBattlerRows(this.party, (MAP_COLS * TILE) - 90);

    // Real initiative: rolled once at the start of the fight and held for every round,
    // same as a tabletop encounter -- not re-rolled turn to turn.
    this.party.forEach((b) => (b.initiative = rollDie(20) + b.dexMod));
    this.enemies.forEach((b) => (b.initiative = rollDie(20) + b.initiativeBonus));
    this.turnOrderFixed = [...this.party, ...this.enemies].sort((a, b) => b.initiative - a.initiative);

    this.logText = this.add.text(16, MAP_ROWS * TILE - 78, "", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#e9e4d8",
      wordWrap: { width: MAP_COLS * TILE - 32 },
    });
    this.initiativeText = this.add.text(16, 6, "Initiative: " + this.turnOrderFixed.map((b) => b.name).join(" > "), {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#a49d8c",
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

  advanceTurn(delay = 600) {
    this.turnIndex++;
    this.time.delayedCall(delay, () => this.nextTurn());
  }

  startRound() {
    // Initiative order is fixed for the whole encounter -- each round just re-filters
    // it down to whoever's still standing, rather than rebuilding party-then-enemies.
    this.turnOrder = this.turnOrderFixed.filter((b) => b.hp > 0);
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

  // Generic "pick one of these battlers" menu, reused for Attack targets, spell
  // targets (enemy or ally depending on the spell), and feature targets alike.
  pickTarget(list, onPick) {
    this.menuContainer.removeAll(true);
    const bg = this.add.rectangle(0, 0, 220, 30 + list.length * 22, 0x1d1c24, 1).setOrigin(0).setStrokeStyle(1, 0x34313f);
    this.menuContainer.add(bg);
    const title = this.add.text(10, 6, "Target:", { fontFamily: "monospace", fontSize: "12px", color: "#c9a24b" });
    this.menuContainer.add(title);
    list.forEach((target, i) => {
      const t = this.add
        .text(10, 28 + i * 22, target.name, { fontFamily: "monospace", fontSize: "14px", color: "#e9e4d8" })
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#c9a24b"));
      t.on("pointerout", () => t.setColor("#e9e4d8"));
      t.on("pointerdown", () => onPick(target));
      this.menuContainer.add(t);
    });
  }

  showMenu(actor) {
    this.menuContainer.removeAll(true);
    const items = [{ label: "Attack", onSelect: () => this.pickTarget(this.alive(this.enemies), (t) => this.partyAttack(actor, t)) }];

    if (actor.kit && actor.kit.type === "spells") {
      actor.spellState.forEach((sp) => {
        if (sp.usesLeft > 0) {
          items.push({ label: `${sp.name} (${sp.usesLeft})`, onSelect: () => this.castSpell(actor, sp) });
        }
      });
    } else if (actor.kit && actor.kit.type === "feature" && actor.kit.feature.usesPerBattle !== null) {
      if (actor.featureUsesLeft > 0) {
        items.push({
          label: `${actor.kit.feature.name} (${actor.featureUsesLeft})`,
          onSelect: () => this.useFeature(actor),
        });
      }
    }

    items.push({
      label: "Defend",
      onSelect: () => {
        this.menuContainer.removeAll(true);
        actor.defending = true;
        this.pushLog(`${actor.name} braces for the next hit.`);
        this.advanceTurn(500);
      },
    });
    items.push({
      label: "Flee",
      onSelect: () => {
        this.menuContainer.removeAll(true);
        if (Math.random() < 0.5) {
          this.pushLog("The party disengages and retreats!");
          this.time.delayedCall(900, () => this.endBattle(false, true));
          return;
        }
        this.pushLog(`${actor.name} tries to flee but can't break away.`);
        this.advanceTurn(500);
      },
    });

    const bg = this.add.rectangle(0, 0, 220, 24 + items.length * 22, 0x1d1c24, 1).setOrigin(0).setStrokeStyle(1, 0x34313f);
    this.menuContainer.add(bg);
    const title = this.add.text(10, 6, `${actor.name}'s turn`, { fontFamily: "monospace", fontSize: "12px", color: "#c9a24b" });
    this.menuContainer.add(title);
    items.forEach((item, i) => {
      const t = this.add
        .text(10, 28 + i * 22, item.label, { fontFamily: "monospace", fontSize: "14px", color: "#e9e4d8" })
        .setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setColor("#c9a24b"));
      t.on("pointerout", () => t.setColor("#e9e4d8"));
      t.on("pointerdown", () => item.onSelect());
      this.menuContainer.add(t);
    });
    // Centered in the empty gap between the enemy and party columns, clear of both
    // battler sprites, their (fairly wide) name labels, and the log text at the bottom.
    this.menuContainer.setPosition((MAP_COLS * TILE) / 2 - 60, 110);
  }

  castSpell(actor, spell) {
    this.menuContainer.removeAll(true);
    spell.usesLeft -= 1;
    const pool = spell.targetType === "ally" ? this.alive(this.party) : this.alive(this.enemies);
    this.pickTarget(pool, (target) => this.resolveSpell(actor, spell, target));
  }

  resolveSpell(actor, spell, target) {
    this.menuContainer.removeAll(true);
    const mod = spell.useMod ? actor.castMod : 0;
    if (spell.effect === "heal") {
      const amt = rollDice(spell.dieCount, spell.die, mod);
      target.hp = Math.min(target.hpMax, target.hp + amt);
      this.refreshHpBar(target);
      this.pushLog(`${actor.name} casts ${spell.name} on ${target.name}, healing ${amt}.`);
    } else if (spell.effect === "damage_auto_hit") {
      const dmg = rollDice(spell.dieCount, spell.die, mod);
      target.hp = Math.max(0, target.hp - dmg);
      this.refreshHpBar(target);
      this.pushLog(`${actor.name} casts ${spell.name} at ${target.name} for ${dmg} (auto-hit).`);
    } else {
      const roll = rollDie(20) + actor.castMod + 2;
      if (roll >= target.ac) {
        const dmg = rollDice(spell.dieCount, spell.die, mod);
        target.hp = Math.max(0, target.hp - dmg);
        this.refreshHpBar(target);
        this.pushLog(`${actor.name} casts ${spell.name} at ${target.name} for ${dmg}.`);
      } else {
        this.pushLog(`${actor.name} casts ${spell.name} at ${target.name} and misses.`);
      }
    }
    this.advanceTurn();
  }

  useFeature(actor) {
    const f = actor.kit.feature;
    if (f.effect === "heal_self") {
      this.menuContainer.removeAll(true);
      actor.featureUsesLeft -= 1;
      const amt = rollDice(f.dieCount, f.die, f.bonus || 0);
      actor.hp = Math.min(actor.hpMax, actor.hp + amt);
      this.refreshHpBar(actor);
      this.pushLog(`${actor.name} uses ${f.name}, recovering ${amt} HP.`);
      this.advanceTurn();
    } else if (f.effect === "self_buff_rage") {
      this.menuContainer.removeAll(true);
      actor.featureUsesLeft -= 1;
      actor.raging = true;
      this.pushLog(`${actor.name} flies into a Rage!`);
      this.advanceTurn(500);
    } else if (f.effect === "mark_target") {
      this.pickTarget(this.alive(this.enemies), (target) => {
        this.menuContainer.removeAll(true);
        actor.featureUsesLeft -= 1;
        actor.markedTarget = target;
        this.pushLog(`${actor.name} marks ${target.name} as favored quarry.`);
        this.advanceTurn(500);
      });
    } else if (f.effect === "heal_ally_flat") {
      this.pickTarget(this.alive(this.party), (target) => {
        this.menuContainer.removeAll(true);
        actor.featureUsesLeft -= 1;
        target.hp = Math.min(target.hpMax, target.hp + f.amount);
        this.refreshHpBar(target);
        this.pushLog(`${actor.name} uses ${f.name} on ${target.name}, healing ${f.amount}.`);
        this.advanceTurn();
      });
    } else if (f.effect === "bonus_attack") {
      this.pickTarget(this.alive(this.enemies), (target) => {
        this.menuContainer.removeAll(true);
        actor.featureUsesLeft -= 1;
        const roll = rollDie(20) + actor.dexMod + 2;
        if (roll >= target.ac) {
          const dmg = rollDice(f.dieCount, f.die, 0);
          target.hp = Math.max(0, target.hp - dmg);
          this.refreshHpBar(target);
          this.pushLog(`${actor.name} follows up with ${f.name}, hitting ${target.name} for ${dmg}.`);
        } else {
          this.pushLog(`${actor.name}'s ${f.name} misses ${target.name}.`);
        }
        this.advanceTurn();
      });
    }
  }

  partyAttack(actor, target) {
    this.menuContainer.removeAll(true);
    const roll = rollDie(20) + actor.strMod + 2;
    if (roll >= target.ac) {
      let dmg = rollDie(6) + actor.strMod;
      let extra = "";
      // Sneak Attack is passive (usesPerBattle: null) -- it applies to every hit
      // automatically rather than costing a menu action.
      if (actor.kit && actor.kit.type === "feature" && actor.kit.feature.effect === "passive_attack_bonus_damage") {
        const bonus = rollDie(actor.kit.feature.die);
        dmg += bonus;
        extra += ` (+${bonus} ${actor.kit.feature.name})`;
      }
      if (actor.raging) {
        dmg += 2;
        extra += " (+2 Rage)";
      }
      if (actor.markedTarget === target) {
        const bonus = rollDie(6);
        dmg += bonus;
        extra += " (+" + bonus + " Favored Quarry)";
      }
      dmg = Math.max(1, dmg);
      target.hp = Math.max(0, target.hp - dmg);
      this.refreshHpBar(target);
      this.pushLog(`${actor.name} hits ${target.name} for ${dmg}${extra}.`);
    } else {
      this.pushLog(`${actor.name} attacks ${target.name} and misses.`);
    }
    this.advanceTurn();
  }

  enemyAct(enemy) {
    const targets = this.alive(this.party);
    if (!targets.length) return;
    const target = targets[Math.floor(Math.random() * targets.length)];
    const roll = rollDie(20) + enemy.attackBonus;
    if (roll >= target.ac) {
      let dmg = rollDie(enemy.damageDie) + enemy.damageBonus;
      if (target.defending) dmg = Math.ceil(dmg / 2);
      if (target.raging) dmg = Math.ceil(dmg / 2);
      target.hp = Math.max(0, target.hp - dmg);
      this.refreshHpBar(target);
      this.pushLog(`${enemy.name} hits ${target.name} for ${dmg}.`);
    } else {
      this.pushLog(`${enemy.name} attacks ${target.name} and misses.`);
    }
    target.defending = false;
    this.advanceTurn();
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
