# Deliverable D — Deterministic Adaptive Training System

**Contract:** Recommendation engine emits proposed actions; it does not silently rewrite completed workout history or change a program without user approval.

## Inputs and quality checks

Inputs: program version, enrollment substitutions, weekly plan, exercise/load increments and unit, actual sets/reps/weight, target RIR, reported RIR, form flag, pain/symptom flag, previous comparable exposures, session status, optional perceived recovery and wearable context. Only compare the **same exercise and its chosen variation**, same rep range, comparable sets and approximate technique. If RIR not entered, default to `confidence='low'`, suggest but don't autoload.

## Algorithm: double progression (implementation policy)

1. If pain, alarming symptoms or form safety flag -> `PAUSE_AND_REVIEW`, no progression.
2. If session missing required set data -> `INSUFFICIENT_DATA`; avoid inferred recommendations.
3. If every work set reaches the upper rep boundary, reported RIR is **at least** prescribed RIR (within user-set acceptable band), and technique good -> `SUGGEST_INCREASE` by the smallest equipment increment, capped at a configurable relative increase (example defaults: 5% for upper, 7% lower). If increment exceeds cap, hold and suggest alternate loading equipment or more reps.
4. If all work sets inside rep range and no unsafe effort -> `HOLD_AND_ADD_REPS`.
5. If any set below floor by 2+ reps, RIR <=0 against a >=2 RIR target, or reported form degraded -> `HOLD_OR_SMALL_REDUCTION`. With one isolated bad session default to **hold** and note context.
6. If performance below lower bound on **two consecutive comparable exposures** -> suggest -2.5% to -5% load (or nearest plate) or 1 fewer set, chosen by user; do not change both by default.
7. If declining patterns occur across >=2 distinct exercises over >=2 exposures and user reports high fatigue -> suggest a lower-stress session or reduce sets 20–30% for 1 week. No claim this precisely diagnoses accumulated fatigue.

All caps, percentages and 'two exposures' are **transparent versioned software policy**, not validated physiology thresholds. Log the rule ID and facts in the explanation.

## Strength progression

Keep training submaximally, 2–3 RIR for primary lifts. Once the range ceiling is hit with technique good in two exposures, propose smallest feasible load increase; if repeated low reps, reduce modestly. e1RM (Epley `load × (1 + reps/30)`) is *optional trend telemetry* for consistent low-rep exercise, never an absolute prediction, never a required 1RM test and never comparable across different exercises. Suppress high-rep e1RM estimates.

## Cardio progression

After two tolerated repeat sessions with RPE and symptoms suitable, increase **continuous** duration by the lesser of 5 minutes or 10%; intervals add one repetition or slightly longer hard total duration **not both**, capped to published session intent. If tired, unable to speak at easy-talk pace, or reporting symptoms, hold/reduce and suggest review. Talk-test and perceived exertion take priority over heart-rate predictions.

## Missed session decision tree

- Missed one scheduled date: move same workout forward; don't double up automatically.
- Fewer than 7 days between same movement exposures: resume next programmed session normally if feeling ready.
- 7–14 days gap: default one fewer set and +1 RIR on first return exposure.
- Over 14 days: offer conservative re-entry mini-block and a user choice to repeat a week; no forced jump forward.
- Manual reordering: keep original session IDs and completion semantics, avoid two demanding same-pattern sessions consecutively when feasible.

## Wearables

Fitbit resting HR, steps, sleep and heart-rate trends can appear as contextual indicators with device source, time window and missing-data flag. An anomalous overnight value **never** on its own reduces a workout or changes prescribed weight. Optional nonbinding prompt: 'Your activity or sleep trend differs from usual. Check how you feel before today's session.' Data access/permissions must be verified in the repository; no assumption that all Fitbit fields exist.

## Transparent function pseudocode

```ts
type Decision = 'PAUSE_AND_REVIEW'|'INSUFFICIENT_DATA'|'SUGGEST_INCREASE'|'HOLD_AND_ADD_REPS'|'HOLD_OR_SMALL_REDUCTION'|'REVIEW_FATIGUE';
function recommend(prescribed, actual, history, equipment, policy): Recommendation {
  if (actual.painFlag || actual.safetyFlag) return explain('PAUSE_AND_REVIEW', ['safety_flag']);
  if (!completeComparableSets(actual, prescribed)) return explain('INSUFFICIENT_DATA', ['missing_sets']);
  const allTop = actual.sets.every(s => s.reps >= prescribed.repMax && s.rir !== null && s.rir >= prescribed.targetRir && s.formOk);
  if (allTop) {
    const increment = equipment.smallestIncrement;
    if (increment / actual.load <= policy.maxRelativeJump) return explain('SUGGEST_INCREASE', ['all_sets_at_top','effort_met'], actual.load + increment);
    return explain('HOLD_AND_ADD_REPS', ['increment_too_large']);
  }
  if (twoComparableMisses(history, actual, prescribed)) return explain('HOLD_OR_SMALL_REDUCTION', ['repeated_underperformance']);
  return explain('HOLD_AND_ADD_REPS', ['range_not_yet_complete']);
}
```

## Worked examples

- **3×8–12 at RIR 2, 30 kg:** 12/12/12 at RIR 2/2/2, stable form; smallest increment +2 kg and maxJump 5% means +6.7% exceeds cap => hold 30 kg; offer smaller plates/dumbbells rather than forcing 32 kg.
- **Same exercise with 1 kg increment:** +3.3% fits 5% cap => suggest 31 kg for next exposure; log 'all sets top, effort met'.
- **After increase, 9/8/7 at RIR 1:** one poor exposure => hold, no downshift. Second comparable underperformance => suggest load reduction or review, not automatic change.
- **Two lifts decline for two sessions plus high reported fatigue:** flag stress review and optional one-week 20–30% lower set volume. No diagnostic label.
- **Cardio easy 30 min completed twice at talk pace:** next proposed 33 min (10% rather than 5 min); after symptoms or unusual exertion, no auto increase.

## API/event contract and tests

Recommendation fields: `rule_id`, `rule_version`, `decision`, `suggested_load`, `suggested_sets`, `confidence`, `reason_codes`, `human_explanation`, `source_workout_ids`, `created_at`, `accepted_at|null`. Record acceptance separately from recommendation; never mutate previously logged sets. Unit tests: missing RIR, big equipment jump, unilateral exercise each side, RIR zero vs target 2, exercise swapped, missed workouts, sparse data, conflicting wearable signals, repeatability.
