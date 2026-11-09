# Email’s Gym — Claude Code design & implementation handoff

**Status:** Approved visual direction, ready for integration into an existing open-source fork.  
**Product:** Private mobile-first workout tracker / iPhone home-screen PWA.  
**Design references:** The supplied dark fitness-app screenshot is a reference for *clarity and hierarchy*, not a template to copy. All app branding and visual elements must be original.  
**App name:** **Email’s Gym** (keep the apostrophe and capitalization in visible product copy).

## 0. Your task, Claude Code

Inspect the **existing** repository first and preserve its framework, data model, logging workflows, authentication, integrations, and application logic wherever possible. Implement a distinct design system and update the UI without blindly replacing the app, fabricating data, or deleting working functionality. State which areas you modified and which API/data functionality was already present versus remains unimplemented. No visual or code assets should be reused from openGym or third-party fitness brands.

Treat the **separate PNG mockups** as visual guidance; follow the specifications below for actual values, text, behavior, accessibility, and responsive layouts. Generated design renders may contain demonstration content, so **do not hard-code their dates, user names, exercises, sets, metrics, or scores**.

### Included assets

| File | Purpose |
|---|---|
| `emails_gym_icon.svg` | Master scalable icon, full-bleed square canvas |
| `emails_gym_icon_1024.png` | High-resolution icon source |
| `emails_gym_icon_512.png` | PWA icon |
| `emails_gym_icon_192.png` | PWA icon |
| `emails_gym_icon_180.png` | Apple touch icon |
| `emails_gym_icon_presentation.png` | Visual icon presentation with 40px readability check |
| `emails_gym_home_render.png` | Home screen visual reference |
| `emails_gym_workout_render.png` | Active workout reference |
| `emails_gym_friends_render.png` | Friends leaderboard reference |

> The phone mockups are conceptual renders cropped from the approved design board, **not editable application screens**. Recreate their layout in the app’s actual component system.

---

## 1. Brand and visual personality

- **Quietly athletic, concise, useful.** No highlighter colors, huge gradients, neon glows, glassmorphism, decorative noise, faux dashboard complexity, or ornamental illustrations.
- Mostly near-black in dark mode, off-white in light mode, charcoal cards, crisp typography, soft **sage** accent used sparingly.
- **Sage is functional**: active tabs, completed training days, progress rings, selected stats and small highlights. Not large colored panels or outlines around every element.
- White/off-white is the **primary action color** where stronger visual hierarchy is required. Sage can be used for selective completion/confirmation actions.
- Maintain a generous, predictable layout grid and clear touch targets. Content first; decoration last.
- Brand mark: a bold, three-piece forward-leaning **slab E** with three wide white bands and diagonal ends on an opaque, near-black square. The mark contains **no text**. Keep it simple and recognisable at 40px. Do not put key details near iOS-rounded corners. No generic dumbbell or barbell icon in the app logo.
- Avoid copying the uploaded design references, other fitness products, or Apple’s trademarks. Use broadly familiar iOS interaction principles without imitating proprietary branded screen designs.

## 2. Tokenized color system

The following are **implementation tokens**, not hex values to extract from image pixels. All primary/secondary/muted text values below are intended for their corresponding backgrounds, including the darkest card surfaces. Check exact contrast after implementation and whenever layering opacity or changing backgrounds.

| Role | Light | Dark |
|---|---|---|
| Background | `#F8F9F7` | `#0B0D0C` |
| Surface/card | `#FFFFFF` | `#161A18` |
| Elevated surface | `#F0F2EF` | `#202622` |
| Divider/border | `#DCE2DC` | `#333A35` |
| Primary text | `#161B17` | `#F5F7F4` |
| Secondary text | `#414A43` | `#C4CEC5` |
| Muted text | `#626C64` | `#A0AAA1` |
| Accent / sage decorative | `#648D68` | `#A7C7A2` |
| **Text/link accent** | `#355D3B` | `#A7C7A2` |
| Accent foreground | `#FFFFFF` *on dark sage text/button variant* | `#101510` |
| Primary button | `#161B17` | `#F5F7F4` |
| Primary button text | `#FFFFFF` | `#101510` |
| Alt accent / blue | `#2466A0` | `#76B9F1` |
| Alt accent / terracotta | `#9C503A` | `#E9A08A` |
| Alt accent / lavender | `#735AA0` | `#C0ABE9` |
| Success / PR | `#236B46` | `#76C59A` |
| Warning | `#8A5B0B` | `#F0BE65` |
| Error | `#A83138` | `#FF8A8E` |
| Heart rate red | `#B33443` | `#FF7785` |

