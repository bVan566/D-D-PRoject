// Role-scoped state projection.
//
// This is the structural upgrade over the original package's "logical isolation"
// (see DnD_Duo_Engine_MVP_0.2/core/RUNTIME_SAFETY_ISOLATION.md, which names this exact
// mechanism as the target for a future implementation). Instead of trusting a model to
// self-censor DM-private facts inside one shared context, the server strips fields the
// requesting role is not entitled to *before* the response leaves the process. A
// companion-role request can never receive dm_private data over the wire, full stop.
//
// Visibility vocabulary matches the package's own CANON RECORD schema:
//   public | human_pc | companion_pc | dm_private | lore_only
//
// Role access, per CORE_ARCHITECTURE_MVP_0.2.txt "VISIBILITY FILTER":
//   dm        -> public + dm_private (+ possibilities marked relevant)
//   human     -> public + human_pc
//   companion -> public + companion_pc   (NOT dm_private; NOT automatically human_pc)
//   lore      -> everything (Lore may inspect the master record; this app's "Lore" role
//                is the full-record/audit view used when acting as record-keeper)

const ROLE_ACCESS = {
  dm: new Set(["public", "dm_private"]),
  human: new Set(["public", "human_pc"]),
  companion: new Set(["public", "companion_pc"]),
  lore: new Set(["public", "human_pc", "companion_pc", "dm_private", "lore_only"]),
};

function canSee(role, visibility) {
  if (!visibility) return true; // untagged fields are treated as public/structural
  const tags = Array.isArray(visibility) ? visibility : [visibility];
  const allowed = ROLE_ACCESS[role] || ROLE_ACCESS.human;
  return tags.some((t) => allowed.has(t));
}

function filterList(list, role) {
  if (!Array.isArray(list)) return list;
  return list.filter((item) => canSee(role, item.visibility)).map((item) => stripHidden(item, role));
}

// Removes known "private" sub-blocks from an object when the role can't see them,
// rather than trying to guess generically. Keeps the projection predictable.
function stripHidden(obj, role) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = { ...obj };
  if (clone.private && clone.private.visibility) {
    if (!canSee(role, clone.private.visibility)) delete clone.private;
  }
  if (clone.hidden_motive !== undefined && role !== "dm" && role !== "lore") delete clone.hidden_motive;
  if (clone.faction_ties_hidden !== undefined && role !== "dm" && role !== "lore") delete clone.faction_ties_hidden;
  if (clone.hidden_stakes !== undefined && role !== "dm" && role !== "lore") delete clone.hidden_stakes;
  if (clone.dm_notes !== undefined && role !== "dm" && role !== "lore") delete clone.dm_notes;
  return clone;
}

function projectCharacters(characters, role) {
  const project = (c) => {
    if (!c) return c;
    const clone = { ...c };
    if (clone.private) {
      const privVisibility = clone.private.visibility || ["companion_pc", "lore_only"];
      if (!canSee(role, privVisibility)) delete clone.private;
    }
    if (clone.player_notes && role !== "human" && role !== "lore") delete clone.player_notes;
    return clone;
  };
  return {
    human: project(characters.human),
    companion: project(characters.companion),
  };
}

function projectScene(scene, role) {
  const clone = { ...scene };
  if (role !== "dm" && role !== "lore") delete clone.dm_notes;
  delete clone.visibility_note;
  // "The DM may keep encounter compositions and hidden statistics private" (core
  // architecture, DM-PRIVATE STATE). A combatant flagged hidden simply doesn't exist
  // in the initiative order a player-facing role receives, until the DM reveals it.
  if (role !== "dm" && role !== "lore" && Array.isArray(clone.initiative_order)) {
    clone.initiative_order = clone.initiative_order.filter((c) => !c.is_hidden_from_players);
  }
  return clone;
}

function projectRelationships(relationships, role) {
  // Companion's private opinions (trust/affection/etc rationale) are companion_pc/lore_only.
  // The *fact* that a relationship exists/has a public status is public.
  const clone = {};
  for (const [key, rel] of Object.entries(relationships || {})) {
    const r = { ...rel };
    if (r.private_notes && !canSee(role, r.private_notes_visibility || ["companion_pc", "lore_only"])) {
      delete r.private_notes;
    }
    clone[key] = r;
  }
  return clone;
}

function projectPlayLog(log, role) {
  return (log || []).filter((m) => canSee(role, m.visibility || "public"));
}

function projectMetrics(metrics, role) {
  // Learning/performance metrics are engine instrumentation, not campaign canon.
  // Visible to dm and lore (who run the post-session review) and, read-only, to
  // whoever it's tracking about themselves is still withheld from the human by
  // default to avoid turning it into a scoreboard during play.
  if (role === "dm" || role === "lore") return metrics;
  return null;
}

function projectState(fullState, role) {
  if (!ROLE_ACCESS[role]) role = "human";
  return {
    campaign_id: fullState.campaign_id,
    campaign: fullState.campaign,
    role,
    characters: projectCharacters(fullState.characters || {}, role),
    scene: projectScene(fullState.scene || {}, role),
    npcs: filterList(fullState.npcs, role),
    factions: filterList(fullState.factions, role),
    locations: filterList(fullState.locations, role),
    items: filterList(fullState.items, role),
    quests: filterList(fullState.quests, role),
    canon: filterList(fullState.canon, role),
    timeline: filterList(fullState.timeline, role),
    rulings: fullState.rulings, // rules rulings are neutral/public by design
    relationships: projectRelationships(fullState.relationships, role),
    play_log: projectPlayLog(fullState.play_log, role),
    sessions: fullState.sessions, // session recaps are player-facing summaries by construction
    learning: role === "dm" || role === "lore" ? fullState.learning : [],
    metrics: projectMetrics(fullState.metrics, role),
  };
}

module.exports = { canSee, projectState, ROLE_ACCESS };
