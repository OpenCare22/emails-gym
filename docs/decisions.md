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
- **2026-11-09: English only.** Every other locale goes in Phase 1 (T-003); German is not kept.
- **2026-11-09: `mcp/` is deleted** (T-006). It only let Claude Desktop read one user's data
  folder; nothing in the app depends on it.
- **2026-11-09: In-app AI chat with each person's own API key is wanted.** That's the existing
  AI Coach chat, which today uses one admin-set key for everyone (per-user keys exist only in the
  phone app). Making the server-side Coach take a per-user key, stored sealed, is Phase 8.
- **2026-11-09: Hidden, not deleted (T-007):** progress photos, structural balance and importing
  from other apps, behind one list in `frontend/src/lib/fork-hidden.js` (delete an id there to bring
  it back). The audit log is off unless `AUDIT_LOG=1`. Review after a week or two of use.
- **2026-11-09: Phase 1 tickets T-003 to T-007 done by Claude, not Codex** (Codex was out of
  tokens). T-001 and T-002 were Codex's, reviewed and checked under Node 22 before merging.
- **2026-11-10: Temporary phone testing over Tailscale.** `tailscale serve --bg 8080` publishes the
  app at https://emils-macbook-air.tail4efe2e.ts.net (tailnet only), and `.env` has `RP_ID` /
  `ORIGIN` set to that name, so passkeys and push work on Emil's iPhone with Tailscale on.
  Friends can't reach it; the real address comes in Phase 3, and changing it means everyone
  registers a new passkey. To stop: `tailscale serve --https=443 off`, and put `.env` back to
  localhost for local-only use.
