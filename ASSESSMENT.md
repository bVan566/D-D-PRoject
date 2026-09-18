# D&D Duo Engine — Architecture & Gameplay Assessment

Written after inspecting the full `DnD_Duo_Engine_MVP_0.2` package (agent specs, core
architecture, Campaign 001 state, and the two completed prototype-test records).
This is an evaluation of what was delivered, not a rewrite.

## 1. What this project actually is

There is no executable code in the package. The "engine" is a corpus of markdown/text
specification documents meant to be loaded as context into a single LLM conversation,
where one model plays DM, Player Agent (Mira), and Lore Agent in the same thread by
following role instructions. Persistent state lives in external documents (the resume
protocol references Google Doc file IDs, not files included here) that a human operator
loads in a defined order at the start of each session.

This matters for everything else below: every boundary in the system — DM/Player/Lore
separation, hidden information, canon authority — is currently enforced by **prompt
discipline inside one context window**, not by any access-control mechanism. The
project's own `RUNTIME_SAFETY_ISOLATION.md` says this explicitly: it calls the current
setup "logical... not a cryptographically or process-isolated security boundary" and
names separate agent contexts / filtered state projections as the target for "a future
packaged/multi-user implementation." That target is exactly what a real UI + backend
can deliver, and it's the main technical gap this review focuses on.

The good news: this is not a first draft. Two prototype tests were actually played
(Greymark Road / Brackenford, Sessions 001–002, human player "Billy" + AI companion
"Mira"), evaluated, and used to drive two real patches (Player Agent 0.2.1, DM
Fast-Flow 0.2.2). That's a working feedback loop with real play evidence behind it,
which is unusual and worth preserving as a practice, not just a codebase.

## 2. Architectural uncertainties / contradictions found

- **No shipped persistence backend.** `CAMPAIGN_MANIFEST_RESUME.txt` lists authoritative
  Google Doc file IDs that aren't part of this package. As delivered, "resume the
  campaign" requires a human to manually reconstruct a document environment.
- **Isolation is a promise, not a barrier.** Mira's private state
  (`MIRA_COMPANION_STATE.txt`) and the DM's private truths (`DM_PRIVATE_RUNTIME.txt`)
  are separate *documents*, but nothing stops the same model instance (or a careless
  operator) from having both open in one context. The Player Agent boundary depends on
  the model choosing not to use what it can see, not on it being structurally unable to
  see it — which directly conflicts with your requirement that the Player Agent "must
  not have access to DM-only information."
- **Two overlapping precedence documents.** `CORE_ARCHITECTURE_MVP_0.2.txt`'s
  "SOURCE-OF-TRUTH PRECEDENCE" and `CAMPAIGN_MANIFEST_RESUME.txt`'s "AUTHORITATIVE LOAD
  ORDER" both rank the same documents but aren't identical lists. Not a bug that's bitten
  anyone yet, but worth collapsing into one list before it does.
