# Easing back in after a break, and "how did that feel?"

Status: design, waiting for Emil's approval. Source: research D
(docs/emails-gym-planning/research/D-adaptive-training-system.md, "Missed session decision tree" and
the double-progression rules) and a conversation with Emil on 2026-11-11.

## Why

Emil, in his own words: after a week away he feels a lot weaker, so he can't go straight back to the
same weights or reps, and he gets much sorer afterwards, so the first session back can't be all out.
At the moment the app ignores time away completely. After two weeks off, `nextPrescription`
(frontend/src/lib/progression.js) offers the old weight, or even the next increase, as if you
trained yesterday.

He also wants a quick way to tell the app how a session went ("I felt strong, so I pushed more";
"I got 2 fewer reps on the last set"). He would skip a reps-left entry on every set most days.

The two parts ship together but are independent. A builder may land them as two commits.

## Goals

1. **The app notices the break and eases you back in by itself.** The first session back after a
   break is lighter with no action from you. A short note says why, and one tap restores your usual
   plan.
2. **It's a short ramp, not a reset.** After one to three easier sessions (more for longer breaks)
   you're back at your pre-break numbers, and normal progression continues from there.
3. **For short breaks, cut volume before load.** One set fewer helps with soreness and keeps the
   weight familiar. Weight drops only for longer breaks.
4. **One optional tap per exercise: Easy · Good · Hard.** It adjusts the next step. Skipping it
   always gives exactly today's behaviour.
5. **Every adjusted number says why** on the existing progression line of the workout card.

## Non-goals

- No pain, form or safety flags (research D step 1). That's a separate feature.
- No fatigue review across several exercises (research D step 7).
- No cardio or interval easing. The structured interval logger comes later.
- Wearable data (sleep, resting HR) never changes a prescription. Research D is explicit on this.
- No "repeat a week" choice for programmes after a long break (research D suggests it). The ease-in
  applies on top of the running programme's week instead.
- No new per-set RIR UI. The existing optional effort column stays as it is.

## Anti-goals (a failure even if it works)

- Easing someone who didn't take a break. Someone on a weekly split trains each lift every 7 days
  and must never see "Back after 7 days".
- A break costing weeks of progress. A one-week holiday must not restart a cycle.
- The feel tap becoming a chore or a nag. It's never required, never blocks finishing, and isn't
  asked again once answered.
