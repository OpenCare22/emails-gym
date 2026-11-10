# Phase 0: repository audit for the workout and program library

Date 2026-11-10, against `main` at `3dc55297a`. Answers §7 Phase 0 of
[CLAUDE_CODE_MASTER_PLAN.md](CLAUDE_CODE_MASTER_PLAN.md). Nothing in the app changed for this.

## The short version

The fork already has most of the model the plan describes, under other names. A "workout" is a
**routine**, a "program" is a **programme** (1 to 16 weeks, running on weekdays or as a loop), the
logger and history are shared by both, and the progression engine already explains every number
and never rewrites history. So this is a job of **extending what exists**, not adding a second
tracker. Route C (create from scratch) works today. Route A has a small start (starter plans). Route B
has nothing deterministic (the Coach intake is an AI chat).

What the research library needs and the app can't hold yet:

1. **Sets and RIR that change week by week.** Programme weeks change only the load (%1RM, RPE,
   deload). The library's weeks change set counts (`set_delta`), RIR (`rir_offset`) and cardio
   minutes (`cardio_scale`).
2. **Structured interval cardio.** Cardio is rows of minutes plus speed. There's no warm-up/work/recovery
   segment type, and the audit's P0.1 needs one.
3. **A catalogue of versioned, read-only templates** with a review state and provenance.
4. **A deterministic questionnaire matcher.**
5. **Pinned enrolment.** A running programme points at the user's own editable copy, not at a
   frozen version.

## Stack (what the plan said not to assume)

| Area | What it is |
|---|---|
| Frontend | React 19 + Vite, React Router, Zustand. No TypeScript, no Zod. Plain JS with JSDoc; validation is hand-written (`normalizeProgramme`, `plan-share.js parsePlan`). |
| Backend | Plain `node:http` (`api/server.js`), three dependencies. |
| Database | None. Each profile is one JSON document (`data/state-<uid>.json`), written temp-then-rename. No migrations framework. "Migration" means a reader that accepts the old shape. |
| Sync | One document per profile with a revision. A 409 is merged field by field (`lib/sync-merge.js` ↔ `api/sync-stamps.js`, parity test). `programmes` is stamped per programme id (`PER_KEY`), so new fields inside a programme sync without a server change. A new **top-level** key needs both sides changed. |
| Offline | State persists to `localStorage` (`gym_state_v1`), debounce-pushed. A running workout is `S.active` and survives reloads. The service worker caches the app shell, not the API. |
| Auth | Passkeys bound to `emailsgym.com`, invite-only. |
| Tests | Vitest (frontend, about 7,450), `node --test` (api, 793). See "Baseline" below. |
| Wearables | None connected. Fitbit/Google Health is PLAN.md Phase 4. Home says "Not connected". |
| Social | Friends screen only (`FRIENDS_SCREEN`). The friends API is off (`FRIENDS_API=false`), so nothing about a user is shared with anyone. |

## Mapping the plan's model onto the app

