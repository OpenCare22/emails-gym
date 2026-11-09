# Fork plan: personal openGym for me and my friends

Hand this file to Claude Code in the root of the fork. Read `CLAUDE.md` and `docs/ARCHITECTURE.md`
first: they map the codebase. Work one phase at a time, on its own branch, and run the test
suites after every step (`cd frontend && npm test`, `cd api && npm test`). Don't move to the next
phase until the current one is green and I've tried it on my phone.

## Who it's for

- Me plus a small group of friends. **Everyone is on iPhone.** No Android.
- Self-hosted: one server, one account per person (passkeys), used as a **home-screen web app
  (PWA)** first. A native iPhone + Apple Watch app comes later (Phase 9), so the iOS code is
  kept, not deleted.
- I wear a **Fitbit Air**. Its data lives in Google's new Google Health app and is read through
  the **Google Health API** (the old Fitbit Web API was shut down in September 2026).
- **Some friends wear an Apple Watch.** Their data lives in Apple Health on their iPhone. Apple
  Health has no web API, so it reaches the server either from a native app (Phase 9) or from an
  export app on their phone (Phase 4b). Leaderboards must treat Fitbit and Apple Watch users
  the same.

## Ground rules (don't break these)

- License: keep `LICENSE` (AGPL-3.0) and `NOTICE.md`. Keep the fork in a **public GitHub repo**,
  since the AGPL requires that when friends use it over the network. Add a line to the README
  saying it's a fork of openGym by Duarte Santos, with a link.
- Exercise media in `catalogue/media/` is licensed from Gym visual, not AGPL. It's fine for this
  non-commercial fork **unmodified, at 180 px, with the notice kept**. Don't resize, edit, extract
  or feed the media to any AI tool, and never make this fork commercial without a new license.
- Hide before you delete. For anything uncertain, remove it from menus/settings first, use the app
  for a week or two, then delete the code.
