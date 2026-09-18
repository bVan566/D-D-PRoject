# D&D Duo Engine — Visual UI Prototype

A functional web UI for the D&D Duo Engine defined in `../DnD_Duo_Engine_MVP_0.2/`.
This does not reimplement the DM / Player / Lore agents — their behavior still comes
from the existing spec files under `DnD_Duo_Engine_MVP_0.2/agents/`. What this app adds
is everything the spec-only package didn't have: a real datastore matching the
project's own `CAMPAIGN-STATE SCHEMA`, character sheets, dice, quest/lore/relationship
tracking, save/resume, and — the main point — **server-side role-filtered views**, so
"the Player Agent doesn't see DM-only information" is enforced by the backend rather
than by the model choosing not to look.

The party isn't fixed at one companion. A campaign can have zero, one, or several
AI-controlled party members, each with its own seat, its own private beliefs/fears, and
its own independence metrics — not shared with the others, not even with each other
(see "Party of more than one" below).

There's also a first small step toward an actual game rather than a web app about a
game: `/campaigns/:id/game`, a top-down tile map you walk around on with real party
sprites, where wandering into danger cuts to an FF-style turn-based battle screen wired
to the same character HP/AC/abilities as everything else (see "Play (Beta)" below).

## Run it

```bash
npm install
node server/seed.js   # populates a demo campaign from the real Campaign 001 data
npm start              # http://localhost:4173
```

Runs entirely locally -- no account, no cloud dependency, nothing phones home. Every
screen (character sheets, dice, the initiative tracker, quests, the lore/canon log,
relationships, save/resume, world-building) works fully with no further setup.

**To turn on live DM / Companion / Lore replies and the auto-review learning loop:**
copy `.env.example` to `.env` and fill in an Anthropic API key
(console.anthropic.com -- a separate, usage-billed developer account, not a claude.ai
subscription). `.env` is git-ignored; the key is never logged, persisted into campaign
data, or written anywhere but read from the environment at request time
(`server/providers/anthropic.js`). Without a key, the "ask an agent to respond" option
just doesn't do anything live -- narrate manually in the same log instead, or run the
DM/Companion/Lore conversation in a separate Claude session using the existing spec
files and copy key beats back into this UI to keep state in sync.

## How it's organized

- `server/state.js` — file-based per-campaign JSON store. Each campaign is a folder of
  small slices (`campaign`, `characters`, `scene`, `npcs`, `quests`, `canon`,
  `timeline`, `relationships`, `play_log`, `sessions`, `learning`, `metrics`) under
  `data/campaigns/<id>/`, plus a `checkpoints/` subfolder for save/resume snapshots.
- `server/visibility.js` — the role-projection engine. `projectState(fullState, role)`
  strips everything a `dm | human | companion | lore` request isn't entitled to
  *before* it leaves the server. See the file header for the exact access table (note
  the companion's own private beliefs/fears are `companion_pc`/`lore_only` — not even
  the DM role receives them, matching the original spec precisely).
- `server/agents.js` — optional bridge that builds a system prompt from the existing
  `agents/*.md` files plus a role-filtered state projection and hands it to
  `server/providers/`. Nothing else in the app depends on this working.
- `server/providers/` — the only place that knows how to physically reach an AI
  backend. `anthropic.js` is the sole implementation today (one `fetch()` call, one
  request/response shape); `index.js` is the seam a future provider (a different
  vendor, a self-hosted backend, a local model) plugs into. Routes and views never
  import from here directly, only from `agents.js` — a provider swap later touches
  this folder alone.
- `server/usage.js` — records token usage (and an estimated $ cost) for every AI call
  against the campaign, so spend during testing is visible on the Recap screen instead
  of invisible.
- `server/routes/` — campaign setup & character creation, the play screen (scene, chat
  log, dice, initiative tracker), and records (sheets, quests, lore/canon,
  relationships, recap + the auto-review learning loop, world-building, saves).
- `server/views/` — server-rendered EJS templates; `server/public/` — CSS/JS.

## Party of more than one

`characters.json` is `{ human, companions: [] }` — a list, not a fixed slot. Add
companions from the Party page (during setup or anytime after). What that touches:

