# TASKS

Plans: [docs/fork/PLAN.md](docs/fork/PLAN.md) (phases) and [docs/fork/DESIGN_PLAN.md](docs/fork/DESIGN_PLAN.md)
(Email's Gym design, lands in Phase 2). Decisions: [docs/decisions.md](docs/decisions.md).

## Where we left off

Live at https://emailsgym.com (Phase 3, 2026-11-10): Hetzner CX23 + Cloudflare Tunnel, invite-only,
nightly data backups. Runbook: docs/fork/DEPLOY.md. Emil's profile "Email" is the admin.
Done 2026-11-10 and deployed: swipe to delete in History with Undo (T-012), Add to Home Screen
required on iPhone/iPad (T-013), programme weeks with sets/RIR/cardio minutes/notes (T-014), the
program library with checks and the coach's review sheet (T-015), Programs browse/detail/start
(T-016). Then Build my plan replaced T-017's matcher: EG Plan Model v1 builds a personal 8-week plan
from the whole catalogue (docs/superpowers/specs/2026-11-10-plan-builder-design.md; lib/exercise-index,
plan-person, plan-model, plan-build; views/PlanBuild). Coach reviews docs/emails-gym-planning/MODEL_REVIEW.md
too. Open: the coach friend reviews
docs/emails-gym-planning/COACH_REVIEW.md and MODEL_REVIEW.md, approvals go in library/review.json; a friend's first
sign-up + test push (Phase 3 done-check); then return-after-a-break and RIR-aware progression
(research D), a structured interval logger, more programs (3-day muscle, home/dumbbell); nutrition and
supplements after Emil's research (body details already saved in S.body).

## Phase 0: Fork, run, baseline

- [x] Fork to github.com/OpenCare22/emails-gym (public), clone to ~/Code/emails-gym, `upstream` remote set
- [x] `.env` from `.env.example`
- [x] Baseline of every suite and CI check under Node 22
- [x] `docker compose up -d --build` runs, web and api healthy
- [x] Hand check (Emil, 2026-11-09): profile, fake workout, sync from two browsers all fine

## Phase 1: Strip (branch `phase-1/strip`, Codex tickets, merged one at a time)

- [x] T-001 Android, Wear OS, Health Connect (merged 4f80b8ee8; ~68 dead `android` platform checks left for the cleanup pass)
- [ ] T-002 Garmin and Zepp
- [x] T-003 English only (build 28.9 MB → 6.9 MB; picker hidden, saved languages load as English)
- [x] T-004 Helm, Kubernetes, Nix, Cloudflare, fastlane, website (also the API docs page generator and the root js-yaml package)
- [x] T-005 Upstream overhead (GitLab, CLA, Renovate, roadmap, iOS CI; also docker-publish, release-check, FUNDING, dependabot)
- [x] T-006 mcp/ (also log-workout.js and the MCP card in Integrations)
- [x] T-007 Hide progress photos, structural balance, data imports (one switch: `frontend/src/lib/fork-hidden.js`), audit log off by default (`AUDIT_LOG=1` turns it on). Also hides the Health Connect card. Decide after a week or two of use: delete or restore.

## Phase 2: Make it mine (branch `phase-2/make-it-mine`)

- [x] Step 1 tokens: handoff colours on the existing theme, sage/blue/terracotta/lavender, contrast test
- [x] Step 2 branding: Email’s Gym everywhere visible, slab E icons/boot/print/share, Inter bundled, CSP hash
- [x] Step 3 navigation: Home · Workouts · Progress · Friends, Resume pill, Friends empty state (fork-flags.js)
- [x] Step 4 shared components: off-white primary buttons, pill segments (selected off-white); Start button back in the tab bar's middle (Emil asked)
- [x] Step 5 Home: brand header, greeting + training days, Today card with round Start, Steps/Resting HR Not connected, weekly chart
- [x] Step 5 workout screen (Codex T-008, T-009): Focus view is the default, Finish/Discard in the ⋯ menu, Focus restyled to the render (big steppers, Complete set, Last time hint, Undo toast, rest ring card). Checked in the browser 2026-11-10.
- [x] Step 6 checks in the browser: no overflow at 375/390/430, light + dark, reduced motion, focus rings; fixes in T-010 (44 px squares, switch names, light boot) and T-011 (44 px tall controls)
- [x] Step 6 on Emil's iPhone over Tailscale (2026-11-10): icon, launch screen, status bar and push all fine. iOS's top-edge blur caught the titles: pages now start 20px under the status bar when installed (--top-clear); Home's doubled top gap fixed. Confirmed on the phone.
- Later (Phase 9): rename "openGym" in frontend/ios Swift files and remove upstream app-icon assets

## Next

- T-012 (Codex): swipe a History row to delete a workout, with Undo (Emil, 2026-11-10).
- Phase 3: [x] live at https://emailsgym.com, [x] invite-only, guests off, [x] nightly backups,
  [x] main pushed to GitHub, [ ] T-013: require Add to Home Screen on iPhone/iPad, with an App Store note (Codex, after 14:35),
  [ ] a friend signs up and gets a test push.
- Phase 3b (new): workout and programme library (docs/fork/PLAN.md).
- Phase 7 (extended): trophies, cabinet, unlockables from standings.
- Phase 2: Integrations' "Works with" note still says "Apple Health or Health Connect" (`frontend/src/views/Integrations.jsx`).
- Leftover on disk: `~/Code/emails-gym/mcp/node_modules` (untracked, ignored) can be deleted by hand.
- Phase 2: routine share links still point at upstream's `https://opengym.ch/r` (`frontend/src/lib/routine-link.js` LINK_BASE). Point them at our own server's `/#/r/<payload>`.
- Phase 8 note: per-user API keys for the in-app Coach chat (see docs/decisions.md).
- Design assets for Phase 2 (`design/` handoff, icons, renders) still need to be added to the repo.