- Respect the "code that exists twice on purpose" list in `CLAUDE.md`: change both sides together.
- Domain logic goes in `frontend/src/lib/` as pure helpers with a `*.test.js` beside them (the
  project's own rule, see `CONTRIBUTING.md`). New API routes go in `api/openapi.yaml` too.

---

## Phase 0: Fork, run, baseline

1. Fork on GitHub, clone, `cp .env.example .env`, `docker compose up -d --build`.
2. Run every test suite and the CI checks listed in `CLAUDE.md`. Record what passes **before**
   anything is changed, so later failures can be told apart from pre-existing ones.
3. Create a profile, log a fake workout, and confirm sync works from two browsers.

**Done when:** the stock app runs locally and the baseline test results are noted in this file.

### Baseline (2026-11-09, upstream `4171d3cef`, Node 22 in `node:22-alpine`)

| Check | Result |
|---|---|
| `api` tests | 800 tests: 797 pass, 0 fail, 3 skipped |
| `mcp` tests | 138 tests: 137 pass, 1 skipped |
| `frontend` tests | 651 files, 7832 tests: 7831 pass, **1 fail** (see below) |
| `check-locales.mjs` | pass (19 locales, 3615 keys each) |
| `check-source-strings.mjs --strict` | pass (2961 strings) |
| `catalogue/build.mjs --check` | pass (5632 exercises) |
| `build-coach-assets.mjs --check` | pass |
| `build-api-docs.mjs --check` | pass (92 endpoints) |
| `catalogue/check-media.mjs` | pass (13108 files, all within 180x180) |
| `frontend` `npm run build` | pass (one `INEFFECTIVE_DYNAMIC_IMPORT` warning for `scan-web.js`) |
| `docker compose up -d --build` | pass; web 200 on :8080, `/api/health` ok |

**Known pre-existing flake:** `src/lib/media-sync.test.js` › "signed in, evicts synced main
files over the cap" hits vitest's 5 s default timeout when the whole suite runs in parallel.
Run alone it passes 31/31, three runs out of three. Not caused by the fork.

**Local setup notes:** Docker here runs through Colima. It needed the `docker-compose` and
`docker-buildx` Homebrew formulas linked into `~/.docker/cli-plugins` (the web Dockerfile uses
BuildKit features). Colima only shares the home folder with containers, so mount from `~`.

**Hand check (done 2026-11-09):** created a profile at http://localhost:8080, logged a fake workout, and
confirmed sync from two browsers.

## Phase 1: Strip what we don't need

Delete in this order, with a commit and a test run after each item.

| Remove | Notes |
|---|---|
| `frontend/android/` (incl. Wear OS) | No Android users |
| ~~`frontend/ios/`~~ | **Keep.** It holds the iPhone app shell and the Apple Watch app needed in Phase 9. Don't build or ship it yet, and leave the `MOBILE` code paths alone |
| `frontend/garmin/`, `watch-zepp/` | No Garmin or Zepp watches |
| `ZeppSettings.jsx`, Garmin/Zepp/Wear OS rows in Settings, `lib/garmin-snapshot.js` | Check imports first. **Keep** `WatchSettings.jsx`, `lib/watch-sync.js` and `api/watch-relay.js`: the Apple Watch app uses the same watch protocol |
| Android-only Health Connect code (`HealthConnectPlugin`, the Android branch of `lib/health-sync.js`) | **Keep** `lib/health-sync.js`, `lib/health-read.js`, `lib/heart-rate.js` and `AppleHealthPlugin.swift` for Phase 9. Keep Capacitor and `capacitor.config.json`; remove the Android platform from it |
| Locales: everything in `frontend/src/locales/` except English (and German, if I decide to keep it) | Update `scripts/check-locales.mjs` and the pt-BR fingerprint test; trim catalogue translations to the kept languages if the build allows it |
| `helm/`, `kubernetes/`, `contrib/nix/`, `cloudflare/`, `website/`, `fastlane/` | Deployment options and upstream's own website |
| `.gitlab-ci.yml`, `.gitlab/`, `.github/workflows/mirror.yml`, `ios.yml`, `renovate.json`, `CLA.md`, `ROADMAP.md` | Upstream project overhead. Keep `test.yml` |
| `mcp/` | Optional. Delete unless I say I want to query my training from Claude Desktop |
| Docs for removed features (`GARMIN.md`, `WEAR_OS.md`, `ZEPP_OS.md`, `NIX.md`, `SELF_HOSTING_KUBERNETES.md`) | Keep `MOBILE.md` and `APP_STORES.md` for Phase 9 |

**Keep** `api/integrations/` (its sealed per-user connections are the natural home for the Google
Health connection in Phase 4) and `api/nudge.js` + `push-messages.js` (reused in Phase 6).

**Hide but don't delete yet:** progress photos, structural balance, data imports, audit logging.

**Done when:** all remaining tests pass, the Docker build works, and the app looks unchanged in
the browser apart from the removed settings.

## Phase 2: Make it mine

- New app name, icon, PWA manifest, theme colour, page titles, and the login screen.
- Replace upstream links (GitHub, Discord, donation links) with my repo, or remove them.
- Default units: kg, cm, week starting Monday.

## Phase 3: Hosting (decide before building features)

**Passkeys are bound to the domain**, and the Google OAuth redirect URL needs a fixed HTTPS
address. Pick the final URL now, because changing it later forces everyone to re-register.

- Run it on an always-on machine (the Mac mini I'm planning, or a cheap VPS until then).
- My friends must reach it from their iPhones without installing anything, so a Tailscale-only
  setup (`docs/SELF_HOSTING_MAC.md`) isn't enough. Use **Cloudflare Tunnel** or a reverse proxy
  with a real domain. Follow `docs/SELF_HOSTING.md` for the rest.
- Turn on `INVITE_ONLY`, disable guest access, and set `VAPID_SUBJECT`.
- Set up a nightly backup of `./data`.
- iPhone push notifications only work when the app is **added to the Home Screen**, so put a
  short "Add to Home Screen" step in onboarding.

**Done when:** a friend can open the link, add it to the Home Screen, sign in with Face ID, and
receive a test push.

## Phase 4: Google Health integration (Fitbit Air)

**Manual steps for me (Claude Code can't do these):** create a Google Cloud project, enable the
Google Health API, set up the OAuth consent screen, add friends as test users, and register the
redirect URL from Phase 3. Put the client ID and secret in `.env`.

**Check in the official docs first** (developers.google.com/health): the exact scopes and data
types available, rate limits, and whether an app in *Testing* status with health scopes has
refresh tokens that expire (Google does this for some sensitive scopes; if so, decide between
verification and a "reconnect" prompt).

Build:

1. **Server-side OAuth** in `api/integrations/`: a "Connect Google Health" button per user. Store
   tokens sealed, like the existing connections. Each friend with a Fitbit connects their own
   account. Nobody's tokens are shared.
2. **A provider interface** (`HealthProvider`: `connect`, `fetchDaily`, `fetchWorkouts`,
   `fetchWeight`, `fetchHeartRate`). Google Health is the first provider; Apple Health is the
   second (Phase 4b). The rest of the app only ever sees normalised data with a `source` field.
3. **Sync job:** on app open plus a periodic server tick, pull new data since a stored cursor.
   Backfill 30 days on first connect. Store it in the user's state as its own section, stamped
   per field so `sync-merge.js` handles it (and the API-side `sync-stamps.js`).
4. **Data to pull (as far as the API offers):** steps, active minutes, resting heart rate, heart
   rate during workouts, sleep duration, weight, and auto-detected exercise sessions (runs, walks,
   rides, swims, rowing).
5. **Merge rules:**
   - Fitbit weight readings feed the existing body-weight chart (tag the source; manual entries win
     on the same day).
   - Heart rate is attached to a logged gym session when the times overlap (reuse
     `lib/heart-rate.js`).
   - Auto-detected cardio sessions show as "Import this run?" cards rather than being added
     silently.
6. A disconnect button that revokes the token and lets the user choose whether to delete
   imported data.

**Done when:** I connect my Google account and see my real steps, resting HR, weight and last
workout's heart rate in the app, and disconnecting works cleanly.

## Phase 4b: Apple Watch data without a native app

Apple Health data never leaves the iPhone unless an app on the phone sends it. Until Phase 9,
friends with an Apple Watch use **Health Auto Export** (a third-party iOS app; its REST API
automations need its paid Premium tier) to POST their data to our server. A free fallback is an
iOS Shortcuts personal automation using "Find Health Samples" + "Get Contents of URL", but test
whether it can read Health data while the phone is locked before relying on it.

Build:

1. An ingest endpoint, e.g. `POST /api/health/apple/ingest`, authenticated with a **per-user
   token** the user generates (and can revoke) in Settings → Connections. Never accept data
   without a token, and rate-limit it.
2. A parser for Health Auto Export's JSON format (metrics and workouts are documented in its
   GitHub wiki). Read the format docs first; don't guess field names.
3. Map it into the same normalised data as Phase 4 (`source: "apple"`): steps, active energy,
   resting HR, HR samples during workouts, sleep, weight, workouts. Idempotent: the same export
   sent twice must not create duplicates.
4. A setup screen with step-by-step instructions and the user's endpoint URL + token, ready to
   copy into the export app.
5. A "last received" timestamp, and a gentle warning if nothing has arrived for 2 days (iOS
   background limits mean these exports can be irregular).

**Done when:** a friend with an Apple Watch sets up the export once and their steps, workouts
and resting HR appear in the app and on the leaderboard alongside my Fitbit data.

## Phase 5: Progress tracker on real data

- Stats screen: new cards for steps, active minutes, resting HR trend, and sleep, with week/month/
  year ranges like the existing charts.
- Body weight: use Fitbit readings automatically, keep the goal line.
- Workout detail: heart-rate graph per session, average/max HR, time in zones.
- Feed real data into the recovery/fatigue model (`lib/recovery.js`) only behind a setting, with
  tests. For example, a poor-sleep or elevated-resting-HR day could flag lower readiness.
- Everything degrades gracefully for friends without a tracker: the cards just don't show.

## Phase 6: Cardio and custom sessions

The app already supports cardio exercises (time + speed logging), supersets, and timed sets.
Extend that rather than building a new system:

- Cardio fields per set: duration, distance, pace/speed, incline/resistance, optional target HR
  zone.
- **Interval blocks** (e.g. 8 × 1 min hard / 1 min easy) with a timer and a sound at each change.
- Session builder: mix strength blocks, supersets, cardio blocks and intervals in any order inside
  one routine, and save it as a template.
- Link a session's cardio block to the matching Fitbit-detected activity for real HR and distance.
- Cardio progression: let progression rules apply to distance, duration or pace (e.g. +5% distance
  per week), as a pure helper in `lib/progression.js` with tests.

## Phase 7: Friends, leaderboards and nudges

All profiles live on one server, so this is all server-side.

**Privacy model:** openGym's original design is "everyone's data stays their own". Keep that as
the default. Sharing is **opt-in per person and per metric**, and nobody sees another user's raw
log, only what they choose to share.

1. **Friends/group:** I create a group, friends join with an invite link. Accepting is mutual.
2. **Shared summary, not shared state:** when a user's state is saved, the server computes a
   small summary (workouts this week, streak, weekly volume, PRs this month, steps if connected)
   and stores it separately. Leaderboards read only those summaries, never other users'
   `state-<uid>.json`. Pure summary function with tests.
3. **Leaderboards:** weekly and monthly. Workouts done, streak, total volume, PR count, steps/
   active minutes, and **relative strength** (estimated 1RM ÷ body weight per lift, so it's fair
   across sizes). Each metric only includes people who opted into it.
4. **Nudges:** "Nudge" button on a friend's card sends them a push (reuse `push-messages.js` and
   the existing nudge tones: friendly, guilt trip, drill sergeant). Rate limit to one per friend
   per day, and a "mute nudges" setting.
5. **Activity feed + kudos:** "Emil finished Push Day, 2 PRs" with a reaction button. Opt-in.
6. **Weekly challenges** (later): e.g. "most sessions this week", with the winner shown on Home.

**Done when:** two test accounts can friend each other, see each other on the leaderboard, send
a nudge that arrives as a push on iPhone, and turning sharing off removes someone immediately.

## Phase 8: AI coach without paying for everyone

Keep the coach code, but **off by default**, with no shared paid key. Two supported paths:

- **Bring your own key per user:** a friend who wants the coach pastes their own Anthropic/OpenAI/
  Gemini key in their settings. Check how `api/coach/` stores keys today; make sure a per-user key
  is used only for that user and is stored sealed.
- **Local model on the Mac mini:** point the coach at Ollama through the existing
  "OpenAI-compatible endpoint" option (see `docs/AI_COACH.md`). Free for everyone, but slow on a
  CPU, so reviews run as background jobs and the result appears later.

Don't use my personal Claude subscription credential as a shared coach for other people.

Later: let the coach read the Fitbit data from Phase 4 (sleep, resting HR) when it reviews a week.

---

## Phase 9: Native iPhone app + Apple Watch app (optional, later)

Only if friends want to **log sets from their wrist** or see **live heart rate** during a workout.
The PWA can't do either; it needs the native app, which openGym already has (Capacitor shell
around the same web app, plus a native Swift Apple Watch app).