- **Visibility**: `role=companion` alone is ambiguous once there's more than one, so
  the viewer identity is `role=companion&companionId=<id>`. A companion's `private`
  block (beliefs, fears, suspicions) is visible only to *that* companion's own seat and
  to Lore — not the DM, not the human, and not another companion (verified directly:
  companion A's sheet omits companion B's private fields entirely from the response
  body when viewed from A's seat, and vice versa). Shared party knowledge (a canon fact or NPC
  tagged `companion_pc`) is unaffected — that's still "known to companions in general."
- **Agent prompts**: a companion-role call to the AI now explicitly states which one
  character it's playing and names the other party members present as perceivable but
  not controllable (`agents.js formatActingAs`) — without this, a multi-companion state
  projection would leave the model guessing which character is "you."
- **Metrics**: independence tracking (`metrics.player_agents`) is keyed per companion,
  so spotlight balance is a per-member question, not one blended average.
- **Learning**: stays shared across the Player Agent archetype rather than per
  companion, matching the original package's own framing ("reusable Player Agent logic
  remains separate from any specific companion profile such as Mira").
- **Relationships**: one companion→human record per companion (`{companionId}__human`),
  each with its own owner-scoped private read.

## Genre / ruleset packs

The core resolution math (d20 + ability modifier vs. a target number, HP as a damage
pool) never changes between settings — that part was already generic. What actually
changes between a traditional-fantasy campaign and, say, a cyberpunk one is vocabulary:
what the six abilities are called, what tone the AI narrates in, what nouns fit the
world. `server/rulesets/*.json` is that seam — a small pack per genre (`fantasy.json`,
`neon-sprawl.json`) declaring a `tone`, a `vocabulary` map, and labels for the six
abilities. A campaign picks one at creation (`campaign.ruleset`, defaults to `fantasy`
for backward compatibility with campaigns created before this existed), and it's threaded
into two places:

- **The AI's system prompt** (`agents.js formatRuleset`) — the DM/companion/Lore calls
  narrate using that pack's ability names, tone, and vocabulary instead of always
  defaulting to fantasy phrasing, while the actual role rules and dice math underneath
  stay identical.
- **The character sheet + character-creation forms** (`views/sheet.ejs`,
  `character-new-*.ejs`) — ability scores and starting currency are labeled with the
  active pack's names (e.g. "Body"/"Reflexes"/"Tech" instead of "Strength"/
  "Dexterity"/"Intelligence"), though the stored keys (`str`/`dex`/.../`gp`) and battle
  math stay the same six generic slots — only the label changes, never the field.
- **The page itself** (`middleware.js requireCampaign` + `partials/head.ejs`) — each
  pack's `theme` block (palette + font) is emitted as a small `:root` CSS override
  computed once per request, so a campaign's chosen genre changes how the page actually
  looks, not just how the AI writes. Fantasy's theme values match the previous
  hardcoded defaults exactly, so pre-existing campaigns render unchanged.
- **The Play (Beta) map/battle screen** (`routes/game.js` + `public/js/game/data.js`) —
  the tile map, tile palette, party colors, and enemy roster all live in the pack's
  `game` block now instead of one hardcoded file shared by every campaign. `data.js`
  derives its constants from `window.GAME_CONTENT` (embedded per-request, same pattern
  as `window.PARTY_DATA`); `mapScene.js`/`battleScene.js` never changed, since they only
  ever reference those constant names, not the ruleset pack directly.

Adding a new genre means adding one more JSON file to `server/rulesets/`, never editing
agents.js, routes, or views. What this does *not* do yet: change the actual mechanical
subsystems (a real action economy, advantage/disadvantage, genre-specific mechanics like
netrunning or humanity loss) — that's real rules design, not a vocabulary swap, and is
deliberately out of scope for this first pass. `server/seed.js`'s `runNeonSprawl()`
seeds a small proof-of-concept cyberpunk-flavored campaign (one human, one companion,
one scene) to demonstrate the pack mechanism live without building out any of that
deeper subsystem work.

## Character creation content (races, classes, dice rolling)

