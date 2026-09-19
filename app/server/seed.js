// Seeds a demo campaign from the existing Campaign 001 (Greymark Road / Brackenford)
// material in DnD_Duo_Engine_MVP_0.2/campaign_001/, so the UI is immediately
// demonstrable against real play data instead of an empty campaign. Run with:
//   node server/seed.js

const state = require("./state");

const ID_TITLE = "Greymark Road / Brackenford";

function run() {
  const existing = state.listCampaigns().find((c) => c.campaign_title === ID_TITLE);
  if (existing) {
    console.log(`Demo campaign already exists: ${existing.campaign_id}`);
    return existing.campaign_id;
  }

  const campaign = state.createCampaign({
    campaign_title: ID_TITLE,
    rules_baseline: "5e-style; exact edition not locked",
    in_world_date: "Daylight, morning after the first night in Brackenford",
    tone: "Mixed — humor, adventure, tension, mystery, occasional weight",
    play_balance: "Balanced roleplay / exploration / combat",
    death_policy: "possible_uncommon",
    horror_intensity: "mild",
    romance: "emergent_fade_to_black",
    companion_dynamic: "emergent",
    difficulty: "standard",
    content_boundaries: "Broadly open unless changed by the human player during play.",
  });
  const id = campaign.campaign_id;

  state.updateSlice(id, "campaign", (c) => ({ ...c, status: "active", session_number: 3 }));

  const human = {
    character_id: "pc-human",
    controller: "human",
    name: "Dhovir DrunkFoot",
    species: "Mountain Dwarf",
    class_level: "Paladin (Oath of Devotion) 4",
    race_id: "dwarf-mountain",
    class_id: "paladin",
    skills: ["Athletics", "Religion"],
    spells: [],
    background: "Soldier",
    alignment: "Chaotic Good",
    abilities: { str: 19, dex: 13, con: 18, int: 11, wis: 13, cha: 9 },
    ac: 18,
    hp: { current: 32, max: 32 },
    temp_hp: 0,
    speed: 25,
    conditions: [],
    inventory: [
      { item: "chain mail", qty: 1 },
      { item: "shield", qty: 1 },
      { item: "battleaxe", qty: 1 },
      { item: "dagger", qty: 1 },
      { item: "light hammer", qty: 1 },
      { item: "backpack, common clothes, dice set, amulet, priest-related supplies", qty: 1 },
    ],
    currency: { gp: 179 },
    personality: {
      traits: "Conflicted between walking away and honoring his vows.",
      ideals: "Devotion — something harmful or evil happening nearby is worth looking into.",
      bonds: "Partnership with Mira, openly acknowledged in Session 002.",
      flaws: "",
    },
    goals_public: ["Investigate the Brackenford disappearances", "Uphold his paladin oath"],
    location: "East of Brackenford, outside the drainage opening near the Pell farm/quarry track",
    status: "active",
    player_notes: "",
  };

  const mira = {
    character_id: "pc-mira-vey",
    controller: "player_agent",
    name: "Mira Vey",
    species: "Human",
    class_level: "Rogue 4 (Scout-style)",
    race_id: "human",
    class_id: "rogue",
    skills: ["Stealth", "Acrobatics", "Sleight of Hand", "Investigation"],
    spells: [],
    background: "Courier / former border runner",
    alignment: "Neutral Good",
    abilities: { str: 9, dex: 18, con: 14, int: 13, wis: 15, cha: 12 },
    ac: 15,
    hp: { current: 27, max: 27 },
    temp_hp: 0,
    speed: 30,
    conditions: [],
    inventory: [
      { item: "shortbow", qty: 1 },
      { item: "shortsword", qty: 1 },
      { item: "daggers", qty: 2 },
      { item: "thieves' tools", qty: 1 },
    ],
    currency: { gp: 20 },
    personality: {
      traits: "Observant, dryly funny, suspicious of institutional authority.",
      ideals: "Dislikes watching capable people die for preventable reasons.",
      bonds: "Practical partnership with Dhovir, warming through shared danger.",
      flaws: "Rarely gives trust quickly; doesn't treat companionship as obedience.",
    },
    goals_public: ["Complete the investigation", "Get paid and keep moving"],
    location: "East of Brackenford, outside the drainage opening near the Pell farm/quarry track",
    status: "active",
    private: {
      visibility: ["companion_pc", "lore_only"],
      beliefs: [
        "Wants reliable travel papers through the region; believes Orren Vale may know someone who can help.",
      ],
      fears: ["Being trapped into service or obligation she cannot walk away from."],
      personal_goals: ["Find a route to reliable travel papers"],
      suspicions: ["Does not know Orren is connected to the deserters."],
      unresolved_questions: ["What is actually inside the drainage opening?"],
      relationship_opinions: { dhovir: "Capable in a fight; trust is still being earned." },
      tactical_preferences: [
        "Maintain mobility, use cover, seek advantage when plausible",
        "Protect herself, exploit openings, retreat when staying would be foolish",
      ],
    },
  };

  const bram = {
    character_id: "pc-bram-hollis",
    controller: "player_agent",
    name: "Bram Hollis",
    species: "Human",
    class_level: "Cleric 4 (War Domain)",
    race_id: "human",
    class_id: "cleric",
    skills: ["Religion", "Medicine"],
    spells: ["sacred_flame", "cure_wounds"],
    background: "Wandering minor-faith chaplain",
    alignment: "Lawful Good",
    abilities: { str: 14, dex: 10, con: 15, int: 11, wis: 16, cha: 12 },
    ac: 16,
    hp: { current: 29, max: 29 },
    temp_hp: 0,
    speed: 30,
    conditions: [],
    inventory: [
      { item: "warhammer", qty: 1 },
      { item: "shield", qty: 1 },
      { item: "holy symbol", qty: 1 },
      { item: "healer's kit", qty: 1 },
    ],
    currency: { gp: 15 },
    personality: {
      traits: "Steady, plainspoken, quietly watchful; prays before deciding anything that matters.",
      ideals: "People in trouble get helped first; theology gets argued about later.",
      bonds: "A minor regional faith most people in Brackenford have never heard of.",
      flaws: "Slow to trust anyone who treats the disappearances as merely inconvenient.",
    },
    goals_public: ["See the missing travelers found or properly laid to rest"],
    location: "East of Brackenford, outside the drainage opening near the Pell farm/quarry track",
    status: "active",
    // Independent of Mira's private state on purpose -- this is the concrete proof
    // that per-companion privacy actually holds: Bram's fear has nothing to do with
    // Mira's, and neither companion's role/seat should ever see the other's.
    private: {
      visibility: ["companion_pc", "lore_only"],
      beliefs: ["Suspects the 'voice in the woods' is a sign his faith has quietly lost favor here."],
      fears: ["That he'll freeze in the one moment his god's favor actually mattered."],
      personal_goals: ["Find out whether the supernatural element is a test, a punishment, or neither"],
      suspicions: [],
      unresolved_questions: ["Why does his usual battle-prayer feel different since arriving in Brackenford?"],
      relationship_opinions: { dhovir: "A real paladin, not just armor and conviction. Respects that." },
      tactical_preferences: ["Hold the line for the party, keep Dhovir upright, don't overextend alone"],
    },
  };

  state.writeSlice(id, "characters", { human, companions: [mira, bram] });

  state.writeSlice(id, "scene", {
    location_name: "Old drainage opening, downslope from the Pell farm/quarry track",
    description_public:
      "A narrow old drainage opening in a rock face, reached by following an intermittent trail of overlapping " +
      "impressions through loose shale and brush. Dhovir and Mira have not entered it yet.",
    present_npcs: [],
    environment: "Rough loose shale, brush, old quarry terrain; interior not yet assessed.",
    hazards: ["Loose shale footing", "Interior of the drainage opening is unassessed"],
    objectives_public: ["Decide whether and how to enter the drainage opening", "Find out what happened to the missing travelers"],
    unresolved_questions_public: ["What caused the voice/scream phenomenon?", "Who is using the abandoned workings, and why?"],
    combat_active: false,
    initiative_order: [],
    round: 0,
    dm_notes:
      "DM truth (dm_private): a small band of deserters led by Hask Renn has been using the drainage tunnels to " +
      "rob travelers; Hask disturbed a sealed chamber and released a weak supernatural presence. Orren Vale is a " +
      "covert deserter contact. None of this is established to the players yet.",
    visibility_note: "dm_notes is dm_private/lore_only",
  });

  state.writeSlice(id, "npcs", [
    {
      id: "npc-tann",
      name: "Sergeant Elra Tann",
      public_description: "Brackenford watch sergeant. Competent, sleep-deprived, politically pressured.",
      role: "Watch sergeant / temporary information-sharing ally",
      location: "Brackenford",
      status: "alive",
      known_information_public: [
        "Identified the three missing people: an unnamed quarry hand, peddler Caldus Marr, and farm boy Jory Pell.",
        "Agreed to temporary cooperation: Dhovir and Mira investigate independently, not as deputies.",
      ],
      hidden_motive: "Not corrupt; genuinely overwhelmed and prefers a practical explanation over supernatural claims.",
      provenance: "Session 001–002",
      visibility: "public",
    },
    {
      id: "npc-orren",
      name: "Orren Vale",
      public_description:
        "Quarry clerk/bookkeeper. Thin, roughly forties, brown coat, pale limestone dust on boots, slight hitch in right leg.",
      role: "Quarry clerk",
      location: "Brackenford quarry records office",
      status: "alive",
      known_information_public: [
        "Reported old drainage cuts/abandoned quarry passages and believes someone has been using them.",
        "Admitted to unrecorded business moving goods without proper tolls.",
      ],
      hidden_motive: "Covert deserter contact; wants the bandits gone before the watch finds the tunnels. Will lie, bargain, flee, or betray depending on pressure.",
      provenance: "Session 001",
      visibility: "public",
    },
    {
      id: "npc-harlan",
      name: "Harlan Pell",
      public_description: "Jory Pell's father; farms east of Brackenford.",
      role: "Missing boy's father",
      location: "Pell farm",
      status: "alive",
      known_information_public: [
        "Jory seemed normal but quieter the week before vanishing; said he'd seen something near the old quarry road.",
        "Reported quarry-side dog barking, heavy brush movement, and one indistinct calling voice.",
      ],
      hidden_motive: "",
      provenance: "Session 002",
      visibility: "public",
    },
  ]);

  state.writeSlice(id, "quests", [
    {
      id: "quest-disappearances",
      title: "The Brackenford disappearances",
      player_visible_description:
        "Three people have vanished along the quarry-road stretch in the past twelve days: a quarry hand, peddler " +
        "Caldus Marr, and farm boy Jory Pell. Dhovir and Mira are investigating in temporary cooperation with Sergeant Tann.",
      status: "open",
      originating_event: "Ambushed wagon and wounded watchman on the Greymark Road, Session 001",
      known_objectives: [
        "Determine what happened to the missing travelers and watchmen",
        "Investigate the old drainage/quarry workings",
      ],
      hidden_stakes:
        "A deserter band under Hask Renn has been robbing travelers via the tunnels and disturbed a sealed chamber, " +
        "releasing a weak supernatural presence now escalating the danger.",
      relevant_entities: ["Sergeant Elra Tann", "Orren Vale", "Harlan Pell", "Hask Renn (unrevealed)"],
      consequences_triggered: [],
      unresolved_questions: ["What lies inside the drainage opening?", "What produced the voice/scream phenomenon?"],
      visibility: "public",
      provenance: "Session 001–002",
    },
  ]);

  state.writeSlice(id, "canon", [
    {
      id: "fact-dho-001",
      statement:
        "The DrunkFoot surname dates back three generations to an ancestor who, drunk on night guard duty, kicked a " +
        "cornerstone in exactly the wrong way and collapsed an unfinished mountain-city hall.",
      canon_status: "locked_canon",
      visibility: "public",
      claim_type: "objective_fact",
      source: "Billy, established through Dhovir, Session 001",
      session: 1,
      contradiction_flag: false,
      related_entities: ["Dhovir DrunkFoot"],
    },
    {
      id: "fact-tann-001",
      statement: "Three people have disappeared along the quarry-road stretch within the previous twelve days.",
      canon_status: "locked_canon",
      visibility: "public",
      claim_type: "reported_claim",
      source: "Sergeant Elra Tann, Session 001",
      session: 1,
      contradiction_flag: false,
      related_entities: ["Sergeant Elra Tann"],
    },
    {
      id: "fact-timeline-conflict",
      statement:
        "An improvised line briefly placed the first disappearance six weeks earlier. Discarded — conflicts with the " +
        "locked twelve-day window and must not persist.",
      canon_status: "possibility",
      visibility: "dm_private",
      claim_type: "disputed",
      source: "Session 002 continuity correction",
      session: 2,
      contradiction_flag: true,
      contradiction_note: "Superseded by fact-tann-001; caught by the human player and corrected.",
      related_entities: [],
    },
    {
      id: "fact-dmtruth-deserters",
      statement:
        "A small band of deserters led by Hask Renn has been using the old drainage tunnels to rob isolated travelers.",
      canon_status: "dm_truth",
      visibility: "dm_private",
      claim_type: "objective_fact",
      source: "DM Private Runtime",
      session: 1,
      contradiction_flag: false,
      related_entities: ["Hask Renn", "Orren Vale"],
    },
    {
      id: "fact-unresolved-chamber",
      statement: "Exact origin and larger history of the sealed underground chamber.",
      canon_status: "unresolved_space",
      visibility: "lore_only",
      claim_type: "belief",
      source: "Core architecture — must not be filled automatically",
      session: 1,
      contradiction_flag: false,
      related_entities: [],
    },
    {
      id: "fact-chamber-warprison",
      statement: "Dwarven folk memory holds the chamber was sealed after a war, not built as a shrine.",
      canon_status: "open_lore",
      visibility: "dm_private",
      claim_type: "objective_fact",
      source: "World-building session",
      session: 1,
      contradiction_flag: false,
      related_entities: [],
    },
  ]);

  state.writeSlice(id, "timeline", [
    {
      id: "evt-001",
      time_marker: "Session 001",
      summary: "Overturned wagon ambush on the Greymark Road; Torris rescued; medicine delivered to Brackenford.",
      participants: ["Dhovir", "Mira", "Torris"],
      visibility: "public",
      claim_type: "observed",
      provenance: "Session 001",
    },
    {
      id: "evt-002",
      time_marker: "Session 002",
      summary: "Dhovir and Mira met Sergeant Tann and Harlan Pell, followed a physical trail to the drainage opening.",
      participants: ["Dhovir", "Mira", "Sergeant Tann", "Harlan Pell"],
      visibility: "public",
      claim_type: "observed",
      provenance: "Session 002",
    },
  ]);

  state.writeSlice(id, "relationships", {
    [`${mira.character_id}__human`]: {
      label: "Mira Vey → Dhovir DrunkFoot",
      owner_companion_id: mira.character_id,
      status_public: "Mutually acknowledged partners as of Session 002; deeper loyalty/friendship/romance remains emergent.",
      trust: 3,
      affection: 2,
      loyalty: 2,
      respect: 3,
      history: [
        { session: 1, note: "Practical cooperation warmed through shared danger, humor, and drinking.", delta: {} },
        { session: 2, note: "Dhovir explicitly asked what she thought; partnership openly acknowledged.", delta: {} },
      ],
      private_notes:
        "Mira recognizes Dhovir looks capable in a fight but is still deciding whether he's trustworthy long-term.",
    },
    [`${bram.character_id}__human`]: {
      label: "Bram Hollis → Dhovir DrunkFoot",
      owner_companion_id: bram.character_id,
      status_public: "Professional respect, freshly met this session.",
      trust: 2,
      affection: 0,
      loyalty: 1,
      respect: 3,
      history: [{ session: 3, note: "Watched Dhovir hold his oath under pressure; that's enough for Bram to fall in beside him.", delta: {} }],
      private_notes: "Bram hasn't decided if Dhovir's certainty is faith or just dwarven stubbornness. Watching.",
    },
  });

  state.writeSlice(id, "sessions", [
    {
      session_number: 1,
      date: "2026-09-09",
      compressed_summary:
        "Wagon ambush, rescue of Torris, delivery of the medicine chest, and Dhovir's pursuit of Orren Vale led to the " +
        "first leads on the quarry-road disappearances.",
      major_choices: ["Dhovir pursued and confronted Orren instead of reporting him to Tann immediately"],
      discoveries: ["Old drainage cuts/abandoned quarry passages exist near the road"],
      resource_changes: ["Both PCs received 20 gp for the escort contract"],
      relationship_changes: ["Practical cooperation between Dhovir and Mira began warming"],
      unresolved_threads: ["What happened to the missing travelers?", "What caused the voice/scream phenomenon?"],
      dm_self_review: "Strong start; flow-first rules worked well. Watch: avoid narrating Dhovir's internal conclusions.",
      player_agent_self_review: "Mira participated without becoming a quest compass; independence untested under tactical pressure.",
      human_feedback: "",
    },
    {
      session_number: 2,
      date: "2026-09-10",
      compressed_summary:
        "Formal cooperation with Sergeant Tann, investigation of the Pell farm disappearance site, and a followed " +
        "trail leading to the drainage opening where the session stopped.",
      major_choices: ["Temporary cooperation agreement with Sergeant Tann instead of deputization"],
      discoveries: ["Disturbed ground and overlapping impressions leading to the drainage opening"],
      resource_changes: [],
      relationship_changes: ["Partnership openly acknowledged between Dhovir and Mira"],
      unresolved_threads: ["What lies inside the drainage opening?"],
      dm_self_review: "Flow was slower without deep-lookup discipline; Fast-Flow patch 0.2.2 applied for Session 003.",
      player_agent_self_review:
        "PARTIAL — Mira remained too reactive; rarely generated her own DM-called checks. Independent Player Patch 0.2.1 applied.",
      human_feedback: "Companion felt like a DM-controlled NPC rather than a second player.",
    },
  ]);

  state.updateSlice(id, "metrics", (m) => ({
    player_agents: {
      ...m.player_agents,
      [mira.character_id]: {
        ...state.newPlayerAgentMetrics(),
        independent_action_declarations: 3,
        companion_initiated_checks: 4,
        passivity_incidents: 4,
        non_optimal_choices: 1,
      },
      // Just joined this session -- lower numbers are expected and exactly the point of
      // tracking this per companion instead of as one blended party average.
      [bram.character_id]: {
        ...state.newPlayerAgentMetrics(),
        independent_action_declarations: 1,
        companion_initiated_checks: 1,
      },
    },
  }));

  state.updateSlice(id, "play_log", (log) => [
    ...log,
    {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: "dm",
      speaker_name: "DM",
      content:
        "You're standing outside a narrow old drainage opening downslope from the Pell farm, having followed the " +
        "trail this far. Loose shale, brush. The opening is dark inside — you haven't gone in yet. What do you do?",
      visibility: "public",
    },
    {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: "companion",
      character_id: mira.character_id,
      speaker_name: "Mira Vey",
      content: "🎲 1d20+6 → [17] +6 = 23",
      visibility: "public",
      is_roll: true,
    },
    {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: "companion",
      character_id: mira.character_id,
      speaker_name: "Mira Vey",
      content: "Mira crouches to examine the drainage opening edge for fresh tool marks, without waiting to be asked.",
      visibility: "public",
      declares_action: true,
    },
    {
      id: state.newId("msg"),
      timestamp: new Date().toISOString(),
      role: "companion",
      character_id: bram.character_id,
      speaker_name: "Bram Hollis",
      content: "Bram quietly says a word over his holy symbol before anyone goes near the opening — not asking permission, just doing it.",
      visibility: "public",
      declares_action: true,
    },
  ]);

  // Sample learning-loop output, so a fresh reseed shows what the loop looks like
  // populated instead of empty. In real use these come from POST /recap/auto-review.
  state.updateSlice(id, "learning", (list) => [
    ...list,
    {
      id: state.newId("lesson"),
      agent: "dm",
      observation: "DM re-read full campaign file before two routine narration beats where active-session state was sufficient.",
      classification: "single_session",
      evidence_session: 2,
      recommended_change: "Reinforce the Fast-Flow anti-overinspection guardrail.",
      status: "active",
      created_at: new Date().toISOString(),
      decided_at: new Date().toISOString(),
    },
    {
      id: state.newId("lesson"),
      agent: "player_agent",
      observation: "Mira initiated 3 of 4 investigation beats this session without being prompted.",
      classification: "recurring_pattern",
      evidence_session: 3,
      recommended_change: "Independence patch 0.2.1 is holding — keep current independent-loop instructions as-is.",
      status: "proposed",
      created_at: new Date().toISOString(),
      decided_at: null,
    },
  ]);

  // Sample world-building brainstorm, showing the DM-prep workspace populated and one
  // idea already committed to canon (fact-chamber-warprison above) via that flow.
  state.updateSlice(id, "worldbuilding_log", (log) => [
    ...log,
    {
      id: state.newId("wbmsg"),
      timestamp: new Date().toISOString(),
      role: "dm",
      speaker_name: "DM (prep)",
      content:
        "What if the region's dwarves have a folk memory of the chamber being sealed after a war, not built as a shrine?",
    },
  ]);

  state.createCheckpoint(id, "Imported from Campaign 001 / Session 002 stop", "session_end");

  console.log(`Seeded demo campaign: ${id}`);
  return id;
}

