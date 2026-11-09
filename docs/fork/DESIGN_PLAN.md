# Email's Gym: design implementation plan

For Claude Code. This plan turns the approved design (`design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md`
plus the renders and icons in `design/`) into the fork, and fits it into the phases of `PLAN.md`.

**Source of truth, in order:** this file → the handoff → the PNG renders. Where they disagree,
the earlier one wins. The renders are mood boards, not specs.

## Setup

Copy into the repo:

```
design/
  EMAILS_GYM_CLAUDE_CODE_HANDOFF.md
  emails_gym_icon.svg
  emails_gym_icon_{180,192,512,1024}.png
  emails_gym_icon_presentation.png
  emails_gym_{home,workout,friends}_render.png
```

## Corrections to the handoff (apply these, they override it)

1. **Fitbit data comes from the Google Health API**, not the Fitbit Web API (shut down
   September 2026). See `PLAN.md` Phase 4.
2. **There is no live heart rate during a workout.** The Fitbit Air syncs to the Google Health
   app on the phone, and the server reads it from Google afterwards. So on the active workout
   screen, the HR card is **hidden by default**. After the workout, show the session's HR graph,
   average, max and time in zones once the data has synced. Build the card so it lights up
   automatically when a live source exists: that will be Apple Watch users on the native app
   (`PLAN.md` Phase 9), so the render's live-HR card isn't wasted.
3. **Workout screen primary action:** the render's big centre button is a "stop" square. Per the
   handoff, the dominant action is **Complete set**. Finishing or discarding the workout goes in
   the overflow menu with a confirmation.
4. **Friends render inconsistency:** it shows "You" at #1 and "Emil" at #2, but Emil is the
   user. The real list shows the current user once, labelled "You" (with their name), never twice.