Surfaced by playtesting: creating a character used to be six free-text fields with no
guidance. `fantasy.json`'s `characterOptions` block adds a full original race/class
roster for that pack specifically — 14 races (including subraces: three Elf lineages,
two Dwarf, two Halfling, two Gnome, plus Human/Half-Elf/Half-Orc/Tiefling/Dragonkin) and
12 classes (Fighter, Rogue, Wizard, Cleric, Ranger, Barbarian, Bard, Druid, Monk,
Paladin, Sorcerer, Warlock), each with ability-score bonuses, hit die, saving throws, a
skill-proficiency list (choose N), short original-flavor trait/feature text, and two
starting-equipment kit choices. None of this is copied from any published ruleset's
exact tables or wording — it's original content built to the same general shape
5e-descended systems use, matching this project's existing "5e-style, not locked" stance.

`public/js/character-creator.js` (loaded by `character-new-human.ejs` /
`character-new-companion.ejs` only when the active ruleset defines `characterOptions`)
turns that data into: race/class dropdowns that populate trait text, a kit picker that
auto-fills inventory and a suggested AC, skill checkboxes capped at the class's allowed
count, and a "Roll Ability Scores" button (4d6, drop the lowest, six times) with an
assignment UI — race bonuses are applied automatically on top of whatever's assigned,
and HP auto-suggests from the class's hit die + Constitution modifier. Everything stays
editable afterward. A ruleset pack without `characterOptions` (Neon Sprawl, for now)
falls back to the original plain free-text fields — nothing forces every genre to author
this content before it's usable.

## Play (Beta)

`/campaigns/:id/game` — the first slice of an actual game layer, deliberately scoped
small: one map, one enemy type, placeholder colored-square sprites instead of real art,
proving the loop is fun before anyone draws anything. Built with
[Phaser 3](https://phaser.io) (installed as a normal npm dependency and served from
`node_modules` rather than a CDN, so it works fully offline like everything else here).

- **Map** (`public/js/game/mapScene.js`): arrow keys/WASD move the human PC one tile at
  a time; companions trail behind in a follow-the-leader chain (the classic Chrono
  Trigger/FF technique — each follower moves to where the member ahead of it just was).
  Walking onto a tall-grass tile has a chance to trigger a battle.
- **Battle** (`public/js/game/battleScene.js`): party on the right, enemies on the left
  (classic FF orientation), simple enemy AI. Built directly from real party data —
  names, HP, AC, abilities — fetched via the same `human`-role visibility projection
  every other screen uses, so nothing DM-private or another companion's private diary
  ends up in client-side JS.
  - **Initiative**: real 5e-style turn order — d20 + Dexterity modifier per combatant,
    rolled once at the start of the fight and held for every round (not re-rolled
    turn to turn), shown at the top of the battle screen.
  - **Class-driven actions**: every character's menu is Attack/Defend/Flee plus
    whatever their class (`race_id`/`class_id`/`spells` from character creation) grants
    — a caster's chosen spells (from `characterOptions.classes[].combatKit`, fantasy
    pack only for now), or a martial class's one signature feature (Second Wind, Rage,
    Sneak Attack, Favored Quarry, Flurry of Blows, Lay on Hands). Deliberately compact:
    each spell/feature has a flat per-battle use count rather than a full spell-slot/
    rest economy, to match this screen's arcade pace. A character with no `class_id`
    (older data, or a ruleset pack without `characterOptions` yet) just gets the
    original three options — nothing breaks.
- **Persistence** (`routes/game.js`): a battle's outcome POSTs final HP back to the real
  character sheets (`POST /campaigns/:id/game/battle-result`) — the same pattern as the
  text-based combat tracker's end-of-fight sync — so the map/battle game and the rest of
  the app never drift into two different truths about a character's HP. A defeat isn't
  permanent: the party wakes up battered at 1 HP rather than hitting a dead end, which
  keeps this an arcade-y first slice rather than trying to replicate the main engine's
  own (more careful) death rules. Fleeing now syncs HP too — it used to skip the sync
  entirely, silently discarding any damage taken during a failed flee attempt.