**Accessibility:** Do not place white text on the pale dark-mode sage `#A7C7A2`; use `#101510` or a darker button treatment. Do not use light-mode `#648D68` as small text on white; use `#355D3B` for text links and small active labels. For low-contrast labels, use the designated muted **text** token instead of simply reducing opacity. State must never depend on color alone.

### Copy-paste CSS tokens

```css
:root {
  color-scheme: light;
  --bg: #F8F9F7;
  --surface: #FFFFFF;
  --surface-elevated: #F0F2EF;
  --border: #DCE2DC;
  --text-primary: #161B17;
  --text-secondary: #414A43;
  --text-muted: #626C64;
  --accent: #648D68;
  --accent-text: #355D3B;
  --accent-foreground: #FFFFFF;
  --button-primary: #161B17;
  --button-primary-text: #FFFFFF;
  --accent-blue: #2466A0;
  --accent-terracotta: #9C503A;
  --accent-lavender: #735AA0;
  --success: #236B46;
  --warning: #8A5B0B;
  --error: #A83138;
  --heart-rate: #B33443;
  --radius-card: 16px;
  --radius-control: 12px;
  --radius-pill: 999px;
  --page-gutter: 20px;
  --card-gap: 12px;
  --touch-min: 44px;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg: #0B0D0C;
    --surface: #161A18;
    --surface-elevated: #202622;
    --border: #333A35;
    --text-primary: #F5F7F4;
    --text-secondary: #C4CEC5;
    --text-muted: #A0AAA1;
    --accent: #A7C7A2;
    --accent-text: #A7C7A2;
    --accent-foreground: #101510;
    --button-primary: #F5F7F4;
    --button-primary-text: #101510;
    --accent-blue: #76B9F1;
    --accent-terracotta: #E9A08A;
    --accent-lavender: #C0ABE9;
    --success: #76C59A;
    --warning: #F0BE65;
    --error: #FF8A8E;
    --heart-rate: #FF7785;
  }
}

/* Allow manual theme selection as a deliberate override of the system theme. */
[data-theme="dark"] {
  color-scheme: dark;
  --bg:#0B0D0C; --surface:#161A18; --surface-elevated:#202622;
  --border:#333A35; --text-primary:#F5F7F4;
  --text-secondary:#C4CEC5; --text-muted:#A0AAA1;
  --accent:#A7C7A2; --accent-text:#A7C7A2; --accent-foreground:#101510;
  --button-primary:#F5F7F4; --button-primary-text:#101510;
  --accent-blue:#76B9F1; --accent-terracotta:#E9A08A;
  --accent-lavender:#C0ABE9; --success:#76C59A;
  --warning:#F0BE65; --error:#FF8A8E; --heart-rate:#FF7785;
}
```

**Implementation note:** A `data-theme="light"` override also needs a matching light token map if manual theme switching is implemented; do not rely on this media query alone. For accent selection, map user-chosen accent variables based on theme and ensure the paired foreground/link colors retain AA contrast. Avoid applying a light-mode accent intended for decoration to small body text.

### Heart-rate zones

Use five ascending, readable colors. Treat percentages below as **example zones** only until a configured max-HR/threshold model exists. Never imply they are clinically individualized.

| Zone | Label | Color |
|---|---|---|
| Z1 | Recovery | `#438FE0` |
| Z2 | Easy | `#30B78B` |
| Z3 | Aerobic | `#9DBE55` |
| Z4 | Threshold | `#E9A64F` |
| Z5 | Maximum | `#E76670` |

Heart-rate red (`--heart-rate`) is the standalone HR metric color; zone colors are for classifications and legends. Include text labels/icons alongside colored zones.

### Multi-series charts

Use a qualitative color-blind-aware palette and distinguish series with labels, direct values, line patterns, or distinct point shapes too:

```css
--chart-1: #56A8E3; /* blue */
--chart-2: #E1AA51; /* amber */
--chart-3: #4DB8A3; /* teal */
--chart-4: #BB8BDD; /* violet */
--chart-5: #E58E86; /* salmon */
--chart-6: #A9B8BF; /* slate */
```

Those chart hues are **series encodings**, not body-text colors; annotate charts in normal accessible text. Never promise universal color-blind distinguishability from hue alone. Test line/bar contrast against actual chart backgrounds.

## 3. Typography and spacing

Use **Inter** from Google Fonts. Fallback: `system-ui, -apple-system, sans-serif`. Avoid mixing several fonts unnecessarily. Use tabular numeric glyphs in training stats, weights, timers, steps, and rankings.

| Element | Mobile size | Weight | Line height |
|---|---:|---:|---:|
| Screen heading | 30–32px | 700 | 1.12 |
| Main workout exercise | 22–24px | 650–700 | 1.2 |
| Section heading | 18–20px | 600 | 1.3 |
| Card heading | 16–17px | 600 | 1.35 |
| Body / controls | 16px | 400–600 | 1.45 |
| Secondary labels | 14px | 400–500 | 1.4 |
| Small metadata | 12–13px | 400–500 | 1.4 |
| Big workout weight / timer | 40–52px | 650–700 | 1.08 |