// A second, deliberately small demo campaign using the "neon-sprawl" ruleset pack --
// just enough (one human, one companion, one scene) to prove the genre-pack mechanism
// actually changes DM/companion vocabulary and tone in a live call, without building
// out any cyberpunk-specific subsystems (netrunning minigames, humanity tracking,
// etc.) that were deliberately scoped out for now.
const NEON_TITLE = "Static District Job";

function runNeonSprawl() {
  const existing = state.listCampaigns().find((c) => c.campaign_title === NEON_TITLE);
  if (existing) {
    console.log(`Neon Sprawl demo campaign already exists: ${existing.campaign_id}`);
    return existing.campaign_id;
  }

  const campaign = state.createCampaign({
    campaign_title: NEON_TITLE,
    rules_baseline: "5e-style resolution, cyberpunk-flavored vocabulary",
    ruleset: "neon-sprawl",
    in_world_date: "Night, rain, Lower Static District",
    tone: "Grim & high-stakes",
    play_balance: "Balanced roleplay / exploration / combat",
    death_policy: "possible_uncommon",
    horror_intensity: "none",
    romance: "off",
    companion_dynamic: "wary_professional",
    difficulty: "standard",
    content_boundaries: "Broadly open unless changed by the human player during play.",
  });
  const id = campaign.campaign_id;
  state.updateSlice(id, "campaign", (c) => ({ ...c, status: "active", session_number: 1 }));

  const human = {
    character_id: "pc-human",
    controller: "human",
    name: "Reyes Okafor",
    species: "Human",
    class_level: "Fixer 3",
    background: "Ex-corporate security",
    alignment: "",
    abilities: { str: 12, dex: 15, con: 13, int: 14, wis: 12, cha: 16 },
    ac: 14,
    hp: { current: 24, max: 24 },
    temp_hp: 0,
    speed: 30,
    conditions: [],
    inventory: [
      { item: "sidearm (light pistol)", qty: 1 },
      { item: "armored jacket", qty: 1 },
      { item: "burner commlink", qty: 2 },
    ],
    currency: { gp: 850 },
    personality: {
      traits: "Charming when it costs nothing, ruthless when it doesn't.",
      ideals: "Everyone's for sale; the trick is knowing the price.",
      bonds: "Owes a favor to the netrunner who got him out of corporate security alive.",
      flaws: "Never walks away from a job once he's said yes, even when he should.",
    },
    goals_public: ["Land a job clean enough to pay off the debt", "Stay off corporate radar"],
    location: "Lower Static District, outside a noodle stall near the transit line",
    status: "active",
    player_notes: "",
  };

  const runner = {
    character_id: "pc-vex",
    controller: "player_agent",
    name: "Vex",
    species: "Human",
    class_level: "Netrunner 3",
    background: "Corp-trained, blacklisted",
    alignment: "",
    abilities: { str: 8, dex: 13, con: 11, int: 18, wis: 14, cha: 10 },
    ac: 12,
    hp: { current: 16, max: 16 },
    temp_hp: 0,
    speed: 30,
    conditions: [],
    inventory: [
      { item: "deck (custom rig)", qty: 1 },
      { item: "holdout pistol", qty: 1 },
    ],
    currency: { gp: 140 },
    personality: {
      traits: "Blunt, allergic to small talk, trusts code more than people.",
      ideals: "Information wants to be free; people who hoard it are the enemy.",
      bonds: "Reyes got her out from under a corp contract; she hasn't decided if that's a debt or a trap.",
      flaws: "Underestimates how much physical danger matters when she's mid-run.",
    },
    goals_public: ["Stay employable without going back on a corp leash"],
    location: "Lower Static District, outside a noodle stall near the transit line",
    status: "active",
    private: {
      visibility: ["companion_pc", "lore_only"],
      beliefs: ["Suspects the job Reyes is about to take is a corp trap, but doesn't have proof yet."],
      fears: ["Getting ICE-burned on a run with no one able to pull her out in time."],
      personal_goals: ["Build enough of a reputation to start picking her own jobs"],
      suspicions: ["The client contact hasn't given a real name."],
      unresolved_questions: ["Who actually owns the job?"],
      relationship_opinions: { reyes: "Useful, maybe trustworthy. Still watching." },
      tactical_preferences: [
        "Stay out of the direct line of fire",
        "Handle problems through the net before they become physical",
      ],
    },
  };

  state.writeSlice(id, "characters", { human, companions: [runner] });

  state.writeSlice(id, "scene", {
    location_name: "Lower Static District, transit-line noodle stall",
    description_public:
      "Rain sheets off a cracked awning; the noodle stall's the only warm light on the block. A contact is late.",
    present_npcs: [],
    environment: "Wet pavement, distant traffic drone, flickering signage.",
    hazards: [],
    objectives_public: ["Meet the contact and get the job details"],
    unresolved_questions_public: ["Who is the client, really?"],
    combat_active: false,
    initiative_order: [],
    round: 0,
    dm_notes:
      "DM truth (dm_private): the 'client' is a shell for Ashvale Dynamics staging a recovery of data it itself " +
      "leaked, not a theft. None of this is established to the players yet.",
    visibility_note: "dm_notes is dm_private/lore_only",
  });

  state.writeSlice(id, "quests", [
    {
      id: "quest-static-job",
      title: "The Static District job",
      player_visible_description:
        "A contact reached out through Vex's usual channel with a data job, no client name given yet, cash up front.",
      status: "open",
      originating_event: "Message came in six hours ago",
      known_objectives: ["Meet the contact, learn what the job actually is"],
      hidden_stakes: "The client is a shell for Ashvale Dynamics staging a recovery of data it itself leaked.",
      relevant_entities: ["Vex", "unnamed contact"],
      consequences_triggered: [],
      unresolved_questions: ["Who is the real client?"],
      visibility: "public",
      provenance: "Session 1",
    },
  ]);

  state.createCheckpoint(id, "Neon Sprawl demo seeded", "session_start");
  console.log(`Seeded Neon Sprawl demo campaign: ${id}`);
  return id;
}

if (require.main === module) {
  run();
  runNeonSprawl();
}

module.exports = { run, runNeonSprawl };
