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
- **2026-11-10 (ended the same day): Temporary phone testing over Tailscale.** `tailscale serve --bg 8080` publishes the
  app at https://emils-macbook-air.tail4efe2e.ts.net (tailnet only), and `.env` has `RP_ID` /
  `ORIGIN` set to that name, so passkeys and push work on Emil's iPhone with Tailscale on.
  Friends can't reach it; the real address comes in Phase 3, and changing it means everyone
  registers a new passkey. To stop: `tailscale serve --https=443 off`, and put `.env` back to
  localhost for local-only use.
- **2026-11-10: The address is https://emailsgym.com (the apex).** Bought on Cloudflare Registrar
  (auto-renew on, expires 2027-11-10), DNS on Cloudflare. `RP_ID=emailsgym.com`,
  `ORIGIN=https://emailsgym.com`. Passkeys are bound to it: never change it. Hosting: Hetzner
  CX22 VPS reached through a Cloudflare Tunnel, until the Mac mini; moving machines keeps the
  address.
- **2026-11-10: Live.** emailsgym.com runs on a Hetzner CX23 behind a Cloudflare Tunnel, port
  8080 bound to localhost (Docker would otherwise open it past ufw). Emil's profile is the admin;
  then INVITE_ONLY=1. Tailscale serve turned off, the Mac's .env back to localhost.
- **2026-11-10: Workout library builds on routines and programmes.** Emil's master plan
  (docs/emails-gym-planning/) asks for workouts and multi-week programs by three routes. The
  audit found the app already has most of the model (routines, programmes, timed holds, per-side,
  rep ranges, RIR/RPE, starter plans, plan import), so the library extends those instead of a
  second tracker. The research programs stay draft until someone qualified reviews them. First
  step: T-014, programme weeks that change sets and RIR.
- **2026-11-10: Emil's coach friend reviews the library.** A certified coach and nutritionist
  reviews each program from a generated review sheet; only programs marked approved in
  library/review.json (reviewer, date, exact version, no blockers) are shown to everyone. Others
  are visible to admins only, labelled "Not reviewed yet". Tailoring is a fixed-rule questionnaire
  (hard filters, then a versioned score, up to three matches with reasons, or no match); a health
  answer of yes suggests seeing a professional instead of a program. Exercise mapping chosen by
  Claude in library/exercise-map.json, for the coach to confirm. Progression keeps the app's
  derived, editable targets (the audit's recommendation; Emil hasn't objected).
- **2026-11-10: All programs visible before review.** Emil: friends can use every program now; the
  coach's review adds the approved label instead of gating them. Unreviewed ones say "Not reviewed
  by a coach yet"; known problems (hybrid-4 and conditioning-3 intervals) are listed on the program.