5. **Fonts:** bundle **Inter** in the app (it's OFL-licensed) instead of loading it from Google
   Fonts, so phones don't call Google on every launch. Same visual result.
6. **Home "Today" card:** the render uses a photo of a weight plate. Don't add stock photos. Use
   typography and, at most, a simple abstract shape drawn in CSS/SVG.
7. **Exercise media:** the Gym Visual animations stay as they are (180 px, unmodified, with the
   notice). The new design must not crop, tint, recolour or filter them. Frame them in neutral
   cards only.
8. **Icon centring:** the slab E in `emails_gym_icon.svg` sits about 50 px left of centre on the
   1024 canvas (its bounding box spans x≈196–718, so its centre is x≈457). Check it at 40 px next
   to other home-screen icons. If it looks off, shift the `<g>` right by ~45 px
   (`transform="translate(45 0)"`) and re-export 180/192/512/1024 from the SVG.
9. Features the handoff lists as "no regression" (Fitbit, friends, nudges between friends) **don't
   exist yet**. Build their screens with honest empty and "not connected" states now; the data
   arrives in `PLAN.md` Phases 4 and 7.

---

## Step 1: Map the tokens onto the existing theme (don't build a second system)

The app already has a full token system in `frontend/src/index.css` (`--bg`, `--bg-el`, `--label`,
`--label-2/3/4`, `--sep`, `--hair`, `--acc`, `--acc-ink`, `--acc-soft`, `--on-acc`, `--red-ink`,
`--green-ink`, the `--fs-*` type scale and more), a `data-theme` light/dark/system switch, and a
user accent picker (`lib/accent.js`).

- Map each handoff token onto the existing variable it corresponds to, in both themes, rather
  than adding parallel `--surface`/`--text-primary` variables that half the components ignore.
  Add only what's genuinely missing (e.g. `--heart-rate`, zone colours, chart series colours).
  Write the mapping as a table in a comment at the top of `index.css`.
- Replace the accent presets in `lib/accent.js` with **sage (default), blue, terracotta,
  lavender**, each with its light and dark value and its own text/foreground pair from the
  handoff. Keep the custom-colour option only if it enforces AA contrast for the foreground;
  otherwise drop it. Migrate existing saved accents to sage.
- Remove seasonal themes (`seasonAccent`), since they'd override the brand.
- Hunt down hard-coded upstream colours, starting with the boot/error screen in `index.html`
  (lime `#a3e635`, `#0c0e12`), the manifest, and any inline styles. `grep -rn "#[0-9a-fA-F]\{6\}"`
  across `src/` and `index.html` and justify every hit that remains.
- Typography: Inter with tabular numbers on weights, reps, timers, steps and ranks. Adjust the
  existing `--fs-*` scale to the handoff's sizes instead of adding a new scale.

**Tests:** a contrast test that checks every text/background token pair in both themes against
AA (4.5:1 normal, 3:1 large and UI boundaries), for every accent preset.

## Step 2: Branding and PWA

- `public/manifest.json`: name and short_name `Email's Gym`, `theme_color` and `background_color`
  from the dark `--bg`, icons 192 and 512 (`purpose: "any"`; add a separate maskable variant only
  if it's padded for Android masks, which we don't need).
- Apple touch icon 180, opaque, not pre-rounded. Remove every upstream icon, favicon and app-icon
  option (Settings has an app-icon chooser; delete the upstream choices).
- `viewport-fit=cover`, safe-area insets, `apple-mobile-web-app-title`, status bar style.
- Replace "openGym" in all visible strings, page titles, push notification texts
  (`api/push-messages.js`, `nudge-copy.js`, `wrapped-copy.js`), emails and onboarding.
  Code identifiers and the storage key can stay; renaming them risks breaking sync.
- `BrandMark` component from the SVG paths, used in the Home header and the login screen.

## Step 3: Navigation shell

New bottom nav: **Home · Workouts · Progress · Friends**. Map the existing routes:

| Tab | Existing views |
|---|---|
| Home | `Home` |
| Workouts | `Plan` (routines, programmes), `History`, `Library` |
| Progress | `Stats`, `Measurements`, `Muscles`, `ProgressPhotos`, `StructuralBalance` (whichever survive Phase 1) |
| Friends | New `Friends` view (Step 6) |
| Avatar button (top right) | `Settings`, profile, Connections (Google Health, Apple Health) |

The active workout (`/workout`, with the existing `FocusView`) opens full-screen with no tab bar.
Keep every existing route working; old paths can redirect.

## Step 4: Shared components

Build the handoff's component inventory (§5) on top of the existing components rather than next
to them: restyle `components/` where a match exists, add new files where it doesn't. Every
component gets loading, empty and error states and a 44 px hit area.

## Step 5: Screens

**Home:** header with brand mark → greeting with real first name and "X of Y training days
this week" from the plan's scheduled days → week strip (no "missed" state for future days) →
Today card from the next routine in the queue (`lib/queue.js`) → Steps and Resting HR cards
(show "Connect Google Health" until Phase 4, then real values with "synced X ago") → weekly
training chart from history. Trends only when there's enough data to compare.

**Active workout:** restyle the existing workout and focus views to the render's hierarchy.
Keep the existing logic for set types, warm-ups, supersets, progression and plates. Weight
stepper uses the existing per-exercise increments and the plate logic; tap the number to type.
Rest timer already exists; make sure it uses absolute timestamps (verify, don't assume) and
survives the PWA being backgrounded. Previous performance shown as a subtle hint. Undo after
completing a set. HR card hidden (correction 2).

**Friends:** build the screen with the segmented control, list layout, "You" row treatment and
empty state ("Invite friends") now, behind a feature flag, wired to the Phase 7 API when it
exists. Never ship placeholder people.

**Everything else:** restyle Workouts, Progress, Settings, measurements and cardio views with
the shared components.

## Step 6: Check

- Viewports 375, 390 and 430 px, landscape, keyboard open, Dynamic Type / zoomed text.
- Light and dark, every accent preset.
- Reduced motion, keyboard focus rings, screen-reader names, text equivalents for charts.
- Install on a real iPhone: icon at home-screen size, splash, status bar, safe areas, push.
- Full test suites green; new tests for route rendering, nav, logging a set, timer resilience,
  theme switching, and Friends empty/loaded/error states.
- Final report as the handoff's §9 asks, plus a list of anything deferred to `PLAN.md` phases.

---

## Where this fits in PLAN.md

| PLAN.md | Design work |
|---|---|
| Phase 0–1 (baseline, strip) | Nothing yet. Strip first so you don't restyle screens you're about to delete |
| **Phase 2 (make it mine)** | **Steps 1–6 of this file** |
| Phase 3 (hosting) | Install-on-iPhone checks from Step 6 |
| Phase 4–5 (Google Health, progress) | Fill Home metric cards, post-workout HR, Progress cards |
| Phase 6 (cardio) | Cardio and interval components in the same style |
| Phase 7 (friends) | Wire the Friends screen to real data, nudges, remove the feature flag |
| Phase 4b (Apple Watch data) | Connections screen: Google Health and Apple Health setup, each with its own status and "last synced" |
| Phase 9 (native + Watch) | Same tokens in the iOS shell; restyle the Swift watch app (colours, icon, type) to match |
