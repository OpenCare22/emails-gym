# Deliverable E — Claude Code Implementation Specification

**Application:** Email's Gym, private iPhone-first PWA. **Repo status:** Not yet inspected. All new modules below are **proposals**; they are not claims about current implementation. Existing logging, cardio, history, charts, Fitbit and social features must remain functional.

## Required behavior

Program catalogue filtered by training goal, experience, days, minutes and available equipment; versioned program detail; choose and enroll; next-session queue independent of strict calendar; display per-exercise prescribed sets versus prior and actual; log reps/load/RIR; swap an exercise while maintaining intent; suggest explained progressions; reschedule/skip/pause; history and completion report. No aggressive automatic adaptive changes or compulsory elaborate onboarding.

## Repository inspection instruction (Claude Code must do this first)

1. Locate package manager, framework, routes/navigation, current workout logger, exercise catalogue, schema/migrations, authentication/user model, background sync, PWA and offline/cache patterns.
2. Inspect current workout/cardio history data models and any weight units, imported wearable scopes and social sharing visibility.
3. Identify all regression-critical flows and existing test coverage. Add compatibility mapping; **do not duplicate exercise IDs or replace existing logger**.
4. Produce a change plan and file-level migration map. Ask for confirmation only when a destructive migration or data-loss risk is detected.
5. Start with the smallest nonbreaking vertical slice, feature-gated where possible.

## Data entities and ownership

`Exercise` (stable ID, name, movement, primary/secondary muscle, equipment, swap candidates); `Program` (stable ID and metadata); `ProgramVersion` (immutable content hash, evidence metadata, publish status); `ProgramWeek` (sequence and modifiers); `WorkoutTemplate` (grouped prescriptions); `ExercisePrescription` (exercise intent, sets, reps, RIR, rest, notes); `Enrollment` (user, pinned version, lifecycle); `EnrollmentSession` (scheduled/started/completed/skipped timestamps); `EnrollmentSubstitution` (scope and reason); `CompletedWorkout` and `CompletedSet` (actual logged weights/reps/RIR/form flags); `ProgressionRecommendation` (rule+inputs+reason+acceptance); `UserPreferences` (goal, days, equipment, availability, exclusions); `CompletionRecord` (outcomes and next recommendation). Program template data are read-only after publishing; user modifications belong to enrollments. Keep existing workout history authoritative, with references to program instance/template where possible.

## Canonical JSON

`program-library.json` contains complete source data, including `exercises`, `programs[].templates`, `programs[].week_plan`, and `programs[].expanded_weeks`. This is the **real deliverable**, not an illustrated stub. `program-index.json` is light discovery metadata. Validate in CI with JSON Schema/Zod/TypeScript types adapted to the actual repo. Both must be imported with version pins and migration-safe IDs.

### Example TypeScript interfaces

```ts
type ExercisePrescription = { exercise_id:string; sets:number; reps:[number,number]; target_rir:number; rest_seconds:number; alternatives:string[]; notes:string };
type CardioPrescription = { modality:string; minutes:number; intensity:string; notes:string };
type WorkoutTemplate = { id:string; name:string; suggested_day:number; warm_up:string; exercises:ExercisePrescription[]; cardio:CardioPrescription[] };
type ProgramVersion = { id:string; version:string; title:string; goal:string; level:string; days_per_week:number; block_weeks:number; session_minutes:number; templates:WorkoutTemplate[]; week_plan:unknown[]; expanded_weeks:unknown[] };
type Enrollment = { id:string; userId:string; programId:string; programVersion:string; status:'active'|'paused'|'completed'|'cancelled'; nextTemplateId:string|null; startedAt:string; sessionOverrides:Record<string,unknown> };
type CompletedSet = { id:string; workoutId:string; exerciseId:string; prescribedSetIndex:number; loadKg:number|null; reps:number|null; rir:number|null; formOk:boolean|null; recordedAt:string };
type Recommendation = { id:string; enrollmentId:string; ruleId:string; ruleVersion:string; sourceSetIds:string[]; decision:string; rationale:string[]; proposedValue:unknown; acceptedAt:string|null };
```

