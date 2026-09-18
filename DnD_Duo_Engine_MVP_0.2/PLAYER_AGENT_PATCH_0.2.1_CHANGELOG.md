# D&D Duo Engine — Player Agent Patch 0.2.1

Source: human playtest feedback after Prototype Test Session 002.

## Problem observed
Mira maintained character voice and information boundaries, but behaved too much like a DM-run companion NPC. She frequently followed or commented while Billy/Dhovir generated the meaningful action declarations and DM-called checks.

## Changes
- Added explicit Independent Player Loop.
- Added anti-passivity and anti-domination balance.
- Player Agent now declares action + intent but never calls its own check/DC/outcome.
- DM explicitly adjudicates companion uncertain actions by the same standard as the human PC.
- Added private-character-state guidance to support independent motives/suspicions without converting them into world truth.
- Added session metrics for companion-initiated actions/checks, passivity, domination, disagreement, hidden-info violations, and human companion-quality feedback.
- Updated Mira state with Session 003 test targets.
- Corrected Test 002 evaluation from an overbroad independence PASS to PARTIAL / PATCH REQUIRED.

## Preserved behavior
- No DM-private leakage.
- No hint-engine / quest-compass behavior.
- Human PC agency remains exclusive to the human player.
- Mira may still choose silence, caution, cooperation, or non-optimal actions when character-consistent.