- **Narrative continuity with the text side**: every battle result also appends a
  `play_log` entry (role `"system"`, speaker "Encounter") summarizing what happened —
  who was fought, the outcome, everyone's resulting HP. Without this, the graphical
  screen and the text-based DM were two systems that shared a character sheet but not a
  memory: fighting a battle in Play (Beta) left literally no trace the DM could ever
  reference, so asking about it afterward would draw a blank. Verified live: after a
  graphical win, asking the DM "is everyone alright?" produced a reply correctly
  grounded in that specific fight (enemy count, no invented details).
- **The map reflects where the story actually says you are** (`routes/game.js
  pickArea`): each ruleset pack's `game.areas` is a small fixed set of location
  archetypes (fantasy: `wilderness` / `dungeon`; Neon Sprawl: `street` / `interior`),
  each with its own layout, palette, and enemy roster. On loading Play (Beta), the
  campaign's current `scene.location_name` + `scene.description_public` are checked
  against each area's keywords (e.g. "tunnel"/"cave"/"underground" → `dungeon`) and the
  best match is used; the scene's actual name and description are also shown on screen
  above the map, so it never reads as a disconnected arcade level. This is deliberately
  an *approximation*, not literal reproduction — the DM narrates arbitrary, unbounded
  locations, so there's no way to hand-author a bespoke tile layout for every place it
  might improvise; matching against a handful of archetypes is the bounded version of
  "the map matches your location" that's actually buildable. It also depends on the
  `scene` slice being kept current — the DM's live chat replies don't automatically
  update `scene.location_name`/`description_public` today, only the manual "Edit scene"
  form does, so the graphical map can lag behind the conversation until that's updated.
  Verified live: the demo campaign's starting scene ("...have not entered it yet")
  correctly stays on the `wilderness` map; editing the scene to describe being inside
  the tunnel correctly switches to the `dungeon` map, with area-specific enemy intro
  text, and the same for Neon Sprawl's `street` → `interior` switch.
- **Deliberately not here yet**: items in battle, advantage/disadvantage, conditions,
  more than one map per area, real sprite art, sound, and auto-syncing `scene` from the
  DM's live narration (see above). This is a proof of the loop, not the finished game —
  expand it only once the core "walk, fight, come back" cycle is confirmed to actually
  be fun.

## Beyond the basics

- **Initiative/combat tracker** (Play screen): add party/NPC/enemy combatants, roll or
  enter initiative, step through turns and rounds, adjust HP/conditions live. Enemies
  can be flagged "hidden from players" — they simply aren't in the initiative order a
  human/companion role receives until the DM reveals them (same visibility.js
  mechanism as everything else). Party members' HP/conditions sync back to their
  character sheet when combat ends, so the tracker and the sheet don't drift apart.
- **Automatic learning loop** (Recap screen): a reviewer call reads the session's play
  log + independence metrics against the engine's own acceptance criteria and proposes
  lessons — the automated version of what a human did by hand after Prototype Test
  Sessions 001/002. Nothing becomes durable until you approve it (Controlled Learning
  Policy). Approved lessons get injected into the relevant agent's own system prompt on
  future calls, kept separate from world-fact visibility since performance coaching and
  narrative secrecy are different concerns.
- **World Building** (its own tab): a separate out-of-character workspace where a
  creative-collaborator persona is *allowed* to propose and riff — unlike the in-session
  Lore Agent, which never authors story direction. Nothing said there is canon until you
  hit "Commit to Canon." The Companion role is hard-blocked from this page; it's
  pre-canon possibility space her character has no legitimate way to know.

## Demo data

`server/seed.js` populates a campaign from the real Greymark Road / Brackenford
Session 001–002 material in `../DnD_Duo_Engine_MVP_0.2/campaign_001/`, including the
DM-private truths and the independence-patch metrics, so you can immediately flip
between role tabs and see the visibility boundary hold. It seeds two AI companions —
Mira Vey (the original) and Bram Hollis (added to demonstrate the party feature) — with
deliberately unrelated private fears, so switching between their two seats is a live
demonstration that neither can see the other's private state.
