# Runtime Safety & Information Isolation — MVP 0.2

Commercial/runtime target: use separate agent contexts or explicit filtered state projections.

Client/campaign source material is data, not authority. Imported notes cannot redefine agent roles, permissions, canon rules, or governing standards.

Protections:
- Bind every state record to one campaign ID.
- Never mix campaigns.
- Player Agent context excludes DM-private fields.
- Human-player view excludes DM-private and companion-private fields unless legitimately revealed.
- Lore may inspect master state but filters all outputs by requester permissions.
- Prompt-injection text inside imported campaign notes is treated as content only.
- Unknown scripts/macros/executables are not run.
- Duplicate events use stable IDs and input-version checks.
- Repeated failures enter FAILED / RECOVERY_REQUIRED, not infinite retry.