Spacing steps: `4, 8, 12, 16, 20, 24, 32px`. Use **20px page gutters**, **12px card gaps**, **16px card padding** (up to 20px on spacious sections). Radii: **16px cards**, **12px controls**, **pill** for segmented tabs and tiny actions. Borders are thin and subtle; avoid heavy shadows. Icons should have consistent optical weight and be legible at 20–24px.

## 4. Information architecture

Bottom navigation (four tabs): **Home · Workouts · Progress · Friends**. The active workout itself opens as a focused full-screen workflow, minimizing navigation distractions. Bottom navigation respects iPhone safe-area padding.

### A. Home (`emails_gym_home_render.png`)

Hierarchy, top to bottom:

1. Header: small slab-E brand mark and `Email’s Gym` on the left; notification and profile buttons right.
2. Personal greeting (`Hi, [first name].`) and quiet summary (`3 of 5 training days this week.`), populated from real data.
3. **Weekly training strip:** Mon–Sun, complete/incomplete/selected states, one-line labels, visible checkmarks for completed days. Do not mark future days as skipped.
4. **Today's session card:** workout name, key muscle groups, estimated duration or planned exercises when available, a clearly discoverable **Start workout** action. Use subtle workout imagery only if licensed/owned and the content is actually available; otherwise typography and a simple abstract graphic are better.
5. **Two metric cards** side by side: steps and resting heart rate from the connected wearable (or show an explicit unavailable/sync state). Show trend only if comparison data exists.
6. **Weekly training** chart: 7 simple bars / structured chart, labeled and readable, real data only.
7. Fixed bottom navigation, including `env(safe-area-inset-bottom)`.

### B. Active workout (`emails_gym_workout_render.png`)

**Fast logging beats dashboard density.** Screen hierarchy:

1. Back button, workout name, overflow menu. Navigating away must preserve an in-progress workout or explicitly confirm a destructive discard.
2. Current exercise as a clear heading, e.g. `Bench Press`, plus `Set 3 of 4`.
3. Large editable weight control, with large decrement/increment tap areas and **kg/lb** unit according to settings. In addition to plus/minus, tap numeric value for direct keyboard input. Never assume all exercise weight jumps are the same: obtain increments from settings or default clearly.
4. Large reps input with easy inline editing. Support sets logged by weight/reps plus completed status; if prior performance exists, show it as a subtle hint.
5. Dominant current set action (`Complete set`); prevent accidental duplicate logging and provide undo.
6. Rest timer in a dedicated rounded card: large `mm:ss`, progress ring, pause/resume and skip controls. It starts only when intended by the workout flow, and continues accurately if the PWA is backgrounded (use absolute timestamps rather than relying only on intervals).
7. Heart rate card if connected/current: bpm with freshness indicator and appropriate zone label when available. Show `Not connected` or `No recent reading` rather than inventing live readings.
8. Previous/next exercise navigation, clearly separated from completing or discarding sets.

**Safety/UX:** Large touch targets (min 44×44 CSS px), high contrast, minimal text entry, no distracting animations, legible one-handed interactions, and explicit save/resume states. On iOS the app may not get background sensor data or reliable timer notifications; do not represent Fitbit readings as live without an actual live capability.

### C. Friends (`emails_gym_friends_render.png`)

1. Title `Friends` and optional friend invite control.
2. Segmented control: **This Week · Streaks · All Time**.
3. Clean ranked list. Each row: rank, optional avatar/fallback initials, friend name, rank metric, training days/streak context, **Nudge** button for other users only.
4. The user's own row uses a **very subtle** tinted panel or hairline border; no loud neon outlines. If the user is rank 1, celebrate minimally.
5. Nudges require a real send action, delivery/result feedback, throttling/cooldown, and user opt-out settings. Prevent repeated taps and harassment/spam.
6. Ranking definition must be displayed in plain terms (`workouts completed this week`, `training points`, etc.). The reference artwork contains example point counts; do not imply a scoring algorithm exists unless implemented. Handle ties and timezone/week boundaries consistently.
7. Empty state: suggest inviting friends, never populate with made-up people.

### Other existing app pages

Restyle existing **Workouts, Progress, Profile, Settings, Body Weight, Cardio, Fitbit connection** views consistently. Reuse the new cards, labels, buttons, tab bars, forms, chart conventions, and loading/error/empty states. Preserve the repository's working functionality and routes.

## 5. Component inventory

Suggested logical components (adapt names to your framework):

