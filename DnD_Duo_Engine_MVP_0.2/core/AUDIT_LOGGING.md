# Operational Logging — MVP 0.2

Log enough to reconstruct consequential state changes without exposing secrets unnecessarily.

Required fields:
event_id, timestamp, campaign_id, session_number, engine_version, agent_version,
requester_role, source/input reference, visibility layer, declared action/query,
mechanical result when relevant, state change, canon/provenance update,
ruling/house-rule update, contradiction flag, human override/approval,
handoff destination, error/failure state, final state.

Lore provenance records and operational event logs are separate but linkable.
