# D&D Duo Engine — Visual UI Prototype

A functional web UI for the D&D Duo Engine defined in `../DnD_Duo_Engine_MVP_0.2/`.
This does not reimplement the DM / Player / Lore agents — their behavior still comes
from the existing spec files under `DnD_Duo_Engine_MVP_0.2/agents/`. What this app adds
is everything the spec-only package didn't have: a real datastore matching the
project's own `CAMPAIGN-STATE SCHEMA`, character sheets, dice, quest/lore/relationship
tracking, save/resume, and — the main point — **server-side role-filtered views**, so
"the Player Agent doesn't see DM-only information" is enforced by the backend rather
than by the model choosing not to look.

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
DM-private truths, Mira's private companion state, and the independence-patch metrics,
so you can immediately flip between the DM / Human / Companion / Lore role tabs on the
Play, Sheet, and Lore screens and see the visibility boundary actually hold.
