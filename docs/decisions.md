# Decisions

- **2026-11-09: Fork lives at github.com/OpenCare22/emails-gym, public.** The AGPL requires the
  source to be public once friends use it over the network. Upstream stays as the `upstream` remote.
- **2026-11-09: Fork plans live in `docs/fork/`,** not the repo root, so they don't clash with
  upstream files when merging from upstream.
- **2026-11-09: Codex writes the code from Phase 1 on.** Claude writes `.team/tickets/`, reviews,
  verifies and merges, to save tokens.
- **2026-11-09: Baseline tests run under Node 22 in a container** (CI and the images use 22; the
  Mac has Node 26). One frontend test (`media-sync.test.js`, eviction over the cap) times out under
  full-suite load and passes alone; treat it as a known flake, not a regression.
