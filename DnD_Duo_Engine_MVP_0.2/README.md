# D&D Duo Engine MVP 0.2

Status: COMPLIANT / READY FOR BOUNDED PROTOTYPE USE
Governing Standard: bVan! Product Standard v1.0 — LOCKED

This package hardens the existing D&D Duo Engine without redesigning its core architecture.

Priority product tracks:
1. Lore Agent
2. Full Duo Engine
3. DM Agent
4. Player / Companion Agent

Core authority:
**DM controls the world. Players control their characters. Lore controls the record.**

The Campaign 001 materials are included as a working test campaign, while the reusable agent specifications live separately under /agents and /core.

## Runtime Patch 0.2.1 — Player Agent Independence
After Prototype Test Session 002, human playtest feedback identified a gap between the written Player Agent role and its live behavior: Mira was too reactive and felt like a DM-run companion NPC. Load `agents/PLAYER_AGENT_v0.2.1.md` in place of v0.2. The DM v0.2 file includes the companion-adjudication interface patch. See `PLAYER_AGENT_PATCH_0.2.1_CHANGELOG.md`.


## Runtime Patch 0.2.2 — DM Fast-Flow
Prototype Test Session 002 showed that the DM could preserve continuity but spent too much time inspecting system/campaign contents before routine decisions when Marcus was not involved. The 0.2.2 DM patch makes active-session state the default decision surface and defines explicit triggers for deeper Lore/rules/campaign lookup. Clarification recall and end-session persistence/recap behavior are explicitly preserved.
