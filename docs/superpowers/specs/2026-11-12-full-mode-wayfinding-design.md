# Full mode: easier to find your way around

2026-11-12. Agreed with Emil in a brainstorm, with mockups. The other half of the feedback behind
simple mode (`2026-11-12-simple-mode-design.md`): simple mode is for people who just want a
notebook; this makes the full app itself less confusing. Simple mode is left exactly as it is.

## Why

A colleague found the full app overwhelming. A UX review of Home, the tab bar, the Workouts tab
and the Start flow found:

- **Workouts is three layers of switches.** Routines / History / Exercises, then inside Routines
  Schedule / Routines, then inside Schedule Fixed Week / Rotation. "Routines" appears twice, and
  nobody can tell what sets up what (Emil: "a mindcluster").
- **Freestyle is hidden.** On a planned day both the round Start button and Home's Today row jump
  straight into the planned session. The Start screen (Freestyle, the other routines) is reached
  only on a rest day or through the small "Choose a different workout" link.
- **Favourites can only be set from an exercise's detail sheet**, and the picker uses two stars
  that mean different things (accent star = used before, yellow star = favourite).
- **A new user is pushed towards building a plan**: Home's Welcome card offers only plans, the
  plan builder sits on top of Workouts even for people with a plan, and the library's only row
  action is "Add to my plan".
- **Home shows steps and resting heart rate**, which Emil finds of little use there; he would
  rather see simplified progress. The week calendar should make it easy to move a session to
  another day (his example: tomorrow's session dragged onto today).

## Goals

1. **Workouts is one page: a list of your routines with their days on them** (Emil chose this,
   layout B, over a separate week list).
2. **Home**: a "Your progress" card instead of steps and resting heart rate, and sessions you can
   drag to another day on the week calendar.
3. **Start** opens a choice, so Freestyle and the other routines are always one tap away.
4. **Favourites**: a star on every exercise row in the picker and the library.
5. **A new user can just start lifting**: the Welcome card leads with starting a workout.

## Non-goals

- Simple mode (`S.appMode === 'simple'`, `views/Today.jsx`, the simple tab bar and Stats): untouched.
- New features. Everything here is moving, merging and relabelling what exists.
- Changing the data model of the schedule (`S.week`, `S.dayPlan`, `S.rotation`, `S.queue`) or the
  sync merge. The new screens write the same fields the old ones did.

## Anti-goals

- **Removing a feature.** Every action that exists today is still reachable after this: combined
  days, rest days in a loop, a routine twice in a loop, externally managed (coach / planner)
  queues and "Use this rotation", start / start over a loop, programmes, the Coach button, export,
  print, import, starter plans, duplicate / reorder / delete routines with Undo, History with
  "Log a past workout" and the performance report, the exercise library with filters, By muscle and
  custom exercises, steps and resting heart rate (in Progress).
- A first tap on the round Start button that starts something without a choice.
- Breaking the guided tour: elements it points at (`data-tour`) move with their feature or the
  tour step is updated to the new place.

## Decided

### Navigation

- The tab bar keeps its five places: Home · Workouts · Start · Progress · Friends.
- `WorkoutsSwitcher` (Routines / History / Exercises) is removed.
- **History belongs to Progress**: its tab parent becomes `stats` (TabBar `PARENT`), its back arrow
  already goes to `/stats`, and Progress already has the History icon and "Recent workouts · All".
  "Log a past workout" and the report stay on the History page.
- **The exercise library** stays at `/library`, under Workouts. It is reached by a search icon in
  the Workouts header. Its page gets a back arrow to `/plan` and the title "Exercises" (it says
  "Workouts" today).
- The Plan page's inner Schedule / Routines switch is removed (and its per-device memory,
  `PLAN_VIEW_KEY`, goes with it).

### Workouts page (`views/Plan.jsx`), layout B

Top to bottom:

1. **Header**: "Workouts", the Coach button as today (same gate), a search icon to `/library`, and
   the ⋯ menu that exists today (export, print, import, starter plan, programmes). Plus, in
   order mode, "Start the loop over" when a loop is running.