| Plan entity | In the app | Fit |
|---|---|---|
| ExerciseDefinition | Catalogue `catalogue/exercises/<id>.json` (6,554 records with name, equipment, target, secondary muscles, category) plus `S.customEx` (private to the profile). Modality is per **slot**, not per exercise: `cfg.mode` = `reps` \| `time` \| `cardio` (`lib/history.js modeOf`). | Good. Modality lives on the prescription, which is what P0.2 asks for. |
| ResistancePrescription | A routine slot `{ id, sets, reps, repsMin, weight, rest, note, warmupSets, side, bodyweight, intensifier, policy… }`. The rep range is `repsMin`..`reps` (`lib/rep-range.js`). | Good. No per-slot target RIR (only a programme week's RPE per exercise). |
| IsometricPrescription | `mode: 'time'`, `sec`, optional `side` (a per-side hold is laid out as L and R rows). | Exists. Not a range: one target duration. |
| ContinuousCardio | `mode: 'cardio'`, `{ min, speed, incline }` per row. | Exists. No talk-test or RPE intensity field. |
| IntervalCardio | No equivalent. Rows of `min`+`speed` can approximate it, with no repeats or segment roles. | **Gap** (P0.1). |
| Unilateral | `side: true`. Reps logged as the total of both sides; the per-side split is derived (`sideReps`). | Exists; convention documented in `history.js`. |
| Load unit | Profile unit `S.unit`, an exercise can be pinned to the other (`S.exUnit`, `lib/ex-unit.js`). Increments per exercise, owned dumbbells, plates. | Exists, thorough. |
| Bodyweight sets | `bodyweight: true` (w = added load). | Exists. |
| RIR / RPE | Per set `rir` XOR `rpe`, optional, never invented (`EFFORT`, `lib/effort.js`). | Exists. Matches "missing stays missing". |
| Warm-ups | Automatic ramp, own rows, or none (`warmup-ramp.js`). | Exists. |
| WorkoutDefinition | `S.routines[]` `{ id, name, emoji, ex: [slot…] }`. Copy = `copyRoutine` ("(Copy)", new id). | Good. No `derivedFrom`, no revision, no draft state. |
| ProgramDefinition | `S.programmes[id]` `{ id, name, at, weeks[], days \| sequence, src? }` (`lib/programmes.js`). Week = `{ deload?, rpe?, t: { exId \| 'rid:exId': { pct?, rpe? } } }`. One schedule for every week. | Partial. No per-week sets/RIR/cardio, no version, no review state, no goal/level/equipment metadata. |
| ProgramEnrollment | `S.programme` = the one running `{ id, startedOn, pausedOn?, cycle, bump, saved }`. Week = calendar week since start; pause moves it on. | Partial. One at a time (matches the app's UX). Points at an editable programme, no pinned version. |
| ProgramSession | None stored. The day's session comes from `S.week` / `S.rotation` / `S.queue`, which the programme writes on start. | Gap if we want "session 5 of 24" and skip/reschedule per session. Rotation already does skip and next-in-queue. |
| CompletedWorkout / Set | `S.workouts[]` `{ id, d, start, end, routineIds, name, bw, entries: [{ id, sets, target, planned, rid, noProg, sg, note }], prs, gym }` (`finish-workout.js`). | Reuse as is. Add an optional `prog: { id, week }` pointer; nothing else changes. |
| ProgressionRecommendation | `lib/progression.js`: named policies (linear, Greyskull, double, triple, time). The next target is **derived from history every time**, with the reason shown, and is never stored or written back. | Conflict, see below. |
| ExerciseSubstitution | `lib/exercise-substitutes.js` (reviewed catalogue IDs only), `active-exercise-swap.js` (swap during a session). | Partial. Not program-aware, no load carryover rule written down. |
| Template catalogue | `lib/starter.js`: four hard-coded plans (PPL, Upper/Lower, Full Body, 5×5), filtered by the profile's equipment, copied into ordinary routines. | Small start for Route A. Not versioned. |
| Import pipeline | `lib/plan-share.js`: a plan file (routines + schedule + custom exercises + programmes) merged in with fresh ids, bounded sizes, exercise id mapping. | A good base for the template importer. |
| GeneratorResult / questionnaire | `CoachIntake` exists, but it's the AI Coach (optional module). Nothing deterministic. | **Gap** (Route B). |

## Conflicts between the plan and the app (for Emil to decide)

1. **Recommendation-only progression vs the app's derived targets.** The plan wants every load
   change to be a suggestion you accept. The app opens the next session at the computed weight,
   shows why, and lets you change it; it never writes to history or to the routine. That already
   satisfies "no silent changes to completed history". It doesn't satisfy "user confirms before
   the target moves". Options: keep the app's way (the target is a suggestion you can edit in place),
   or add an accept/dismiss step on the post-workout screen for program sessions only.
   **My recommendation:** keep the app's way and show the reason more prominently. A second
   confirm step on every set target slows down logging, which the design handoff says comes first.
2. **One active programme.** The plan allows several. The app runs one, and Home's Today
   depends on that. Keep one.
3. **Calendar week vs session sequence.** The plan says completion should follow the session
   sequence, not dates. Programmes count calendar weeks (a missed session doesn't hold the block
   up). The library's week 1 has fewer sets, so a missed week matters less here than with %1RM.
   I'd keep calendar weeks and add a "repeat this week" control later if it's missed.
4. **Coach review gate.** Nothing from the research library can be marked `approved` until
   a qualified person reviews it (audit §Release gate). That needs a name from you: Claude can
   prepare the review sheet and fix the P0s, but can't sign it off.

## Research library vs catalogue

`tools/inspect_source_library.py`: 7 programs, 40 exercises, 0 structural errors, 97 warnings
(all 89 prescriptions have empty `alternatives`, plank is typed as reps, intervals in `hybrid-4` and
`conditioning-3` don't add up). All 40 library exercises have catalogue candidates. 9 match exactly
one record:

| Library id | Catalogue |
|---|---|
| deadlift | 0032 barbell deadlift |
| bench_press | 0025 barbell bench press |
| db_bench | 0289 dumbbell bench press |
| incline_db_press | 0314 dumbbell incline bench press |
| push_up | 0662 push-up |
| lateral_raise | 0334 dumbbell lateral raise |
| cable_lateral_raise | 0178 cable lateral raise |
| biceps_curl | 0294 dumbbell biceps curl |
| plank | 0463 front plank |

The other 31 have between 2 and 61 candidates and need a choice (the starter plans already
settled some: back squat 0043, RDL 0085, leg press 0739, lat pulldown 2330, seated row 1323, leg
extension 0585, calf raise 0605). The mapping is a reviewed table in the importer, never matched by
name at runtime, and no catalogue exercise gets duplicated.

## Non-destructive migration plan

The rule throughout: every field is optional and absent reads as today's behaviour, so old
workouts, backups, plan files and older installed apps keep working (the pattern `side` and
`bodyweight` already follow).

1. Programme week targets gain optional `sets` and `rir` per slot (`t[key].sets`, `t[key].rir`)
   and the week gains an optional `cardio` scale. `cleanWeek` keeps them; `session-start` applies
   them. No sync change (stamped per programme).
2. A new cardio `kind: 'intervals'` slot with segments; its total is computed, never typed. The
   logger shows one row per segment. Reading code that doesn't know it falls back to a cardio row.
3. Templates ship as a static file in the web image (`frontend/public/library/`), not in user
   state. Starting one copies it into `S.routines` + `S.programmes` with `src: { lib, id, version }`.
   The copy is the user's; the template file never changes. That copy is the pin.
4. Completed workouts gain optional `prog: { id, week }`.
5. Questionnaire answers and matches stay on the device (pure function over the static catalogue).
   Nothing health-related is stored or synced.

No existing key is renamed or deleted. No server change until step 4 (and then only
`openapi.yaml` docs, since the state document is opaque to the server).

## Risks

| Risk | Mitigation |
|---|---|
| Per-week sets fight the progression policy (double progression counts sets) | Week-changed sets apply as the slot's set count for that session; the policy reads hits against what was asked. Test it. |
| Older installed app drops the new week fields on save | `normalizeProgramme` spreads unknown keys at the top, but `cleanWeek` rebuilds weeks. Ship the reader first; the PWA updates on next open. Friends aren't on it yet. |
| Interval cardio breaks the watch, CSV export, Coach and stats readers | Keep each segment a normal cardio row on the completed workout; the interval structure lives on the plan side only. |
| Library content shown before review | `review_status` checked in the catalogue loader; only `approved` renders outside dev mode, with a test. |
| Licensed media | Library work touches no media. Exercise images stay the 180 px catalogue files. |

## Tests inventory (areas this work touches)

`lib/programmes.test.js`, `views/Programmes.test.jsx`, `lib/session-start*.test.js`,
`lib/progression*.test.js`, `lib/rotation*.test.js`, `lib/queue.test.js`, `lib/plan-share*.test.js`,
`lib/starter*.test.js`, `lib/finish-workout*.test.js`, `lib/sync-merge*.test.js` (+ the api parity
test), `lib/history*.test.js` (modes, per-side), `lib/effort*.test.js`.

## Baseline (Node 22, the CI version)

`main` at `3dc55297a`, in `node:22-alpine` (logs in `~/.cache/emails-gym-baseline/p3b-phase0`):

| Check | Result |
|---|---|
| api `npm test` | 796 tests: 793 pass, 3 skipped, 0 fail |
| frontend `vitest run` | 641 files, 7,446 tests, all pass |
| catalogue `build.mjs --check` | ok |
| coach assets `--check` | ok |
| media check | ok |
| frontend build | ok |

Every later ticket is measured against these numbers.

## Proposed first PR (T-014)

**Programme weeks that change sets and RIR.** The smallest change that lets a programme hold
what the library describes, with no new screen:

- `lib/programmes.js`: week targets accept `sets` (1 to 10) and `rir` (0 to 5) per slot; `cleanWeek`
  keeps them; plan files carry them (`bundleProgramme` / `importedProgramme`).
- `lib/session-start.js`: a running programme's `sets` for this week replaces the slot's set count;
  `rir` is shown as the target (as RPE is today, converted by the profile's effort scale).
- `views/Programmes.jsx` / `ProgrammeEdit`: the week editor gets a sets stepper and RIR beside the
  %1RM / RPE it already has.
- Tests: normalisation, a 4-week block with week 1 = 1 set and week 4 deload, a session built from
  each week, an old programme without the fields unchanged, a plan file round trip.

Next after that, in order: interval cardio (P0.1, P0.2's hold range), then the importer for the
library as **draft only**, then the Browse screen, then the questionnaire.
