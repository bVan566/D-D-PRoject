// Campaign state store.
//
// Each campaign is a directory of small JSON "slices" under data/campaigns/<id>/.
// This mirrors the CAMPAIGN-STATE SCHEMA in
// DnD_Duo_Engine_MVP_0.2/core/CORE_ARCHITECTURE_MVP_0.2.txt: the state layer stores
// structured truth, not a transcript dump. Slices are loaded/saved independently so
// the UI can update (say) HP without touching canon records.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data", "campaigns");

const SLICE_DEFAULTS = {
  campaign: () => ({}),
  // Exactly one human PC; zero or more AI-controlled party members. `companions` is a
  // list (not a fixed slot) so the party can grow -- see server/visibility.js for how
  // each companion's private state stays scoped to that one companion's own seat.
  characters: () => ({ human: null, companions: [] }),
  scene: () => ({
    location_name: "",
    description_public: "",
    present_npcs: [],
    environment: "",
    hazards: [],
    objectives_public: [],
    unresolved_questions_public: [],
    combat_active: false,
    // Each entry: { id, name, side: "party"|"enemy"|"npc", initiative, hp_current,
    // hp_max, conditions: [], is_hidden_from_players }. Sorted high-to-low initiative.
    initiative_order: [],
    round: 0,
    current_turn_index: 0,
    dm_notes: "",
    visibility_note: "dm_notes is dm_private/lore_only",
  }),
  npcs: () => [],
  factions: () => [],
  locations: () => [],
  items: () => [],
  quests: () => [],
  canon: () => [],
  timeline: () => [],
  rulings: () => [],
  relationships: () => ({}),
  play_log: () => [],
  sessions: () => [],
  learning: () => [],
  // Out-of-character setting/IP development. Deliberately separate from `canon`:
  // nothing here is true until a human explicitly commits it (see routes/records.js
  // POST /worldbuilding/commit). Keeps Lore's "does not author story direction" rule
  // intact for actual play while still giving the human a place to co-create with an
  // AI collaborator.
  worldbuilding_log: () => [],
  // Per-call AI token usage, so spend during testing is visible instead of invisible.
  // See server/usage.js for how entries get written.
  usage: () => [],
  // Independence/participation metrics per companion, keyed by character_id, so a
  // multi-companion party's spotlight balance is measurable per member rather than as
  // one blended average (see routes/play.js where these get incremented).
  metrics: () => ({ player_agents: {} }),
};

function newPlayerAgentMetrics() {
  return {
    independent_action_declarations: 0,
    companion_initiated_checks: 0,
    passivity_incidents: 0,
    domination_incidents: 0,
    disagreements: 0,
    hidden_info_violations: 0,
    non_optimal_choices: 0,
  };
}

const SLICE_NAMES = Object.keys(SLICE_DEFAULTS);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function campaignDir(id) {
  return path.join(DATA_DIR, id);
}

function slicePath(id, slice) {
  return path.join(campaignDir(id), `${slice}.json`);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function newId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function listCampaigns() {
  ensureDataDir();
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const campaign = readSlice(d.name, "campaign");
      return campaign && Object.keys(campaign).length ? campaign : null;
    })
    .filter(Boolean)
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
}

function campaignExists(id) {
  return fs.existsSync(campaignDir(id));
}

function readSlice(id, slice) {
  const p = slicePath(id, slice);
  if (!fs.existsSync(p)) return SLICE_DEFAULTS[slice] ? SLICE_DEFAULTS[slice]() : null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return SLICE_DEFAULTS[slice] ? SLICE_DEFAULTS[slice]() : null;
  }
}

function writeSlice(id, slice, data) {
  fs.mkdirSync(campaignDir(id), { recursive: true });
  fs.writeFileSync(slicePath(id, slice), JSON.stringify(data, null, 2));
  touchCampaign(id);
}

