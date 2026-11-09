# TASKS

Plans: [docs/fork/PLAN.md](docs/fork/PLAN.md) (phases) and [docs/fork/DESIGN_PLAN.md](docs/fork/DESIGN_PLAN.md)
(Email's Gym design, lands in Phase 2). Decisions: [docs/decisions.md](docs/decisions.md).

## Where we left off

Phase 0 done (`phase-0/baseline`). Phase 1 in progress on `phase-1/strip`. Baseline recorded in PLAN.md (all green apart from one
known timeout flake). Stack runs with `docker compose up -d --build` on http://localhost:8080.

## Phase 0: Fork, run, baseline

- [x] Fork to github.com/OpenCare22/emails-gym (public), clone to ~/Code/emails-gym, `upstream` remote set
- [x] `.env` from `.env.example`
- [x] Baseline of every suite and CI check under Node 22
- [x] `docker compose up -d --build` runs, web and api healthy
- [x] Hand check (Emil, 2026-11-09): profile, fake workout, sync from two browsers all fine

## Phase 1: Strip (branch `phase-1/strip`, Codex tickets, merged one at a time)

- [x] T-001 Android, Wear OS, Health Connect (merged 4f80b8ee8; ~68 dead `android` platform checks left for the cleanup pass)
- [ ] T-002 Garmin and Zepp
- [ ] T-003 English only
- [ ] T-004 Helm, Kubernetes, Nix, Cloudflare, fastlane, website
- [x] T-005 Upstream overhead (GitLab, CLA, Renovate, roadmap, iOS CI; also docker-publish, release-check, FUNDING, dependabot)
- [x] T-006 mcp/ (also log-workout.js and the MCP card in Integrations)
- [ ] T-007 Hide progress photos, structural balance, data imports, audit logging

## Next

- Phase 8 note: per-user API keys for the in-app Coach chat (see docs/decisions.md).
- Design assets for Phase 2 (`design/` handoff, icons, renders) still need to be added to the repo.