## Program matching: deterministic and explainable

Hard filters: clinical flags needing referral; excluded movement without safe replacement; unavailable essential equipment; weekly days > maximum; workout duration exceeds max by >10 min unless user opted in. Score eligible matches by goal (+40), desired days exact (+25), within session duration (+15), experience appropriate (+15), cardio preference (+5). Scores are product choices. Show top three with "Why this fits" and explicit exclusions. Allow manual browsing even if none match; don't invent an advanced variant by rearranging workouts.

## UX screens and interactions

1. **Programs:** compact filters, 7 clearly labeled cards with days/time/goal/experience.
2. **Program detail:** schedule and exact workout previews, weeks, equipment, recovery, evidence disclaimer; one primary 'Start program'.
3. **My week:** next queued session, optional schedule, completed vs planned counts; move, skip, pause actions.
4. **Workout:** one exercise at a time, set row with target vs actual, large number inputs, previous logged set, rest timer, optional RIR, easy alternative selector.
5. **Post-workout:** brief summary, only explainable progression suggestions with accept/dismiss.
6. **Progress:** adherence, per-exercise performance and optional estimated strength trends; do not force arbitrary gamification.
7. **Settings:** days, time, equipment and excluded exercises; user control over progression suggestions and data.

## Algorithms

Use Deliverable D literally as the **reference behavior** for transparent progression, fatigue review, missed-session handling and cardio. Keep exercise-specific available weight increments configurable, units explicit, RIR optional and permissioned telemetry secondary. Preserve logs if a recommendation is rejected.

## Data validation and QA

- All referenced exercise IDs must exist; alternatives cannot point to absent exercises.
- No week has more scheduled sessions than configured; expanded_weeks has `block_weeks` length; template IDs stable.
- All set counts >0, rep max >= min, RIR between 0–5, seconds positive; cardio duration positive; all sessions have at least one activity.
- Consistency audits for primary movement patterns and weekly set totals. Human review of duration estimates and high-fatigue clustering.
- Snapshot immutable published versions; changing a template creates new semver version and changelog; active enrollees pinned.
- Role-based exercise/note editing; no untrusted HTML; avoid disclosing private health or wearable data on friend leaderboards.
- Offline-first logging: draft persistence, sync reconciliation and no duplicate set submissions on reconnect.

## Tests and acceptance criteria

**Unit:** JSON schema, full eight-week data, scorer filter, progression boundaries, time and unit normalization, alternative filtering, 1RM trend suppression, weekly set counting. **Integration:** enroll, workout start/log, reschedule, substitute, restart after missed week, pause and complete. **Migration:** preexisting logs and all existing dashboards unchanged. **End-to-end (iPhone viewport):** browse → select → start → log 3 sets → view next session → view recommendation; offline logging and reconnect; app restart midworkout. **Accessibility:** high-contrast legibility, 44px-ish touch targets where appropriate, keyboard labels, reduced motion, voiceover ordering. **Performance:** lazy-load program data; current workout should not require the whole literature report to render.

## Suggested rollout

**Phase 0:** repo audit and compatibility map. **Phase 1:** exercise mapping + read-only library/schema validation. **Phase 2:** enrolment and session queue. **Phase 3:** integrate current logger and program context. **Phase 4:** progression engine and explanations. **Phase 5:** substitutions/scheduling/offline regression tests. **Phase 6:** optional Fitbit context, coach-reviewed pilot, science review/versioning.

## Explicit constraints for Claude Code

Do not claim verified capabilities from this document. Do not publish medical advice. Do not copy Jeff Nippard paid routines. Do not remove existing social/cardio/weight logging. Prefer additive migrations. Use `program-library.json` as input, not as an instruction to invent missing workouts. Supply a file-by-file change summary, exact tests run, test failures, and a list of assumptions requiring user signoff.
