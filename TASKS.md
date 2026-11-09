# TASKS

Plans: [docs/fork/PLAN.md](docs/fork/PLAN.md) (phases) and [docs/fork/DESIGN_PLAN.md](docs/fork/DESIGN_PLAN.md)
(Email's Gym design, lands in Phase 2). Decisions: [docs/decisions.md](docs/decisions.md).

## Where we left off

Phase 1 merged into main (local, not pushed). Phase 2 in progress on `phase-2/make-it-mine`
(Claude coding, Codex out of tokens): steps 1-3 of docs/fork/DESIGN_PLAN.md done and committed
(tokens + contrast test, branding + Inter + icons, four-tab navigation + Friends screen).
Next: step 4 (shared components: primary button off-white, light selected segment, cards) and
step 5 (Home redesign, active workout restyle, Today card with the Start button the tour points at).

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
- [ ] Step 4 shared components (primary button off-white, selected segment light, cards 16px)
- [ ] Step 5 screens: Home (greeting, week strip, Today card + Start, metric cards, weekly chart), workout, rest
- [ ] Step 6 checks: 375/390/430, light/dark, every accent, reduced motion, real iPhone install
- Later (Phase 9): rename "openGym" in frontend/ios Swift files and remove upstream app-icon assets

## Next

- Phase 2: Integrations' "Works with" note still says "Apple Health or Health Connect" (`frontend/src/views/Integrations.jsx`).
- Leftover on disk: `~/Code/emails-gym/mcp/node_modules` (untracked, ignored) can be deleted by hand.
- Phase 2: routine share links still point at upstream's `https://opengym.ch/r` (`frontend/src/lib/routine-link.js` LINK_BASE). Point them at our own server's `/#/r/<payload>`.
- Phase 8 note: per-user API keys for the in-app Coach chat (see docs/decisions.md).
- Design assets for Phase 2 (`design/` handoff, icons, renders) still need to be added to the repo.
