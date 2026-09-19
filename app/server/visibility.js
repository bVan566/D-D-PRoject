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
//
// The party can have more than one AI companion. `companion_pc` on a shared record
// (canon, an NPC, a quest) means "known to the party's AI companions in general" and
// stays role-scoped like everything else above. But an individual companion's own
// `private` block (beliefs, fears, suspicions) is inherently that ONE character's --
// companion A has no more business reading companion B's private thoughts than the DM
// or the human does. That narrowing needs to know not just "this is a companion role"
// but "which companion," so projectState takes an optional companionId alongside role.

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

function projectCharacters(characters, role, companionId) {
  // isOwnSeat is only meaningful for companion role; human/dm/lore never get a
  // companion's private block regardless (lore gets it via the role check itself).
  const project = (c, isOwnSeat) => {
    if (!c) return c;
    const clone = { ...c };
    if (clone.private) {
      const canSeePrivate = role === "lore" || (role === "companion" && isOwnSeat);
      if (!canSeePrivate) delete clone.private;
    }
    if (clone.player_notes && role !== "human" && role !== "lore") delete clone.player_notes;
    return clone;
  };
  return {
    human: project(characters.human, false),
    companions: (characters.companions || []).map((c) => project(c, c.character_id === companionId)),
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

function projectRelationships(relationships, role, companionId) {
  // Companion's private opinions (trust/affection/etc rationale) are companion_pc/lore_only.
  // The *fact* that a relationship exists/has a public status is public. A relationship
  // record tagged with owner_companion_id belongs to one specific companion's private
  // read (same "not even other companions" narrowing as projectCharacters); untagged
  // records fall back to the plain visibility-tag check.
  const clone = {};
  for (const [key, rel] of Object.entries(relationships || {})) {
    const r = { ...rel };
    if (r.private_notes) {
      const canSeePrivate =
        r.owner_companion_id !== undefined
          ? role === "lore" || (role === "companion" && r.owner_companion_id === companionId)
          : canSee(role, r.private_notes_visibility || ["companion_pc", "lore_only"]);
      if (!canSeePrivate) delete r.private_notes;
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

function projectState(fullState, role, companionId) {
  if (!ROLE_ACCESS[role]) role = "human";
  return {
    campaign_id: fullState.campaign_id,
    campaign: fullState.campaign,
    role,
    companionId: role === "companion" ? companionId : undefined,
    characters: projectCharacters(fullState.characters || {}, role, companionId),
    scene: projectScene(fullState.scene || {}, role),
    npcs: filterList(fullState.npcs, role),
    factions: filterList(fullState.factions, role),
    locations: filterList(fullState.locations, role),
    items: filterList(fullState.items, role),
    quests: filterList(fullState.quests, role),
    canon: filterList(fullState.canon, role),
    timeline: filterList(fullState.timeline, role),
    rulings: fullState.rulings, // rules rulings are neutral/public by design
    relationships: projectRelationships(fullState.relationships, role, companionId),
    play_log: projectPlayLog(fullState.play_log, role),
    sessions: fullState.sessions, // session recaps are player-facing summaries by construction
    learning: role === "dm" || role === "lore" ? fullState.learning : [],
    metrics: projectMetrics(fullState.metrics, role),
  };
}

module.exports = { canSee, projectState, ROLE_ACCESS };