2. The programme strip, when a programme is running, as today.
3. **"Get a new plan"** (build me a program / choose a template / make your own) here **only while
   there are no routines**. Otherwise it moves to the bottom of the page.
4. **Your routines**: one row per routine, in `S.routines` order.
   - Tapping the row opens the routine editor (`/plan/r/:id`), as today.
   - **Fixed week (the default)**: the row shows its weekdays as chips (from `S.week`), in the
     week's order (`weekStartOf`). Tapping the chips opens a weekday picker for that routine
     (several days allowed) that writes `S.week`. Two routines on one weekday is a combined day,
     exactly as `dayAssignSheet` makes it today. A routine on no weekday says "No day, start it
     any time".
   - Swipe to duplicate or delete with Undo, and Edit to reorder or delete, as the Routines view
     does today. "+ New routine" at the end of the list.
5. **"Train in order instead of on set days"**: one switch under the list. On is today's Rotation
   (`chooseRotation`), off is Fixed Week (`chooseFixedWeek`), with today's confirm when leaving a
   running loop. With an externally managed queue the switch is shown on and locked, as the
   segmented control is today.
6. **In order mode** the list shows the loop instead:
   - The sequence in order, numbered, with today's states (Done / Up next / Later) and rest days as
     their own rows. Edit to drag them into order and take one out (with Undo, `takeOutOfLoop`);
     "+ Add" adds a routine (again, if wanted) or a rest day, as `addToSeq` does today.
   - The round's progress line and "Start the loop" when nothing runs, as today.
   - "Use this rotation" for an externally managed queue, with its confirm, as today.
   - Routines that are not in the loop follow under **"Not in the order"**. Their weekday chips are
     today's "Also on fixed days": they count on top of the loop.