- Tapping Hard every time freezing progression for good.
- Rewriting logged sets. History is never changed (research D's contract).

## Part 1: Easing back in

### What counts as a break (per exercise)

The gap for an exercise is the number of calendar days between today and the last session in
which it was done (whole history, any routine, using the sessions `sessionsFor` would count: not
excluded, with at least one done work set).

It counts as a break when **both** hold:

- the gap is at least **8 days**, and
- the gap is at least **1.5 × this exercise's usual gap**, where the usual gap is the median of the
  gaps between its last 5 sessions (up to 4 gaps). With fewer than 2 earlier gaps, the usual gap is
  7 days.

So a lift trained weekly isn't eased at 7 to 10 days, but is at 11 or more. A lift trained twice a
week is eased from day 8. A week's holiday from a weekly split gives a gap of about 14, which is
eased.

The first ever session of an exercise is never eased (there is nothing to ease from).

### How much easier

| Gap | Tier | First session back | Ramp after it |
|---|---|---|---|
| 8 to 14 days | short | Weight held at the pre-break weight, **one working set fewer**, no progression step (rep aim held, no raise) | Next session: the normal prescription from the pre-break session, raise included |
| 15 to 28 days | medium | One set fewer **and** weight × 0.90 | Next session: pre-break weight and full sets, held (no raise), then normal |
| over 28 days | long | One set fewer and weight × 0.80 | Then × 0.90 with full sets, then pre-break held, then normal |

"Pre-break" always means **what was logged** in the last session before the break (its weight,
work-set count, rep aim, seconds or `rowReps`), not what the app would prescribe from it. Emil's
point is that the numbers you last lifted are too much right after a break. Every rung is
calculated from those.

Details:

- The weight rounds **down** to the exercise's own grid (`snapWeight` / increment), or to the
  nearest owned dumbbell or stack plate at or below it (`ownedDeload`-style). Warm-ups re-ramp from
  the new weight as they already do (`applyPrescription` → `rerampWarmups`).
- An exercise planned with 1 working set keeps 1. In the short tier it then holds the weight and
  reps (no step). In longer tiers, only the weight drops.
- **Assistance machines**: "lighter" means more help. Add one increment of help per tier step
  instead of the weight factor (short: same help; medium: +1 increment; long: +2).
- **Bodyweight work** (no load, `climbsReps`): one set fewer; rep goal held (short); rep goal ×
  0.9 / × 0.8 rounded down, at least 1 (medium / long).
- **Timed holds**: one set fewer; seconds held (short); × 0.9 / × 0.8 rounded down to 5 s, at
  least 5 s (medium / long).
- **Cardio entries**: not eased.
- **Triple progression**: one set fewer means dropping the last row of `rowReps`. The ramp returns
  to the pre-break rows.
- **Programmes** (`programmePlan`): a break does not pause or rewind a programme. The calendar
  week stays as `programmeStatus` computes it. The ease-in applies to **that week's**
  prescription (its %1RM weight and its sets), and on later rungs "pre-break numbers" means the
  current week's prescription, not the stored `from`. A programme **deload week is never eased
  further**, and a programme past its end is handled as it is today.
- **A deload that is due** (`stalls >= deloadAt`) when you come back: in the short tier the deload
  wins and isn't eased further. In the medium and long tiers you get the lighter of the deload
  weight and the eased weight, with one set fewer. (Claude's call.)
- **Back-off sets, intensifiers, drop sets**: they are applied after the prescription as now, so
  they follow the eased top weight automatically.

### Ramp state and how history reads it

Every session built as a lighter rung (fewer sets or a lower weight) is stamped:
`entry.back = { days, tier, step, from: { weight, sets, reps?, sec?, rowReps? } }`, where `from`
is what the pre-break session logged and `step` is the rung (1 = first back). The stamp is saved
with the workout (it syncs like any entry field: workouts merge whole by `_ts`, see
lib/sync-merge.js).

**Per routine line, detected across all.** The gap is measured over all of the exercise's
sessions (it's about your body). The ramp follows the same line `sessionsFor` uses: a heavy day
and a light day (#216) each ease from their own pre-break session, and each has its own ramp.
If the lift has been done in another routine since the break, the gap is short and that line
isn't eased.

**Building the next session:**

- If this line's last session carries `back`, the next session is the next rung, built from
  `back.from` (table above).
- If an eased session **missed** its reps, the same rung repeats once. A second miss at the same
  rung ends the ramp: that session is stamped `back.ended = true` and becomes an ordinary
  session from then on. It is `last` and a miss, and normal rules continue from it. It's at a
  lower weight, so `stallCount` starts a fresh count there, as it does after any weight change.
- The rung at pre-break numbers (medium and long tiers) and the "normal" session after the last
  rung carry **no** `back` stamp. They are ordinary sessions and count for everything.
- Sessions with `back` (not `ended`) are invisible to the progression rules: `stallCount` and
  the choice of `last` skip them, and they never raise the weight. So after the ramp, the
  prescription reads the pre-break session and its stall count as if the break hadn't happened.
  Example: before the break you missed twice at 100 kg. Medium tier: 90 kg × one set fewer
  (eased), then 100 kg full sets (an ordinary session). A hit there resets the count as normal;
  a miss is the third and the usual deload follows.
- A new break in the middle of a ramp starts a new ramp from the same `from`, not from a lower rung.
- PRs, 1RM estimates, volume, recovery and history treat eased sessions as normal logged work.

### What you see

- The progression line on the exercise card (views/Workout.jsx, the `progline` button) uses a new
  `kind: 'return'` with the down-arrow icon and a reason, for example:
  - "Back after 10 days: one set fewer today."
  - "Back after 3 weeks: one set fewer and {0} {1} today."
  - "Easing back in: full sets at {0} {1}, then your usual weights."
- **Once per workout**, at the top of the session when at least one exercise is eased, a short note:
  "Back after {0} days, so today is a little lighter." with a button **Use my usual plan**. Tapping
  it rebuilds every eased entry's **unlogged** rows as if there were no break (logged rows are
  kept, as `applyPrescription` already guarantees) and drops their `back` stamp. The note then
  reads "Using your usual plan." with **Ease in instead**, which puts the ease-in back. The choice
  belongs to that workout only.
- The days count in the note is the **largest** gap among eased exercises.

### Plain wording rules

No em dashes, plain and human, through `t()` with `{0}` placeholders (CLAUDE.md).

## Part 2: How did that feel?

### Capture

- When the **last planned working set** of an exercise is ticked (Focus view and the list view),
  a small row appears under it: **How did that feel?** with **Easy · Good · Hard**. It is a
  segmented pill like the existing ones (Phase 2 shared components), 44 px tall.
- One tap stores `entry.feel = 'easy' | 'good' | 'hard'` and the row collapses to a small chip
  ("Felt easy") that can be tapped to change or clear it until the workout is finished.
- Ignoring it is fine. It never blocks moving on, finishing, or the rest timer, and it's never
  asked again for that entry.
- Not shown for cardio entries, warm-ups or exercises with progression off.

### Effort the app already has

If `entry.feel` is not set but the work sets carry logged effort (`rirOf` in lib/effort.js, RIR or
RPE), the feel is read from the **last work set's** RIR: 3 or more = easy, 1 to 2 = good, 0 = hard.
An explicit tap always wins.

### How the feel changes the next prescription

Feel acts only on a session that **met its own aim** (`last.ok` as `readSession` grades it). A
miss follows today's rules whatever the feel, so a miss tapped Easy is still a miss. The rules,
in order:

- **None or Good**: exactly today's behaviour.
- **Hard**: the next session repeats this one: same weight, same rep aim (double progression:
  no +1 while climbing, no raise at the top), same rows (triple). This hold doesn't count
  towards the deload streak. **Limit:** if the previous session on this line was already a Hard
  hold at the same weight and plan, the step happens normally. So Hard can delay a step by one
  session at most.
- **Easy, when the step is a weight raise** (linear and Greyskull on a hit; double and triple at
  the top of the range): if this line's **previous session was also an Easy session that earned
  a weight raise** (whatever its weight), the raise is a **double step** (2 × increment). That
  needs 2 × increment to be at most 5 % of the current weight (upper body) or 7 % (lower body);
  otherwise it's the normal step. In other words, two raises in a row that both felt easy earn a
  bigger third one.
- **Easy, when the step is rep climbing** (double and triple below the top): no effect. The reps
  climb as they do today.

Other details:

- Greyskull's own AMRAP double jump keeps priority. Easy doesn't stack on top of it.
- Owned dumbbells or a stack: a double step is two bells up (`ownedUp(..., 2)`), under the same %
  cap measured on the real jump.
- Lower body for the cap: the catalogue's `bodyPart` is "upper legs" or "lower legs", or the
  primary `target` is glutes, quads, hamstrings, adductors, abductors or calves. Everything else,
  including "full body" and custom exercises with no muscle data, uses the 5 % cap. Deadlift
  variants filed under a back or full-body part therefore get 5 %. (Claude's call: the cautious
  side.)
- Eased (`back`) sessions don't read feel. The ramp decides their next step.
- Reasons on the progression line, for example: "Easy twice in a row: {0} {1} more.", "Felt hard
  last time: same weight once more." A Hard hold does **not** count towards the deload streak.
- Research D's "RIR not entered → suggest but don't autoload" is deliberately **not** adopted. No
  tap means today's autoloading behaviour, as Emil asked.

## Inputs, including biological sex

The break rule takes the person (`bodyOf(S)`: sex, birth year) as an input next to the history, as
CLAUDE.md asks for recommendation logic. Research D gives no different thresholds by sex or age, so
in v1 the values are the same for everyone. The input exists so that tuning later doesn't need a
new interface. This is Claude's call, flagged for Emil.

## Where the code goes

- `frontend/src/lib/return-break.js` (new, pure, with `return-break.test.js` beside it): gap and
  usual gap, tier, ramp rung, and the function that eases a prescription
  (`easeForReturn(S, cfg, routine, plan, { today, person }) → plan with kind 'return' and a back
  stamp`, or the plan unchanged).
- `frontend/src/lib/progression.js`: feel-aware branches in `nextPrescription`, `stallCount`
  ignoring `back` sessions, baseline selection skipping eased sessions once a ramp is done, and a
  `feelOf(entry)` helper (or in lib/effort.js beside `rirOf`). Tests in `progression.test.js`.
- `frontend/src/lib/session-start.js` `planEntry`: call `easeForReturn` after the programme step
  and before `applyPrescription`; stamp `back` on the returned entry. `applyPrescription` today only
  **grows** set lists; dropping a working set needs a careful shrink that never removes a logged row
  or a warm-up.
- `views/Workout.jsx` / `views/FocusView.jsx`: the feel row, the return note with its toggle, and
  the new `kind: 'return'` on the progression line.
- The Apple Watch app builds its own workout views from the phone's session. Eased rows arrive as
  ordinary rows. The watch shows no feel row in v1.

## Tests the builder must include

Break detection: weekly lift at 7, 10, 11 and 14 days; twice-a-week lift at 7 and 8 days; first
session ever; sparse history (one earlier session). Tiers at 8, 14, 15, 28 and 29 days. Rounding on
grid, owned dumbbells, assistance machine, bodyweight, timed hold, 1-set plan, triple rows,
programme %1RM, programme deload week (not eased). Ramp: short finishes in one session; long goes
0.8 → 0.9 → pre-break → normal; a miss repeats a rung once, then leaves the ramp; a new break mid
ramp; eased sessions don't stall or deload. "Use my usual plan" keeps logged rows. Feel: none = old
outputs exactly (a fixed set of existing scenarios compared before and after); Easy twice under and
over the % cap; Hard holds once, then steps; a miss with Easy is still a miss; RIR fallback; a tap
overrides RIR; Greyskull double jump not stacked.

## Calls Claude made (for Emil to check)

1. Break = at least 8 days **and** at least 1.5 × your usual gap for that lift. This protects
   weekly splits.
2. Tier boundaries 14 and 28 days, and the factors 0.90 and 0.80.
3. The "Use my usual plan" switch is for the whole workout, not per exercise.
4. Two weight raises in a row that both felt Easy earn a double step on the next one, capped at
   5 % (upper body) or 7 % (lower body). Easy has no effect while reps are climbing.
5. Hard repeats the session once (no step of any kind), and only once in a row.
6. Logged RIR stands in for the tap when there isn't one.
7. Sex and age are inputs, with the same values for everyone in v1.
8. No feel row on the watch, and no feel editing from History, in v1.
9. The ease-in is calculated from what you last lifted, not from what the app would have
   prescribed next. A deload that's due wins in the short tier; in longer tiers you get the
   lighter of the two.
10. After a medium or long break, the first full session at your old numbers holds the weight
    (no raise). After a short break, the normal step comes straight back.
11. A break doesn't pause a programme. The ease-in applies to whatever week the calendar has
    reached.
12. A heavy day and a light day of the same lift each ease from their own numbers.