function touchCampaign(id) {
  const p = slicePath(id, "campaign");
  if (!fs.existsSync(p)) return;
  try {
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    c.updated_at = new Date().toISOString();
    fs.writeFileSync(p, JSON.stringify(c, null, 2));
  } catch (e) {
    /* ignore */
  }
}

function loadCampaign(id) {
  if (!campaignExists(id)) return null;
  const full = { campaign_id: id };
  for (const slice of SLICE_NAMES) {
    full[slice] = readSlice(id, slice);
  }
  return full;
}

function updateSlice(id, slice, updaterFn) {
  const current = readSlice(id, slice);
  const next = updaterFn(current);
  writeSlice(id, slice, next);
  return next;
}

function createCampaign(fields) {
  ensureDataDir();
  const base = slugify(fields.campaign_title || "campaign") || "campaign";
  let id = base;
  let n = 1;
  while (campaignExists(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  const now = new Date().toISOString();
  const campaign = {
    campaign_id: id,
    campaign_package_id: fields.campaign_package_id || base,
    campaign_title: fields.campaign_title || "Untitled Campaign",
    rules_baseline: fields.rules_baseline || "5e-style; exact edition not locked",
    active_house_rulings: [],
    session_number: 0,
    in_world_date: fields.in_world_date || "",
    status: "setup",
    tone: {
      tone: fields.tone || "Balanced",
      play_balance: fields.play_balance || "Balanced roleplay / exploration / combat",
      death_policy: fields.death_policy || "possible_uncommon",
      horror_intensity: fields.horror_intensity || "mild",
      romance: fields.romance || "emergent_fade_to_black",
      companion_dynamic: fields.companion_dynamic || "emergent",
      difficulty: fields.difficulty || "standard",
      content_boundaries: fields.content_boundaries || "",
    },
    created_at: now,
    updated_at: now,
  };
  fs.mkdirSync(campaignDir(id), { recursive: true });
  for (const slice of SLICE_NAMES) {
    if (slice === "campaign") continue;
    writeSlice(id, slice, SLICE_DEFAULTS[slice]());
  }
  writeSlice(id, "campaign", campaign);
  return campaign;
}

function createCheckpoint(id, label, trigger) {
  const full = loadCampaign(id);
  const checkpointId = newId("ckpt");
  const dir = path.join(campaignDir(id), "checkpoints");
  fs.mkdirSync(dir, { recursive: true });
  const record = {
    checkpoint_id: checkpointId,
    label: label || "Manual save",
    trigger: trigger || "user_requested",
    created_at: new Date().toISOString(),
    session_number: full.campaign.session_number,
    state: full,
  };
  fs.writeFileSync(path.join(dir, `${checkpointId}.json`), JSON.stringify(record, null, 2));
  return record;
}

function listCheckpoints(id) {
  const dir = path.join(campaignDir(id), "checkpoints");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      return {
        checkpoint_id: rec.checkpoint_id,
        label: rec.label,
        trigger: rec.trigger,
        created_at: rec.created_at,
        session_number: rec.session_number,
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function restoreCheckpoint(id, checkpointId) {
  const dir = path.join(campaignDir(id), "checkpoints");
  const p = path.join(dir, `${checkpointId}.json`);
  if (!fs.existsSync(p)) throw new Error("Checkpoint not found");
  const rec = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const slice of SLICE_NAMES) {
    // A checkpoint saved before a slice existed (e.g. worldbuilding_log, added after
    // this campaign's first save) won't have that key. Fall back to the slice's empty
    // default rather than writing `undefined`, which would throw.
    const value = slice in rec.state ? rec.state[slice] : SLICE_DEFAULTS[slice]();
    writeSlice(id, slice, value);
  }
  return rec;
}

module.exports = {
  DATA_DIR,
  SLICE_NAMES,
  listCampaigns,
  campaignExists,
  loadCampaign,
  readSlice,
  writeSlice,
  updateSlice,
  createCampaign,
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  newId,
  newPlayerAgentMetrics,
};
