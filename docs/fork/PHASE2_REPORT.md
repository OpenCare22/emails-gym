# Phase 2 report: Email's Gym design (handoff §9)

Branch `phase-2/make-it-mine`, 2026-11-09 to 2026-11-10. Plan: `docs/fork/DESIGN_PLAN.md`;
design: `design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md`, icons and renders in `design/`.

## What changed

| Step | Result |
|---|---|
| 1 Tokens | Handoff colours mapped onto the existing variables (table at the top of `frontend/src/index.css`); sage (default), blue, terracotta, lavender; status inks, heart-rate red, five HR zones and six chart series (darkened in light mode to reach 3:1); Inter type scale, tabular numbers; seasonal themes hidden. |
| 2 Branding | "Email’s Gym" in every visible string (app, pushes, passkey prompt, backups, print, share images, Coach prompts); slab E icon (centred, opaque 180/192/512/1024), boot screen, print and share marks; Inter bundled (no Google Fonts call); upstream donation links gone, About credits openGym. |
| 3 Navigation | Home · Workouts · Start · Progress · Friends; Workouts switcher (Routines, History, Exercises); Friends screen with an honest empty state (`lib/fork-flags.js`). |
| 4 Components | Off-white primary buttons, pill segments, 44 px hit areas on every control (filter chips 39 px, all the row gap allows), every switch named. |
| 5 Screens | Home: brand header, greeting with first name and training days, Today card with Start, Steps/Resting HR cards, weekly chart. Workout: Focus view by default, Finish/Discard in ⋯, big steppers, Complete set, Last time hint, Undo, rest ring card. |
| 6 Checks | No overflow at 375/390/430 px; light and dark; contrast test for every accent; reduced motion; focus rings; light boot screen; installed on Emil's iPhone over Tailscale: icon, launch screen, status bar, push all fine; titles moved clear of iOS's top-edge blur. |

Tests: frontend 7,446 and api 793 (3 skipped) pass under Node 22. New tests cover the tokens'
contrast, fork-hidden features, Friends states, Home, the weekly chart helper, the tab bar,
the Focus view (Last time, Undo, rest ring), hit areas and switch names.

## Confirmed working
Logging a set in the Focus view, rest timing (absolute `endsAt`, survives backgrounding),
Undo of a completed set, Finish and confirmed Discard from ⋯, Resume from the tab bar, push
notifications on iPhone, passkey sign-in over HTTPS.

## Not built yet (data the design shows but the app does not have)
- Steps, resting heart rate, sleep: Google Health (PLAN.md Phase 4). Home says "Not connected".
- Heart rate during or after a workout: Phase 4 (after) and Phase 9 (live, Apple Watch).
- Friends, leaderboards, nudges, invites: Phase 7. The screen shows an empty state only.
- Notifications bell from the Home render: no notification inbox exists, so it was left out.

## Deliberate deviations
- Start button kept in the middle of the tab bar (Emil's call; the render has four tabs).
- The bell in the Home header is omitted (nothing to open).
- History keeps its back arrow to Progress (the tour relies on it) while sitting under Workouts.
- Filter chips get 39 px targets, not 44, to avoid overlapping rows.

## Deferred
- Phase 3: real address and hosting (passkeys move there; friends can join).
- Phase 9: the iPhone app's Swift files still say "openGym"; upstream's alternate icon files remain.
- Cleanup pass: ~68 dead Android branches; delete the features hidden in `lib/fork-hidden.js`
  that nobody misses.
