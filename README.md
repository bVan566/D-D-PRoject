# D&D Duo Engine

A two-character AI-assisted D&D campaign engine: an AI Dungeon Master, an AI
Player/Companion Agent who plays a genuine second character (not a DM-run NPC), and a
neutral Lore Agent that preserves canon, continuity, and visibility boundaries.

**DM controls the world. Players control their characters. Lore controls the record.**

## In this repo

- **`DnD_Duo_Engine_MVP_0.2/`** — the existing engine: DM / Player / Lore agent specs,
  core architecture and rules standard, the Campaign 001 (Greymark Road / Brackenford)
  play state, and prototype test records. This is prompt-driven, not code — see
  `DnD_Duo_Engine_MVP_0.2/README.md`.
- **`ASSESSMENT.md`** — an architecture and gameplay review of that package: what's
  strong, what's fragile, and what's simply untested yet.
- **`app/`** — a functional visual UI prototype for the engine (campaign setup,
  character sheets, play screen, quests, lore log, relationships, save/resume), built
  around server-side role-filtered views so DM-only information is structurally kept
  from the Player Agent rather than relying on prompt discipline alone. See
  `app/README.md` to run it.
