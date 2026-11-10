# Email's Gym — Research, program and data audit

**Date:** 2026-11-10  
**Status:** Revision required before app integration.  
**Scope:** Uploaded files `deep-research-report_training.md`, deliverables A–E, and `program-library(1).json`. This is a static science/data/software audit, **not** a substitute for a qualified coach's individualized review or an end-to-end test against the app repository.

## Executive judgment

The scientific direction is credible and the seven-program JSON library is structurally coherent, but the package is **not release-ready**. Its main failings are contradictory interval prescriptions, the inability to distinguish timed holds from counted reps, exercise substitutions not attached to actual session prescriptions, insufficiently specified adaptive progression for special exercise types, and a data contract that is too loose for an autonomous coding agent.

## What passed

- JSON parsed successfully; top-level includes `schema_version`, `programs`, `exercises`, and `sources`.
- 7 program IDs are unique: `foundation-2`, `foundation-3`, `build-4`, `strength-4`, `hybrid-4`, `efficient-3`, `conditioning-3`.
- 40 unique exercise records; all referenced program exercise IDs and global alternative IDs resolve to catalog entries.
- All 7 programs contain 8 `week_plan` entries and 8 `expanded_weeks`; session count per week matches `days_per_week`.
- Expanded strength work-set counts and target RIR values match each source template plus weekly modifiers; the sampled/automated comparisons found no divergences.
- Main ACSM 2026 position stand and Pelland 2026 resistance-dose-response publication are real and match the high-level summary; see research verification below.

## P0 — Must fix before importing/using workout prescriptions

### P0.1 Cardio interval instructions contradict scheduled duration

- `hybrid-4`, `h4-c2`, week 8: `minutes: 22`, but notes still require **8 min warm-up + 5 × (1 min hard + 2 min easy) + 4 min cool-down = 27 min**. The full prescribed workout cannot fit in the allotted 22 min.
- `conditioning-3`, `c3-intervals`: notes require **8 min warm-up + 4 × (2 min hard + 3 min easy) + cool-down**, i.e. at least **28 min before any cool-down**. Yet scheduled duration is **18 min in week 1**, **20 min in week 2**, and remains below 28 minutes through week 5. Week 6 reports 28 minutes, which leaves no cool-down. Week 8 returns to 21 minutes with unchanged instructions.
- Fix: replace single free-text interval descriptions with structured segments (warm-up, repeat count, hard seconds/intensity, recovery seconds/intensity, cool-down); generate total from segment durations; design feasible week-specific interval changes and validate `sum(segments) == planned_duration`.

### P0.2 Rep prescriptions conflate seconds and repetitions

- `plank` is represented with ranges such as `[20,40]` and `[30,60]` in the same `reps` field used for presses and squats. Those values are clearly intended as time intervals, but no `seconds`, `duration`, or `prescription_type` field exists.
- `dead_bug`, other repetitions, and unilateral sets likewise lack a `per_side` marker at the prescription level.
- Fix: introduce explicit measurement types (`reps`, `seconds`, `distance`, `duration`, `per_side_reps`); enforce set-specific input types; exclude duration-based holds from load/repetition progression unless a distinct policy exists.

### P0.3 Substitution handling is underspecified

- All **89** resistance-exercise prescriptions across program templates have `alternatives: []`, despite `exercises[].suggested_alternatives` being populated for many exercises, and the human-readable library listing alternatives.
- Fix: decide whether workout substitutions are dynamically derived from verified catalog matches or explicitly approved per prescription. Do not assume global alternatives are equivalent for every program, especially strength-skill programs. Include constraints on movement pattern, equipment, level, load format and target tissues; prevent automatic carryover of previous exercise loads.

### P0.4 Implementation contract doesn't cover exercise-specific input requirements

- JSON `ExercisePrescription` only has `reps:[min,max]`, RIR and rest. A real workout logger needs timed holds, per-side accounting, bodyweight-only sets, load units and how the equipment increments work.
- Fix: finalize a discriminated prescription schema before migrations/import. Add validation for reps-vs-seconds, load unit, unilateral accounting, cardio blocks, exercise modality and records with null load. Map imported IDs to the existing exercise catalog without duplicating historical exercises.

## P1 — Important revisions before pilot

### P1.1 Session time should be per-session, not a misleading program-wide figure

- `hybrid-4` lists `session_minutes:65`, but its aerobic sessions last 35 min and interval sessions 27 min. `conditioning-3` lists 45 min although its interval prescriptions range 18–31 min and long easy runs reach 50 min.
- Fix: store estimated duration per template and expanded session, including a realistic warm-up/cool-down allowance. Show a duration range in program discovery where appropriate.

### P1.2 Progression is thoughtfully conservative but lacks explicit dispatch rules

