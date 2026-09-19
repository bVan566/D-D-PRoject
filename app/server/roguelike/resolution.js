// The one resolution function for the roguelike loop. Strike and Hack are not separate
// systems -- both are just this check with a different bonus and DC. Damage/effect is
// whatever the caller does with a hit; this function does not know about damage.

function rollD20() {
  return 1 + Math.floor(Math.random() * 20);
}

// actor is accepted but not read here -- callers pass it through so a result can be
// attributed (logging, residue) without changing this signature later.
function check(actor, bonus, dc, advantage = false) {
  const first = rollD20();
  const second = advantage ? rollD20() : null;
  const roll = second === null ? first : Math.max(first, second);
  const crit = roll === 20;
  const fumble = roll === 1;
  const total = roll + bonus;
  const hit = crit ? true : fumble ? false : total >= dc;
  return { roll, total, hit, crit, fumble };
}

// Standard 5e ability-score-to-modifier math -- needed to turn a PC's raw ability
// score into the bonus check() takes. Not a new system, just the one conversion any
// caller of check() needs.
function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

module.exports = { check, abilityModifier };