**Manual steps for me:** Apple Developer Program (99 USD a year), Xcode on my Mac, a new bundle
ID and app name, and **TestFlight** to distribute to friends (no public App Store listing).
TestFlight builds expire after 90 days, so plan a regular rebuild.

**License check first:** `NOTICE.md` grants an app-store exception for "the openGym mobile
application". Read whether it covers a fork, and if unclear, ask the author before distributing
through TestFlight. Keep the fork's source public either way.

Build:

1. Restore the iOS build (`npm run build:mobile`, `cap sync ios`), rebrand bundle ID, name,
   icons (from `design/`), and the watch app's name and colours to match the design tokens.
2. Point the app at our server by default (the onboarding already supports a custom server).
3. Turn on the existing Apple Health integration (`AppleHealthPlugin.swift`): read heart rate,
   workouts and weight natively. For native-app users this replaces the Phase 4b export; keep
   4b for anyone who stays on the PWA. Deduplicate by source so nobody is counted twice.
4. Apple Watch app: set logging, rest timer and **live HR per set** (already supported upstream).
   Test that new fields from Phases 6–7 (cardio blocks, intervals) either show on the watch or
   are safely ignored.
5. Push nudges through the native app too, without double notifications when someone also uses
   the PWA.

**Done when:** a friend installs via TestFlight, logs a full workout from the watch, and it shows
up in their history, on the leaderboard and with live HR in the session graph.

## Cleanup pass (after Phase 7)

- Delete the features that stayed hidden and weren't missed.
- Prune `MOBILE`-only code paths now that there's no native build.
- Remove docs that no longer apply, rewrite the README for this fork.