- `AppShell`, `BottomNav`, `TopBar`, `BrandMark`
- `Button` (primary, secondary, text), `IconButton`, `SegmentedControl`, `Tab`
- `Card`, `MetricCard`, `EmptyState`, `SyncStatus`
- `WeekDayStrip`, `WorkoutPreviewCard`, `TrainingBarChart`
- `WorkoutExerciseHeader`, `WeightStepper`, `RepsControl`, `SetCompletionButton`
- `RestTimer`, `HeartRateCard`, `HeartRateZoneLegend`
- `LeaderboardRow`, `NudgeButton`, `StreakLabel`
- `Skeleton`, `Toast`, `ConfirmationDialog`

Never use tiny controls to hit the 44px minimum merely visually; the actual pointer/clickable hit region must comply. Maintain keyboard focus indicators, accessible names, text equivalents for charts, and reduced-motion support.

## 6. iPhone PWA requirements

- Provide a manifest with `name: "Email’s Gym"`, `short_name: "Email’s Gym"`, `display: "standalone"`, theme/background colors and `192×192` / `512×512` icons.
- Include an Apple touch icon `180×180`; the icon images have opaque full-bleed backgrounds. Do **not** pre-round them in the actual icon asset: iOS applies masking.
- Include appropriate viewport meta: `width=device-width, initial-scale=1, viewport-fit=cover`.
- Support safe areas (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`), especially navigation, timers and sticky actions.
- Test iPhone widths ~375px, 390px and 430px plus landscape/keyboard behavior and zoomed text.
- Use a service worker only within the architecture already present or after adding a supported PWA solution. Cache app shell/assets sensibly; never cache private health/workout API responses indiscriminately.
- Preserve unfinished workout logs when offline if the existing data architecture allows it. Make pending sync visible; resolve duplicate submissions and conflicts safely. Do not promise offline writes until implemented and tested.
- Respect reduced motion, system theme, and a user theme override. Support accessible font scaling.
- Consider `apple-mobile-web-app-capable` and Apple status bar configuration based on current support and the app's existing tooling.

## 7. Real data and API integration constraints

The app tracks strength, cardio, body weight, heart rate, Fitbit steps, streaks, and friends. **No screenshot proves an API feature exists.** Inspect the fork and document current data sources and API contracts. In particular:

- Do not invent heart rate, step count, PRs, workout statistics or people.
- Fitbit data must be shown with accurate source and last-sync timestamp. Real-time HR may not be available from the Fitbit web API; verify available endpoints, permissions, sync cadence and provider requirements before claiming `live` heart rate.
- Usernames, friends, permissions, and scoring must use the application's actual identity and data relationships.
- For user privacy, social views must use permissioned data and an explicit sharing model.
- Make accessible states for loading, disconnect, authorization expiry, no reading, errors, and empty data.

## 8. Acceptance criteria

1. Branding says **Email’s Gym**, with no inherited openGym logos, names, brand colors or assets in the visible application.
2. PWA icon is readable at **40px** and correctly installed as opaque `180/192/512` icons.
3. Dark mode is visually close to the approved quiet charcoal + sage direction; no orange/purple highlight system and no neon/glow treatment.
4. Light mode is complete, consistent, and readable, not simply an inverted screenshot.
5. **Home, Active Workout, Friends** match the intended content hierarchy and have real loading/empty/error states.
6. Workout inputs are fast and reliable on iPhone; in-progress state is not lost on accidental navigation.
7. Every essential interactive control works with touch and keyboard; 44px min targets; visible focus rings; usable in direct sunlight.
8. Normal-size text meets **WCAG AA 4.5:1**, large text and UI graphical boundaries meet applicable **3:1** requirements. Audit all actual foreground/background pairs, not merely token tables.
9. Charts use labels as well as color; no fake analytics data in production.
10. No regression in existing workout logging, user accounts, Fitbit integration, or social workflows.
11. Implement tests for basic route rendering, navigation, logging a set, timer resilience, theme switch, and leaderboard/nudge states; report anything not testable.

## 9. Recommended implementation sequence

1. Inspect repository layout, framework, current components/styles, data model, theme handling, PWA manifest and existing tests.
2. Replace branding and install icons; adjust manifest and metadata.
3. Introduce tokens and typography, create shared UI primitives, implement system theme and optional settings override.
4. Rebuild Home layout against live/stubbed **explicitly labeled** data contracts, with real empty/error states.
5. Optimize Active Workout logging and rest timer without changing business rules blindly.
6. Rebuild Friends ranking and nudge controls using actual backend capabilities.
7. Restyle remaining pages and verify consistency.
8. Run mobile viewport, contrast, accessibility, offline, privacy and regression checks.

**Final report from Claude Code should include:** files changed, screenshots of implemented screens, functional features confirmed, missing API integrations, accessibility results, remaining tasks, and any deliberate deviations from this handoff.
