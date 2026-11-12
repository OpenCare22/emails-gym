# Simple mode: just log what you did

2026-11-12. Agreed with Emil in a brainstorm, with mockups.

## Why

A colleague (45, trains by feel, changes exercises every session) tried the app and gave up. He
could not tell where to start, the only obvious way to log was to build a routine first, and 5,600
exercises with no visible favourites was a wall. What he wants: write down today's exercises,
reps and kg, during the gym or afterwards, and see last time's numbers next time.

Most of the parts exist (Freestyle, Log a past workout, favourites, "Last time") but are buried
behind the routine-first navigation.

## Goals

- A **simple mode** that is chosen on first launch and can be switched in Settings at any time,
  either way, losing nothing.
- Simple mode is a notebook: one **Today** page per day, add an exercise, type reps and kg, done.
  No Start and no Finish. Logging set by set at the gym and typing it in afterwards are the same
  action. Arrows move to another day to fill in or fix it.
- Exercise picking puts the person's own exercises first (starred, then recently used, each with
  its last weight) and makes starring one tap.
- Each exercise shows **Last time** (the last day it was done, any workout).
- Three tabs: **Today, Progress, Friends**. History is the "Earlier" list on Today plus "See all";
  Settings is a gear at the top of Today.
- **Progress** is a cut-down Stats page: this month (workouts, week streak), the muscle map of what
  was trained, one exercise-progress line (heaviest set per workout), and body weight only when
  there are weigh-ins.
- **Friends** is the existing screen, shown only when signed in to a server.

## Non-goals

- Simplifying the full app (Emil's point 1). A separate piece of work.
- New social features; Friends is reused as it is.
- Rest timers, progression rules, routines, warm-ups, effort, supersets in simple mode.

## Anti-goals

- Anything that forks the data: a simple-mode day must be an ordinary workout record, so switching
  to full mode shows it in History, Progress and records with nothing lost.
- A first-run question that blocks an existing user. Profiles that already have workouts or
  routines are full mode and are never asked.

## Decided

- `S.appMode`: `null` (not chosen), `'simple'` or `'full'`. A top-level setting, so the sync
  stamps it like any other (`stampEdits`). Null with no workouts and no routines shows the choice
  screen once setup is done; null otherwise reads as full.
- A day's log is the workout of that day with `log: 'day'` (one per day; created on the first set,
  deleted when its last set goes). Every set with reps (or weight) is `done: true`. The record has
  `routineIds: []`, `name: 'Workout'`, `start` at noon of the day if not today, `end` = last edit,
  `vol`, `prs` rebuilt for the touched exercise (rebuildPrHistory) and `_ts` (stampWorkout) on
  every change, and `exWeights` raised like a finish does. Pure helpers in `lib/day-log.js` with
  tests beside them.
- A workout of that day that is not a day log (finished in full mode) is shown read-only on Today
  in simple mode, with its exercises, under the day's log. (Builder's call: editing it stays in
  full mode's editor.)
- Full mode keeps the round Start button and today's screens exactly as they are.

## Left to the builder

- Layout and styling within the existing CSS vocabulary (cards, `lrow`, Button, NumberField).
- How the picker's "your exercises" list is ordered beyond favourites first, then recency.
