// Drives the optional race/class/dice-roll character-creation helpers. Does nothing
// (leaving the plain free-text fields as the only option) when the active campaign's
// ruleset pack doesn't define characterOptions yet -- e.g. Neon Sprawl doesn't have
// this content authored, so its character creation form stays free-text-only.
(function () {
  const opts = window.CHARACTER_OPTIONS;
  const abilityLabels = window.ABILITY_LABELS || { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
  const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
  if (!opts) return;

  const raceSelect = document.getElementById("race-select");
  const classSelect = document.getElementById("class-select");
  if (!raceSelect || !classSelect) return;

  const speciesHidden = document.getElementById("species-hidden");
  const classLevelHidden = document.getElementById("class-level-hidden");
  const raceTraitsEl = document.getElementById("race-traits");
  const classInfoEl = document.getElementById("class-info");
  const kitOptionsEl = document.getElementById("kit-options");
  const skillBoxEl = document.getElementById("skill-checkboxes");
  const skillHintEl = document.getElementById("skill-count-hint");
  const spellSectionEl = document.getElementById("spell-section");
  const spellBoxEl = document.getElementById("spell-checkboxes");
  const spellHintEl = document.getElementById("spell-count-hint");
  const rollBtn = document.getElementById("roll-btn");
  const rollPoolEl = document.getElementById("roll-pool");
  const acInput = document.querySelector('input[name="ac"]');
  const hpInput = document.querySelector('input[name="hp_max"]');
  const inventoryInput = document.querySelector('textarea[name="inventory"]');
  const speedInput = document.querySelector('input[name="speed"]');

  const abilityInputs = {};
  ABILITIES.forEach((a) => {
    abilityInputs[a] = document.querySelector(`input[name="${a}"]`);
  });

  let baseScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  let rolledPool = null;
  let assignment = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 };

  const raceById = (id) => opts.races.find((r) => r.id === id);
  const classById = (id) => opts.classes.find((c) => c.id === id);
  const currentRace = () => raceById(raceSelect.value);
  const currentClass = () => classById(classSelect.value);

  function conModifier() {
    const con = Number(abilityInputs.con ? abilityInputs.con.value : 10) || 10;
    return Math.floor((con - 10) / 2);
  }

  function updateHpSuggestion() {
    const cls = currentClass();
    if (!cls || !hpInput) return;
    hpInput.value = Math.max(1, cls.hitDie + conModifier());
  }

  function recomputeFinals() {
    const race = currentRace();
    const bonuses = (race && race.abilityBonuses) || {};
    ABILITIES.forEach((a) => {
      const final = (baseScores[a] || 10) + (bonuses[a] || 0);
      if (abilityInputs[a]) abilityInputs[a].value = final;
    });
    updateHpSuggestion();
  }

  function renderRacePicker() {
    raceSelect.innerHTML = "";
    opts.races.forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      raceSelect.appendChild(o);
    });
  }

  function renderClassPicker() {
    classSelect.innerHTML = "";
    opts.classes.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      classSelect.appendChild(o);
    });
  }

  function updateRaceInfo() {
    const race = currentRace();
    if (!race) return;
    if (speciesHidden) speciesHidden.value = race.name;
    if (raceTraitsEl) raceTraitsEl.textContent = race.traits.join(" ");
    if (speedInput) speedInput.value = race.speed;
    recomputeFinals();
  }

  function applyKit(kit) {
    if (inventoryInput) inventoryInput.value = kit.items.join("\n");
    if (acInput) acInput.value = kit.ac;
  }

  function renderKitOptions(cls) {
    if (!kitOptionsEl) return;
    kitOptionsEl.innerHTML = "";
    cls.kits.forEach((kit, i) => {
      const label = document.createElement("label");
      label.style.cssText = "display:block;font-weight:normal;margin-bottom:4px";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "kit-choice";
      radio.value = String(i);
      radio.style.cssText = "width:auto;display:inline-block;margin-right:6px";
      radio.addEventListener("change", () => applyKit(kit));
      label.appendChild(radio);
      label.appendChild(document.createTextNode(`${kit.name} — ${kit.items.join(", ")} (AC ~${kit.ac})`));
      kitOptionsEl.appendChild(label);
      if (i === 0) {
        radio.checked = true;
        applyKit(kit);
      }
    });
  }

  function enforceSkillLimit(count) {
    const boxes = skillBoxEl.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(boxes).filter((b) => b.checked);
    boxes.forEach((b) => {
      b.disabled = !b.checked && checked.length >= count;
    });
  }

  function renderSkillCheckboxes(cls) {
    if (!skillBoxEl) return;
    skillBoxEl.innerHTML = "";
    const count = cls.skillChoices.count;
    if (skillHintEl) skillHintEl.textContent = `(choose ${count})`;
    cls.skillChoices.from.forEach((skillKey) => {
      const skill = opts.skillList.find((s) => s.key === skillKey);
      if (!skill) return;
      const label = document.createElement("label");
      label.style.cssText = "display:block;font-weight:normal;margin-bottom:4px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = "skills";
      cb.value = skill.label;
      cb.style.cssText = "width:auto;display:inline-block;margin-right:6px";
      cb.addEventListener("change", () => enforceSkillLimit(count));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(`${skill.label} (${abilityLabels[skill.ability] || skill.ability})`));
      skillBoxEl.appendChild(label);
    });
  }

  function enforceSpellLimit(count) {
    const boxes = spellBoxEl.querySelectorAll('input[type="checkbox"]');
    const checked = Array.from(boxes).filter((b) => b.checked);
    boxes.forEach((b) => {
      b.disabled = !b.checked && checked.length >= count;
    });
  }

  function renderSpellCheckboxes(cls) {
    if (!spellBoxEl || !spellSectionEl) return;
    spellBoxEl.innerHTML = "";
    const kit = cls.combatKit;
    if (!kit || kit.type !== "spells") {
      spellSectionEl.style.display = "none";
      return;
    }
    spellSectionEl.style.display = "";
    const count = kit.spellChoices.count;
    if (spellHintEl) spellHintEl.textContent = `(choose ${count})`;
    kit.spellChoices.from.forEach((spell) => {
      const label = document.createElement("label");
      label.style.cssText = "display:block;font-weight:normal;margin-bottom:4px";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.name = "spells";
      cb.value = spell.id;
      cb.style.cssText = "width:auto;display:inline-block;margin-right:6px";
      cb.addEventListener("change", () => enforceSpellLimit(count));
      const desc =
        spell.effect === "heal"
          ? `heals ${spell.dieCount}d${spell.die}${spell.useMod ? " + casting modifier" : ""}`
          : `${spell.dieCount}d${spell.die}${spell.useMod ? " + casting modifier" : ""} damage${
              spell.effect === "damage_auto_hit" ? ", auto-hits" : ""
            }`;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(`${spell.name} — ${desc}`));
      spellBoxEl.appendChild(label);
    });
  }

  function updateClassInfo() {
    const cls = currentClass();
    if (!cls) return;
    if (classLevelHidden) classLevelHidden.value = `${cls.name} 1`;
    if (classInfoEl) {
      classInfoEl.textContent =
        `Hit die d${cls.hitDie} · primary ${cls.primaryAbility} · saves ${cls.savingThrows
          .map((a) => abilityLabels[a] || a)
          .join("/")}. ` + cls.features.join(" ");
    }
    renderKitOptions(cls);
    renderSkillCheckboxes(cls);
    renderSpellCheckboxes(cls);
    updateHpSuggestion();
  }

  function rollD6() {
    return 1 + Math.floor(Math.random() * 6);
  }
  function roll4d6DropLowest() {
    const rolls = [rollD6(), rollD6(), rollD6(), rollD6()].sort((a, b) => a - b);
    return rolls[1] + rolls[2] + rolls[3];
  }

  function renderAssignmentUI() {
    if (!rollPoolEl) return;
    rollPoolEl.innerHTML = "";
    const poolLine = document.createElement("p");
    poolLine.className = "hint";
    poolLine.textContent = "Rolled: " + rolledPool.join(", ") + " — assign each value to an ability below.";
    rollPoolEl.appendChild(poolLine);

    const grid = document.createElement("div");
    grid.className = "grid cols-3";
    ABILITIES.forEach((a) => {
      const wrap = document.createElement("label");
      wrap.textContent = abilityLabels[a] || a.toUpperCase();
      const sel = document.createElement("select");
      rolledPool.forEach((val, idx) => {
        const o = document.createElement("option");
        o.value = String(idx);
        o.textContent = val;
        sel.appendChild(o);
      });
      sel.value = String(assignment[a]);
      sel.addEventListener("change", () => onAssignChange(a, Number(sel.value)));
      wrap.appendChild(sel);
      grid.appendChild(wrap);
    });
    rollPoolEl.appendChild(grid);
  }

  function onAssignChange(ability, newIndex) {
    // Swap with whichever ability currently holds that pool index, so every rolled
    // value stays used exactly once instead of two abilities sharing one roll.
    const otherAbility = ABILITIES.find((a) => a !== ability && assignment[a] === newIndex);
    if (otherAbility) assignment[otherAbility] = assignment[ability];
    assignment[ability] = newIndex;
    ABILITIES.forEach((a) => {
      baseScores[a] = rolledPool[assignment[a]];
    });
    renderAssignmentUI();
    recomputeFinals();
  }

  function doRoll() {
    rolledPool = Array.from({ length: 6 }, roll4d6DropLowest);
    ABILITIES.forEach((a, i) => {
      assignment[a] = i;
      baseScores[a] = rolledPool[i];
    });
    renderAssignmentUI();
    recomputeFinals();
  }

  renderRacePicker();
  renderClassPicker();
  raceSelect.addEventListener("change", updateRaceInfo);
  classSelect.addEventListener("change", updateClassInfo);
  if (rollBtn) rollBtn.addEventListener("click", doRoll);

  updateRaceInfo();
  updateClassInfo();
})();
