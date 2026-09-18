# Rollback & Recovery — MVP 0.2

General rule:
**STOP → CONTAIN → RESTORE LAST KNOWN-GOOD SNAPSHOT → RECONCILE → RESUME**

Required checkpoints:
- session start
- meaningful scene transition
- combat start/end
- NPC death/permanent change
- significant resource/inventory change
- session pause/end
- user-requested save

Recovery cases:
- Corrupt campaign state: restore last known-good snapshot; replay validated events.
- Wrong canon promotion: supersede erroneous fact; preserve audit trail.
- Wrong visibility/secret leak: stop affected flow, correct projection, record incident; human review if externally exposed.
- Cross-campaign contamination: freeze both affected states, remove contaminated records, restore clean snapshots.
- Mid-combat interruption: restore initiative, round/turn, HP, conditions, concentration, resources, positions, visible threats, unresolved intent.
- Incorrect ruling: mark ruling superseded; retain provenance; apply corrected ruling prospectively unless human chooses retcon.
- Bad learning update: revert learning-state version without changing campaign canon.
- Failed persistence write: do not advance authoritative state until write is verified.