- **Claimed compatibility enforcement doesn't exist.** `SYSTEM_MANIFEST.json` states
  "Runtime must refuse or escalate incompatible state/schema/agent combinations," but
  there is no runtime capable of refusing anything — a human pastes in whichever
  document versions they have open. Right version selection is currently on the honor
  system (e.g. the README telling the operator to load `PLAYER_AGENT_v0.2.1.md` "in
  place of" v0.2).
- **Fast-Flow's self-policing has no backstop.** DM 0.2.2 tells the model when to do a
  "deep lookup" vs. act from active state, which is good UX design, but there's no
  structural cache or diff mechanism — if the model misjudges a trigger, nothing catches
  it except a human noticing later (as happened with the six-week timeline slip in
  Session 002, which *was* caught, but by the human player, not the system).

## 3. What I'd preserve

- **The authority model itself.** "DM controls the world. Players control their
  characters. Lore controls the record" is the right cut, and the detailed role-lock
  matrix under it correctly anticipates the real failure modes (companion-as-hint-engine,
  DM railroading, Lore inventing lore to fill gaps). I would not change this.
- **The epistemic/claim model.** Distinguishing `objective_fact` / `observed` /
  `reported_claim` / `inference` / `belief` / `disputed`, with provenance on every fact,
  is a genuinely strong piece of design — most hobbyist systems (and plenty of shipped
  products) don't bother separating "an NPC said X" from "X is true." Keep it as the
  backbone of the state schema.
- **Flow-first rules philosophy.** "Don't roll for the obvious," "failure moves the
  story forward instead of dead-ending it," "one meaningful check, not a chain" — this
  is playtested and it works in the Session 001–002 logs. Don't touch it.
- **The controlled-learning loop as a practice**, not just its output: play → measure →
  analyze → recommend → human approval → durable update, with an explicit rule that
  learning can improve execution but can never quietly expand an agent's authority. This
  is a good governance instinct and should carry into any UI-driven version.

## 4. What's fragile or incomplete

- **Everything is soft-enforced.** This is the central fragility, repeated because it's
  the one that maps directly onto your stated hard requirement ("do not expose hidden
  information to the Player Agent"). Right now that's true only if the model faithfully
  self-censors.
- **No UI, no real datastore, no dice/HP/inventory tracking.** Play currently means
  manually pasting documents into a chat and tracking everything else by hand or in
  prose. This is the gap you asked me to prototype a fix for.
- **Combat and tactical Player-Agent independence under real danger are explicitly
  untested.** Both Test 001 and Test 002 evaluations flag this as open coverage, and the
  stat blocks/encounter design in `DM_PRIVATE_CONTINUATION_TEST_002.txt` have never been
  exercised in play.
- **The 0.2.1 independence patch is unvalidated.** The package diagnoses Mira's
  passivity clearly and writes a good fix, but there is no Test 003 evaluation in this
  package. As delivered, you have a well-reasoned patch and no evidence yet that it
  worked in actual play — worth being precise about that distinction rather than treating
  the patch as a solved problem.

## 5. Is the DM / Player / Lore separation being preserved correctly?

Yes, on paper, and partially in the one place it's been play-tested (information
boundaries: Mira never leaked her Orren/travel-papers connection or DM-private facts
across two real sessions — that part held up). Where it's weaker is participation
independence: the boundary "Mira must not act on hidden information" held, but the
adjacent requirement "Mira must behave like an independent player, not a tagalong" did
not hold in Session 002 and had to be patched. Those are two different guarantees that
are easy to conflate — the package now correctly treats them separately (0.2.1), which
is the right fix; it just hasn't been confirmed in play yet.

## 6. Does the Player Agent have enough independent agency?

The *specification* is strong: explicit independent-player loop (perceive → form a
response → choose whether to act → declare → await adjudication → react), anti-passivity
and anti-domination guardrails, private belief/fear/suspicion state that can influence
choices without becoming world truth, and a hard rule that she declares actions but never
self-authorizes checks (that stays with the DM, correctly, since a player character
doesn't get to decide its own dice succeed). This is a well-built spec for the exact
symptom you described.

Whether it *produces* enough agency in a live session is still an open question the
package itself hasn't answered yet (see §4). A UI can't fix an LLM's tendency toward
deference on its own, but it can make the gap measurable instead of impressionistic —
tracking companion-initiated action counts and passivity streaks as real counters rather
than post-hoc narrative self-report. I've included that in the prototype's state model.

## 7. Can the engine maintain campaign continuity cleanly across sessions?

Structurally, yes — the schema (canon status, visibility, provenance, timeline,
checkpoints, rollback/recovery cases) is thorough, and the two real sessions in this
package demonstrate it working, including one genuine continuity correction (the
six-week vs. twelve-day disappearance timeline) that was caught and resolved with the
audit trail the spec calls for. The risk isn't the model of continuity, it's the
delivery mechanism: it depends on a human correctly finding and loading the current
version of ~7 documents in the right order every time, with no automated check that
they did. Replacing "human finds the right Google Doc" with "server loads the one
current JSON record for this campaign" removes that risk category entirely without
changing anything about the continuity model itself.

## 8. Recommendation

Preserve the authority model, the epistemic/claim model, the flow-first rules
philosophy, and the controlled-learning practice unchanged — they're sound and
field-tested. Don't redesign the agents. The one structural upgrade worth making is the
one the project's own docs already call for: move from single-context logical isolation
to real server-side filtered projections, so "the Player Agent doesn't have DM-only
information" is something the system enforces rather than something the model promises.
That's the core of the UI/backend prototype built alongside this assessment.
