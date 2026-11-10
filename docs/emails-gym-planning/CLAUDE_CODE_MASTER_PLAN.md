# Email's Gym — Master implementation plan for Claude Code

**Version:** 1.0 · **Created:** 2026-11-10 · **Status:** Implementation specification, NOT authorization to publish unreviewed training programs.

## 0. Mission, context, authority

Extend the **existing** private mobile-first iPhone PWA (a fork) with a unified workout-and-program system that supports three creation routes:

1. **Explore templates:** choose a curated, versioned, evidence-informed workout or multi-week training program.
2. **Build for me:** answer a short multiple-choice questionnaire to generate an *editable* workout or program using explicit, deterministic rules and vetted source templates/components.
3. **Create from scratch:** unrestricted authoring of one-off workouts and multi-week programs with optional guidance.

**Every route must converge on the same user-owned workout/program editor, logging pipeline, scheduler and progress reporting.** A workout is a reusable session; a program is an ordered or scheduled set of sessions over weeks. Do not implement three parallel trackers.

The repository has NOT been supplied here. **Audit it before editing anything.** Do not assume framework, database, ORM, auth, offline sync, Fitbit permissions, or existing feature behavior. Preserve existing workouts, cardio data, body weight, heart rate, Fitbit import, social functions, and historical records. Do not copy the upstream fork's branding or third-party fitness app visual identity.

