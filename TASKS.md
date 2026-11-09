# TASKS

Plans: [docs/fork/PLAN.md](docs/fork/PLAN.md) (phases) and [docs/fork/DESIGN_PLAN.md](docs/fork/DESIGN_PLAN.md)
(Email's Gym design, lands in Phase 2). Decisions: [docs/decisions.md](docs/decisions.md).

## Where we left off

Phase 0 on branch `phase-0/baseline`. Baseline recorded in PLAN.md (all green apart from one
known timeout flake). Stack runs with `docker compose up -d --build` on http://localhost:8080.

## Phase 0: Fork, run, baseline

- [x] Fork to github.com/OpenCare22/emails-gym (public), clone to ~/Code/emails-gym, `upstream` remote set
- [x] `.env` from `.env.example`
- [x] Baseline of every suite and CI check under Node 22
- [x] `docker compose up -d --build` runs, web and api healthy
- [x] Hand check (Emil, 2026-11-09): profile, fake workout, sync from two browsers all fine

## Next

- Phase 1 (strip): written as `.team/tickets/` for Codex, one ticket per row of the PLAN.md table,
  each with its own commit and a test run. Claude reviews, verifies and merges.
- Design assets for Phase 2 (`design/` handoff, icons, renders) still need to be added to the repo.