- The double-progression rule requires every set at upper rep target, reported RIR and good form. Missing RIR is discussed as low confidence, but does not have a fully unambiguous decision rule; `formOk:null` and bodyweight exercises also need clear handling.
- Fix: create typed decision outputs for insufficient data, hold, suggest increase, review fatigue and safety stop. Define strength, hypertrophy, isometric, unilateral, bodyweight and cardio policies separately. Recommendation-only: never silently edit completed workouts.

### P1.3 Cardio progression framework conflicts with static weeks

- Deliverable D proposes increasing aerobic duration only after two tolerated sessions. However `conditioning-3` advances duration each calendar week via fixed multipliers, without using achieved RPE, symptom flags, or adherence.
- Fix: distinguish **planned week target** from **actual progression eligibility**. The app may show a progression target but should allow repeat/hold/reduce based on completed sessions and user feedback. Make planned durations internally feasible.

### P1.4 Program catalog has limited meaningful personalisation

- The library has only one `build-4` and one `strength-4` (both intermediate), no distinct 3-day hypertrophy plan, no home/equipment-limited plan, and no strong beginner-to-intermediate transition beyond the two Foundation schedules.
- Fix: keep 7 as a pilot, but do not advertise comprehensive coverage. Apply strict eligibility filtering. Add 3-day muscle-building and limited-equipment options when demand warrants.

### P1.5 Training volume checks need purpose-specific interpretation

- Direct primary-muscle counts from catalog labels show, e.g., `hybrid-4` with 2 weekly lifting sessions and only ~3 direct chest sets, vs `build-4` with higher resistance workload. This is not automatically wrong (hybrid trades off volume for cardio), but should be explicitly described, and coverage audited including compound indirect work.
- Fix: coach review each program for intended adaptations and realistic recovery; avoid presenting all options as equal for hypertrophy.

### P1.6 Set-duration and workout-duration verification

- `build-4` upper sessions have 18–19 work sets and roughly 35–36 minutes of nominal interset rest if every set is counted. Add actual lifting, warm-up and equipment changeover and 65 minutes can be tight. The simple sum overcounts the rest after final sets, so this is a **review flag**, not a proven impossibility.
- Fix: test durations with realistic transition assumptions; reduce or mark optional low-priority accessories where necessary.

### P1.7 Evidence provenance is much thinner than the original research brief requested

- JSON `sources` contains only four URLs. The reconstructed research review explicitly says it is **not** a reproducible systematic review. Jeff Nippard's public coaching discussions are useful context, not a validation of the unique program prescriptions.
- Fix: maintain per-claim/per-policy source records (`source_id`, DOI, dated access, evidence tier, what is/ isn't supported), and separate research claims from engineering policies. Do not claim the 7 produced programs were experimentally validated.

## P2 — Useful polish after correcting blockers

- Add user-facing explanation of RIR and allow beginners to leave it blank rather than forcing invented confidence.
- Distinguish completed strength workouts from Fitbit metrics in friend leaderboard scoring; don't reward raw lifted volume across different people/programs.
- Add reliable rescheduling, offline drafts, idempotent submission and program-version pinning; the spec identifies these but cannot establish that the fork implements them.
- Create program-specific coaching cues and concise first-week guidance, with user-controlled exercise alternatives and no auto-prescribed rehabilitation.
- Define independent testing for free-weight increment precision, metric/imperial conversion, pause/resume, previous-performance matching and privacy.

## Scientific verification (spot check)

- Currier et al., 2026, ACSM position stand, DOI `10.1249/MSS.0000000000003897` is real: synthesis of **137 systematic reviews and >30,000 participants**. Its conclusions support flexible resistance training, stronger emphasis on heavy loads for voluntary strength and higher volumes for hypertrophy. It does *not* validate any particular Email's Gym program verbatim.
- Pelland et al., 2026 print/2025 online, DOI `10.1007/s40279-025-02344-w` is real, and supports the direction of diminishing returns from added set volume.
- Other source claims are not exhaustively fact-checked here. The package's own methodology says its exercise ranges, loading increments, plateau thresholds and return-from-break thresholds are pragmatic software/coaching choices, not universally validated cutoffs.

## Recommended order of work

1. Correct the broken interval duration plans and create a segment-based cardio schema.
2. Make exercise prescriptions explicitly typed (reps/seconds/per-side, bodyweight, loads, equipment increments).
3. Fix substitution resolution and validate every approved alternative in context.
4. Make progression algorithms typed and consistent with each week's actual achieved workload.
5. Run automated validators for exercise IDs, week expansion, cardio arithmetic, durations and constraints.
6. Ask a qualified S&C coach to review each pilot program's real-world exercise order, intensity, volume, time and recovery.
7. Only then give Claude Code the schema and versioned programs; require repository inspection and non-destructive implementation.

## Release gate

**Current:** research-based prototype / NO-GO for blind production import.  
**After P0 fixed + validation + coach pilot:** candidate for private friends-and-family testing, with conservative user controls and clear limitations.  
**Before broad public release:** content review, quality assurance and privacy/safety assessment.