7. **"Get a new plan"** at the bottom when there are routines (a compact version of today's block).

The "Weekly muscle volume" pointer row ("Now in Stats") goes; the card itself stays in Stats.
Settings keeps its own "How you train" switch.

### Home (`views/Home.jsx`)

- **Steps and resting heart rate leave Home** (`HomeMetrics`). They are already in Progress
  (Activity cards). The Fitbit "import this workout?" prompt (`FitbitImport`) stays on Home,
  because it asks you to do something.
- **A "Your progress" card** takes their place, right after the Today card:
  - Header "Your progress", and "Last 4 weeks ›" that opens Progress.
  - A line with the number of workouts in the last 28 days and the number of new records in them.
  - Your three most-trained exercises, each with the heaviest weight lifted on it in the last 28
    days and the change against the 28 days before (▲ 5 kg, ▼, or = ).
  - Worked out by a pure helper with a unit test beside it (CONTRIBUTING: it reads logged sessions
    back), e.g. `lib/home-progress.js`.
- **Weekly training**, the recap, challenges, check-in, body weight and the streak stay as they
  are and in this order.
- **The "Choose a different workout" link under the Today row goes**; the Start sheet replaces it.
  The Today row itself still starts today's planned session in one tap.
- **Dragging a session on the week strip** (fixed-week mode; in rotation mode the strip is the
  queue row and order already decides):
  - Press and hold a day with a planned session that is not done, then drag it onto another day of
    the shown week; let go to move it. It moves **for that date only** (`S.dayPlan`); the routine
    keeps its weekday.
  - Dropping on a day that already has a session **swaps** the two. Dropping on a rest day leaves
    the source day as rest.
  - An Undo toast puts both days back.
  - Tapping a day still opens its sheet (`dayOverrideSheet`). That sheet gets a **"Move to another
    day"** row doing the same move without dragging.
- **Welcome card** (no routines, no workouts, nothing in progress): "You can just start lifting.
  A plan can come later." with **Start a workout** (primary: a Freestyle session through
  `startFlow([])`, so the weigh-in rule applies) and **Get a plan** (opens Workouts, where "Get a
  new plan" is at the top).

### The Start button

- With nothing in progress, the round Start button opens a **Start sheet** instead of starting
  today's plan straight away:
  - Today's plan as the big first button ("Push · Today's plan · 6 exercises"), when the day has a
    routine with exercises. A combined day is the one combined session, as today.
  - **Freestyle: pick exercises as you go** as the second button; on a rest day it is the first.
  - The other routines, each with Start.
  - Log a past workout.
  - Every start goes through `startFlow`, so the weigh-in and everything after it work as now.
- With a session in progress (or a saved workout being edited) the button behaves as today
  (Resume / Edit workout).
- `/workout` with nothing in progress still shows `StartChooser`. It shows the same choices in the
  same order as the sheet (one shared list is fine).
- Starting from the Apple Watch, Home's Today row and the coach queue row is unchanged.

### Favourites

- **A star at the front of every exercise row** in the exercise picker (`ExercisePicker` in
  `sheets.jsx`) and the library (`views/Library.jsx`); a tap stars or unstars (`toggleFav`), the
  rest of the row keeps its own taps. The muscle explorer may get it too if it is the same row.
- **"Used before" is said in words**: the accent star tag on the picker row becomes a small text
  tag ("used 14×", from the usage count), and the picker's ★ / ☆ filter chips read "Used before"
  and "Favourites".
- **The library's ＋** opens a short menu: "Add to today's workout" and "Add to a routine"
  (today's `addToRoutineSheet`).

### Text

English, through `t()`, plain and human, no em dashes. New strings as shown above.

## Builder's calls (settled after the review, Emil to check)

- **What can be dragged.** `S.dayPlan[iso]` holds one routine id or `'rest'`, so only a day with
  exactly one routine from the fixed week can be moved or swapped. A combined day is not
  draggable and its sheet's "Move to another day" row is not offered. In rotation mode there is no
  week strip to drag on. No data-model change.
- **Which days take a drop.** Source and target are today or later, and neither is done. Past days
  and done days do not accept a drop, so a move never turns a day into a missed one or rewrites one
  already trained. The same rule applies to "Move to another day". Moving a session back to its own
  weekday clears the override instead of writing one.
- **The library's "Add to today's workout".** With a session in progress it adds the exercise to
  that session. With none it starts a Freestyle session with the exercise in it, through
  `startFlow`, so the weigh-in rule applies.
- **"Your progress" numbers.**
  - Only exercises logged with a weight (reps-mode, weight > 0) count. Timed, cardio and pure
    bodyweight sets are left out.
  - Most-trained means in the most workouts over the last 56 days. Ties go to the more recent one.
  - Heaviest weight means the heaviest done work set, not a warm-up, in the exercise's own unit
    (`lib/ex-unit.js`), compared with the 28 days before.
  - Records means the records stored on the workouts of the last 28 days (`w.prs`, which the finish
    path writes). That is the same thing Progress reads.
  - With no workout in the last 28 days the card shows a one-line nudge instead of numbers.
- **"used 14×"** counts logged workouts only, not routines. `usageMap` still drives the picker's
  "Used before" filter as today.
- **Welcome card condition** stays as today: no routines and nothing in progress. Only its buttons
  change.
- **Base.** The build sits on the current working tree, including the uncommitted simple-mode
  work. The simple tab bar, Today and simple Stats are not touched. Nothing is committed unless
  Emil asks.

## Left to the builder

- Layout and styling within the existing CSS vocabulary (cards, `lrow`, `Row`, chips, Button, the
  menu and confirm sheets). Mockups in the brainstorm were wireframes, not a visual spec.
- How the week strip shows a session it lets you grab (its dot, glyph or a short label), the
  press-and-hold timing, and drag feedback. Pointer events, no new dependency; it must not break
  the week arrows or the tap that opens the day sheet.
- The exact tests, beyond: the progress helper's unit tests, and the existing screen tests updated
  to the new layout (Plan, Home, TabBar, Library, History, tour).