### Input precedence
1. Existing actual repository structure and stable data contracts (inspect, don't invent)
2. This master plan and agreed three-route product behavior
3. `data/program-library-UNREVIEWED.json` + deliverables A–E: **source evidence and draft prescriptions, not production migrations**
4. `research/EMAILS_GYM_PROGRAM_AUDIT.md`: blockers/gates to honor
5. `design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md`: approved sage/charcoal visual language

Where research notes and product rules differ, state the conflict in the audit report; do not silently pick whichever seems convenient. The numeric safety/progression thresholds in the supplied research files are **implementation/coaching defaults, not clinically validated universal rules**.

## 1. Nonnegotiable product requirements

- A user can create **a workout OR a program** through *each* of the three routes.
- Curated templates are read-only and versioned. Selecting one creates an enrollment or editable user copy; never mutate the published template.
- Questionnaire results are previews, **not auto-enrollment**. Users can accept, adjust, regenerate eligible parts, save, or cancel. No opaque LLM invention is required for v1.
- Manual builder imposes no arbitrary scientific rules. It can display informative warnings but must not block unusual-but-valid custom schedules, volume or exercise selection (except hard data integrity / security checks).
- Workouts authored manually can be saved in a personal library and reused in different programs; edits to a shared reusable workout must have well-defined copy-vs-update semantics.
- A curated workout/program can be duplicated and edited, with provenance retained, never modifying the original.
- Program sessions connect to the existing workout logger. Actual logged data remain the source of truth. Program completion and performance charts derive from those events.
- No silent changes to working weights, schedules, program membership or completed history; progression produces user-confirmable **recommendations**, not mutations.
- Correct handling of load units (kg/lb), per-side sets, bodyweight sets, timed holds, cardio blocks, rests, warm-ups and optional RIR.
- Offline-first where existing app supports it: reload mid-session without losing data; idempotent sync/retry.
- Private wearable metrics and health information never appear in leaderboards without explicit opt-in.
- No claim that AI-generated/personalized plans or any curated programs were medically or clinically validated.

## 2. User experience and navigation

### Programs / Workouts entry
Create a discoverable **Training** area or extend existing navigation (prefer established patterns). Above the fold: current program or today's workout, then 'Create' and 'Browse'. 'Create' opens **three clear options**: **Explore templates**, **Build for me**, **Create from scratch**. Support **Workout / Program** selection inside each route. Use the existing tab system; do not add extra tabs if they impair one-handed iPhone navigation.

### Route A — curated
- Browse with clear chips (goal, days/week, time/session, experience, equipment, workout vs program).
- Card: title, primary goal, experience, week count or standalone, days, estimated duration range, equipment, short training approach.
- Detail: full week preview, session content, prescribed sets/reps/time/RIR/rest, progression explanation, modifications, safety note, science-source links where verified.
- CTA: **Start program** or **Use workout**; secondary **Duplicate & edit**.
- Starting pins immutable programVersion. Active user overrides live on enrollment, never template.
- Only `review_status=approved` content is browsable by default. Hide or clearly label draft programs in a developer-only screen.

### Route B — questionnaire (minimal initial flow)
Ask only necessary questions and keep a persistent back/edit route:
1. Outcome: one workout vs complete program.
2. Main goal: muscle, strength, general fitness, strength+cardio, cardio endurance (display layman descriptions).
3. Experience: beginner, intermediate, advanced, with concise definitions.
4. Days available per week (program only) and days constraints; **not every desired combination has a valid plan**.
5. Session time: 30, 45, 60, 90+ minutes (or flexible).
6. Equipment: full gym, basic dumbbells, bodyweight; verify exact available equipment for matching.
7. Preferred emphasis: balanced, upper, lower, aerobic (optional).
8. Exclusions/limitations: movement preference and a basic 'needs professional guidance' flag; do not solicit unnecessary health history or auto-prescribe rehab.

Use **hard compatibility filters first** (goal, experience eligibility, required equipment, time, days, exclusions and safety rules) and then a *transparent* preference score. Present up to three explainable matches with 'why it fits' and compromises. If none fit, say **No safe compatible template yet** and offer modify answers / manual creation; do NOT hallucinate a new expert plan. The v1 personalization engine should assemble only from approved prescriptions/templates and validated adaptation rules. Derived program = user-owned snapshot with `generator_version`, input answers, and provenance. Preview/edit before save.

For a single personalized workout, prefer approved session templates compatible with the answers. For multi-week programs, use approved complete program families or intentionally supported transformations; don't simply drop/add training days to a 4-day program.

### Route C — manual
- Start blank workout or blank program, name it, optionally add an icon and short note.
- Add existing exercises via search/filter; create private custom exercise with explicit modality/unit.
- Configure multiple sets: rep range or target reps, load or bodyweight, timed holds, rest, RIR/RPE optional, unilateral, warm-up, notes.
- Add cardio: modality, duration/distance, perceived intensity, optional structured intervals.
- Reorder exercises, duplicate a set/exercise/day, add circuits/supersets if supported safely by logger.
- Program builder: add existing personal workouts, new workouts, rest days; reorder; choose fixed calendar days or next-session queue; repeat weeks / set different week prescriptions; save as draft; preview.
- Manual users may opt into optional progression suggestions *after logging*, without claiming scientific validation.
- Provide Undo or cancel/discard confirmation when destructive; keep autosave drafts where possible.

### Shared screens
1. Training overview (active program, next workout, week completion, quick start).
2. Template catalog and detail.
3. MC-questionnaire and result preview.
4. Unified workout editor.
5. Unified program editor/week overview.
6. Existing live workout logger extended with prescription, previous performance, timer, optional RIR, substitution.
7. Post-workout summary (comparison, optional progression suggestion accept/dismiss).
8. User workout/program library; duplicate, archive, rename, start, pause, resume and complete.

Design: leverage `design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md`, near-black background, off-white text, restrained sage; **no purple/neon/orange-heavy UI**. Use existing UI components and Google Font choices in design handoff. iPhone safe-area, 44px touch targets, accessible contrast, offline feedback, screen reader labels.

## 3. Canonical domain model (conceptual; map onto actual repository)

> Implement the smallest additive model compatible with actual storage. Names here are logical entities, NOT required new tables.

- **ExerciseDefinition**: stable ID, display name, modality (`resistance_reps`, `isometric_seconds`, `cardio_continuous`, `cardio_intervals`, `other`), equipment, movement pattern, muscle metadata, sidedness, allowed input units, source (`system`/`user`), owner. User custom exercises must be private by default.
- **WorkoutDefinition**: stable workout ID, owner/type (`curated`/`generated`/`manual`), title, source ID/version, revision, draft/published status, list of ExercisePrescriptions and cardio items, estimated duration.
- **ProgramDefinition**: stable ID, version, goal, experience, duration, equipment, provenance, `review_status`, immutable published content; week/session graph references workout definition snapshots or versioned IDs.
- **ProgramEnrollment**: user, pinned definition+version, start, status (`active`/`paused`/`completed`/`cancelled`), next session, schedule settings, individual substitutions and overrides.
- **ProgramSession**: stable instance ID, enrollment, sequence index, originating workout definition/version, scheduled date optional, status, linked completed workout ID.
- **CompletedWorkout / CompletedSet**: REUSE existing event/history entities; extend only with optional program session/definition/instance pointers; never overwrite historical load/rep data.
- **ProgressionRecommendation**: rule ID/version, immutable input snapshot references, proposed change, reason text, confidence, accepted/dismissed decision.
- **GeneratorResult**: snapshot of questionnaire answers and generator version, matched template IDs/versions, transformations, user edits; avoid storing medical sensitive detail unless genuinely necessary.
- **ExerciseSubstitution**: contextual and versioned; permitted swaps depend on the program's goal and movement, and don't auto-copy numeric loading targets.

### Typed prescription design (adapt names to repo)

Use discriminated unions; do not represent timed holds using `reps`:

```ts
type ResistancePrescription = {
  kind: 'resistance_reps'; exerciseId: string; sets: number;
  reps: { min: number; max: number }; targetRir?: number | null;
  restSeconds: number; unilateral?: boolean;
  loadTarget?: { value: number; unit: 'kg' | 'lb' } | null;
  isWarmup?: boolean; notes?: string;
};
type IsometricPrescription = {
  kind: 'isometric_seconds'; exerciseId: string; sets: number;
  seconds: { min: number; max: number }; restSeconds: number;
  unilateral?: boolean; notes?: string;
};
type ContinuousCardio = {
  kind: 'cardio_continuous'; modality: string;
  durationSeconds: number; intensity: { type: 'talk_test' | 'rpe'; value: string | number };
};
type IntervalCardio = {
  kind: 'cardio_intervals'; modality: string;
  warmupSeconds: number; workSeconds: number; recoverySeconds: number;
  repeats: number; cooldownSeconds: number;
  totalSeconds: number; // computed; reject mismatches
  workRpe?: number;
};
type SessionItem = ResistancePrescription | IsometricPrescription | ContinuousCardio | IntervalCardio;
```

This union is an **initial target specification**, not a claim that existing JSON already implements it. Specific fields may need further handling for distance, bilateral load semantics, circuits and supersets.

### State and version rules

- Definitions and logs are distinct. Editing prescriptions after completing sessions never modifies historical completions.
- User-generated and manual drafts can evolve; publishing a reusable revision makes an immutable snapshot or revision.
- Template updates create new version. Existing enrollees remain pinned unless explicitly migrated with preview.
- Copy/duplicate operations create new IDs and `derivedFrom` provenance.
- One active program per user **only if** the current app UX requires it; otherwise support multiple and clarify how today's sessions are ordered.
- Calendar dates are not the definitive definition of week completion; use program session sequence/completion states.
- Archived does not mean deleted; preserve audit trail and dependencies.

## 4. Research and program content ingestion — hard safety gate

The included `data/program-library-UNREVIEWED.json` is the seven-program, eight-week source dataset. It **must not be directly offered as approved templates**.

Known P0 defects from `research/EMAILS_GYM_PROGRAM_AUDIT.md`:
- Cardio interval instructions conflict with scaled `minutes` in multiple weeks (`hybrid-4` week 8, `conditioning-3` multiple weeks). **Do not silently shorten fixed interval work.** Rewrite and explicitly reapprove week-by-week segments.
- Plank time is represented as reps; add explicit seconds-based prescription types.
- Program-template exercise `alternatives` arrays are empty despite global catalog substitutions. Implement goal-aware, vetted replacements or no swap option where no approved match exists.
- Missing complete typing for unilateral, units, bodyweight, cardio inputs and load increments.

Additional important gates:
- Correct per-session time estimates; avoid showing `session_minutes` as accurate for every day in hybrid/conditioning.
- Resolve static calendar cardio durations vs the adaptive engine's actual-performance progression rule.
- Audit exercises for volume, exercise order, recovery and realistic duration; qualified coach review before offering plans to friends.
- Attach evidence provenance to policy claims. Research itself states the exercise plans are not experimentally validated.

**Content pipeline:** source JSON → migration/mapping utility → typed canonical draft JSON → structural validator → semantic checks (cardio sums, modality-specific unit, week length, exercise references, equipment, substitutions, coverage, expected time) → human coaching review/approval → versioned published templates. Generate correction log and don't pretend automatic validation amounts to coaching approval.

**Review states:** `draft`, `needs_review`, `approved`, `retired`. UI only exposes approved to users; QA/dev-only preview may show drafts with unmistakable labels. Maintain an approval record: reviewer identity, date, changed version and notes.

**Suggested pilot:** Foundation 2/3 and Build 4 after validated; then Strength 4, Efficient 3, Hybrid 4 and Conditioning 3 as individually approved. These are only the seven supplied variants; don't claim every goal/schedule combination is covered.

## 5. Personalization engine v1: deterministic, explainable

Implement a pure function `matchPrograms(questionnaire, approvedCatalog, userEquipment)` returning `{matches, exclusions, explanations}`. Strict hard filters first (no unsupported days, goal/level, incompatible gear, time ceiling where justified, hard exclusions). Rank eligible matches using versioned weights selected by product team, not asserted scientific optimality. Returning zero results is valid.

For each candidate show: title, match rationale, schedule, equipment, time range, deviations from preference, explicit optional substitutions. On 'Generate', clone a validated compatible program into user's draft and apply ONLY approved transformations e.g. approved exercise substitutions or schedule-day rearrangement without changing relative session order/recovery constraints. Do **not** generate new weekly progression data by string concatenation or open-ended AI in v1.

If user's answers indicate unsupported or potentially clinical limitations, avoid automated program claims. Show a safe explanation and an option to proceed manually or seek professional advice, depending on risk. Keep protected health inputs minimal and private.

Suggested acceptance fixture: intermediate user, 4 days, full gym, 60–90 min, hypertrophy → Build 4 only if duration compatible and approved; beginner, 2 days, dumbbells-only → no falsely matched commercial-gym plan; beginner, 2 days, full gym → Foundation 2 if approved; 5 days bodyweight-only → no-match until supported plan exists.

## 6. Progression engine: recommendation-only

Use `research/D-adaptive-training-system.md` as **draft policy**, reconcile all edge cases before implementation:
- Inputs: comparable same-exercise performance, set targets, actual load/unit, completed reps/time, optional RIR, technique flag, symptom flag, history, smallest available equipment increment; missing values remain missing.
- Safety/critical symptoms → no progression recommendation, show appropriate stop/review advice.
- Missing required data → `INSUFFICIENT_DATA` or low-confidence suggestion (specify exact behavior in tests). Never manufacture RIR/form data.
- For rep-based lifting, if all sets meet upper rep target with target RIR and stable technique, propose smallest feasible increase within configurable cap; otherwise hold or build reps. Repeated decline → optional fatigue review.
- For isometric holds use a **separate duration progression policy**; do not use rep/load double-progression blindly.
- For unilateral work, verify completion/quality for each side or explicitly record 'per-side' conventions.
- For cardio, distinguish **planned** week progression from **earned** progression based on user tolerance. Use segment arithmetic and perceived exertion; watch metrics are context, not authority.
- Every suggestion includes a reason, exact inputs, threshold policy version and accept/dismiss action. Reject or dismiss must preserve original logs and schedule.

Do not add live 'readiness scores' in v1. Fitbit-resting-HR, steps and similar metrics can display as optional context only if repository scopes and user permission allow them. Avoid unverified physiological accuracy claims.

## 7. Engineering implementation phases (implement vertical slices)

### Phase 0 — repository reconnaissance and change plan (required before any code)
Inspect package manager, framework, routing, state management, auth, database schema and migrations, exercise library, workout logging, completed set model, PWA configuration, offline queue, Fitbit ingestion and sharing visibility. Map each proposed entity to actual ones. Deliver `REPO_AUDIT.md`, targeted migration map, risk register and tests inventory. Run existing tests to establish a baseline. Never delete or rename existing data without specific approval.

**Gate:** written mapping, no data-destructive assumptions, existing tests baseline recorded.

### Phase 1 — canonical workout/program primitives + private drafts
Implement typed exercise input and reusable workout definitions, plus private drafts and manual workout create/edit/save/copy. Bridge to existing logging; no new parallel logger.

**Gate:** existing workouts still log correctly; private custom workout saved/reopened; isometric and unilateral examples persist correctly; no corruption to history.

### Phase 2 — manual program builder
Weeks, session references, schedule/order, add from personal workouts, duplicate, reorder, preview, save/pause/resume/clone. One-off workouts remain distinct from program sessions.

**Gate:** build a 4-week 3-day program from reusable workouts; record a session; edit next week without touching completion history.

### Phase 3 — template ingestion with validation and approvals
Build import/mapping utility, typed schema, validators, per-program review state/version, read-only catalogue and detail, duplicate or enroll. First import supplied dataset as **draft only**. Fix P0 issues in separately documented corrections and conduct expert review before setting approved.

**Gate:** no P0 issues, accepted content signoff, approved templates browseable, draft templates invisible outside dev mode.

### Phase 4 — questionnaire-driven generator
Short form, hard matching, transparent fit score, three suggestions, no-match behavior, editable generated preview, provenance and deterministic transform rules. It should reuse Phase 1/2 editor.

**Gate:** same input/catalog version yields same plan; incompatible equipment never recommended; user edits never change source templates.

### Phase 5 — enrollments + existing logger integration
Program session instances, next-session queue, scheduled dates optional, start workout, log, complete, reschedule/skip, progress view; preserve existing workout history.

**Gate:** end-to-end iPhone flow with restart and offline cases; no duplicated sets on reconnect.

### Phase 6 — adaptive recommendations
Implement deterministic policy engine by modality, rule versions, user accept/dismiss, clear post-workout copy. No wearable-driven automatic adjustment.

**Gate:** comprehensive edge-case tests incl. kg/lb, plank, unilateral, missing RIR, massive weight increments, pain flag, bad session, time away, intervals and no duplicate suggestions.

### Phase 7 — UX and regression hardening + friend pilot
Polish with approved design system, performance and accessibility, security/privacy, attribution, onboarding and source explanations. Coach-reviewed pilot content, opt-in, capture usability feedback. Do not leak private wearable/health data in leaderboard.

**Gate:** all flows work on real iPhone PWA; complete regression suite; product owner signs off on design and revised program prescriptions.

**Order can be adapted to existing repo** if justified by the audit. Suggest small, reviewable PRs and migrations; don't combine all phases into one unchecked rewrite.

## 8. Test matrix / release acceptance

| ID | Scenario | Pass condition |
|---|---|---|
| T01 | Create a manual single workout | Saved and reusable without enrollment |
| T02 | Create multi-week manual program | Editable weeks, sessions, rest day and optional scheduling |
| T03 | Reuse workout across programs | No accidental cross-program edits or historical rewrites |
| T04 | Duplicate curated template | New user-owned ID, source intact, provenance preserved |
| T05 | Enroll in curated version | Pinned version; latest publication does not modify in-progress sessions |
| T06 | Questionnaire valid match | Deterministic and explainable approved-only recommendation |
| T07 | Questionnaire impossible combination | No invented plan; clearly describes why no match |
| T08 | Timed plank | Seconds logged and progressed as timed hold, never rep count |
| T09 | Unilateral exercise | Per-side semantics explicit, no double-count or unchecked weight changes |
| T10 | Cardio intervals | Computed seconds equal warmup + repeated work/recovery + cooldown |
| T11 | Record offline then reconnect | One completed workout; no duplicate sets |
| T12 | Resume mid-workout after app closed | Draft and timers handled without losing logged sets |
| T13 | Decline progression suggestion | No changes to completed history or prescribed future target |
| T14 | Missing RIR/form flag | No fabricated values; confidence/action policy respected |
| T15 | Program schedule change | Historical workout links persist; no session duplication |
| T16 | Invalid substitution | Excluded or explained; no previous-load carryover |
| T17 | Existing legacy workouts | Existing logs, charts, Fitbit and social views unaffected |
| T18 | Data visibility | Friend cannot see detailed private wellness/Fitbit records by default |
| T19 | Published content approval | Draft/unreviewed program not visible as approved |
| T20 | UI accessibility | Proper labels, focus, contrast, thumb reach, small iPhone viewport |

Automated test types: JSON-schema/TypeScript/Zod validation, unit policy tests, data migration/snapshot tests, integration (logger/enrollment), E2E iPhone viewport and offline/reconnect tests. Exact test framework should match the actual repository.

## 9. Completion and reporting contract for Claude Code

For each phase return:
- actual files changed and migration details
- data model mapping (existing reused vs new)
- what is functional vs stubbed vs deliberately deferred
- screenshots/preview of relevant screens if available
- exact commands and tests run, their results, failures and known limits
- any unresolved source-data issues or coach-review blockers
- explanation of any deviation from this plan

**Never claim ready-to-ship because JSON parses or UI renders.** Completion means successful scenarios, not merely code generation.

## 10. First message to Claude Code

> Read `CLAUDE_CODE_MASTER_PLAN.md` and `research/EMAILS_GYM_PROGRAM_AUDIT.md` completely, then inspect this repository. Begin with **Phase 0 only**: identify the existing database, exercise catalog, workouts, set logging, routes, session state, offline handling and PWA architecture. Produce `REPO_AUDIT.md`, a mapping from the supplied domain model to existing objects, a non-destructive migration plan, and a test baseline. Do not modify production data or implement the program library yet. Treat `data/program-library-UNREVIEWED.json` as research-stage source data, not approved user-facing prescriptions. Once Phase 0 is complete, propose the smallest Phase 1 PR and start implementing it unless a destructive data migration or other genuinely blocking decision requires approval.

## 11. Included research and source provenance

Read `research/A-exercise-science-report.md`, `research/B-training-methodology.md`, `research/C-program-library.md`, `research/D-adaptive-training-system.md`, and `research/E-claude-code-spec.md`. These are user-provided research deliverables. The source review itself acknowledges that some claims are reconstructed and not independently verified; preserve that disclosure. Jeff Nippard's public educational approach is background context only; **do not copy his commercial program content**.
