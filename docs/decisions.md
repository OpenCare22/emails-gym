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
- **2026-11-10: Interval sessions fixed (library/corrections.json).** hybrid-4 week 8 drops to 3
  rounds (21 min) instead of 27 min of work in 22; conditioning-3's intervals change by rounds,
  not minutes: 2, 2, 3, 3, 4, 4, 4, 2 rounds of 2 min hard and 3 easy, with 6 min warm-up and 4
  cool-down (20 to 30 min, within 3 min of the source). The source file stays unchanged; the coach
  sees both versions in the review sheet. No program runs over its stated time once rest between
  exercises is counted.
- **2026-11-10: Known flaky API test.** `api/test/server-wrapped-push.test.js` ("Dec 1 from
  18:00") failed once under full-suite load during T-014's check (an opted-out user's push fired)
  and passed on 3 reruns and a full rerun. Rerun before suspecting a change; fix if it recurs.
- **2026-11-10: Google Health on the server, under /api/google-health.** The legacy Fitbit Web
  API was switched off on 2026-11-02. Each profile connects its own Google account (three
  read-only scopes); tokens are sealed per profile in DATA_DIR/health/, data kept 120 days there,
  not in the synced state. /api/health stays the server's health check. The Cloud project stays in
  Testing (100 users, connections expire every 7 days, a Reconnect button) because publishing
  restricted health scopes needs Google's verification and a security assessment. The web app
  stops showing the phone-only Apple Health card and "works with" list.
- **2026-11-10: Second flaky API test.** `api/test/server-origin-hint.test.js` ("a page on
  another site gets the same refusal") failed once under full-suite load in T-026's check and
  passed 3 times alone and in a full rerun. Same rule: rerun first, fix if it recurs.
- **2026-11-10: Two more load-sensitive frontend tests.** `store/useStore.mobile-remote.test.jsx`
  and `views/AdminCoach.test.jsx` failed once in a full Node 22 run during T-027 and passed 3
  times alone and in a full rerun. Rerun first; fix if they recur.
- **2026-11-10: Apple Watch through Health Auto Export (Phase 4b).** Friends POST from the iOS app
  (Premium) to /api/apple-health/ingest with a per-profile key (stored hashed). Data is merged with
  Google's (Google wins a day both have). Three metric names are not in its docs
  (resting_heart_rate, body_mass, apple_exercise_time); anything else unknown is listed on the
  setup card so the first real export shows what to add.
- **2026-11-11: Friends (Phase 7) built by Claude while Codex was at its limit.** api/social/: groups
  joined by invite link (12 people, 5 groups each, links last 14 days), sharing per group and per
  metric (all off until chosen; joining preselects Workouts and Streak), one summary per person
  (the only thing friends read), leaderboards, nudges in the friend's own tone (one a day per
  friend), a feed without weights or exercises plus kudos, and trophies (weekly winners per group
  in UTC weeks, milestones, six original card backgrounds). The week streak on the server is a
  hand copy of lib/streak.js with a parity test (add it to "code that exists twice"). On iPhone the
  install screen shows an invite's code, since the Home Screen app can't receive Safari's link.
  `api/test/nudge*.test.js` ("a crafted state costs one pass") failed once under load and passed
  on the rerun.
- **2026-11-11: Easing back in after a break, and "How did that feel?".** Spec
  docs/superpowers/specs/2026-11-11-return-and-feel-design.md (Emil approved). A break is at least 8
  days since you last did that exercise and at least 1.5 times your usual gap for it, so weekly
  splits are never eased. 8 to 14 days: same weight, one set fewer. 15 to 28: one set fewer at 90 %,
  then your old numbers held, then normal. Over 28: 80 %, 90 % with full sets, old numbers held,
  then normal. The ease-in starts from what you last lifted, rounded down to the exercise's own step
  (a 5 kg row goes 60 to 50 at 90 %). Eased sessions are stamped `entry.back` and are invisible to
  progression; a second miss on a rung ends the ramp (derived, never written to a saved workout).
  A break does not pause a programme; deload weeks are never eased further. "Use my usual plan" is
  per workout (`active.usualPlan`). Feel: an optional Easy · Good · Hard per exercise
  (`entry.feel`, or the last set's logged RIR). Hard repeats the session once, at most once in a
  row; two weight raises in a row that both felt Easy earn a double step, capped at 5 % upper body
  and 7 % lower body; a miss ignores feel. Sex and age are inputs to the break rule with the same
  values for everyone in v1. Not done: feel on the Watch, editing feel from History. Tests:
  `test-setup.js` turns easing off by default (older fixtures are dated early 2026); the break
  tests turn it on. Built by Codex (T-033, most of T-034) and Claude (the rest, while Codex was at
  its limit).
- **2026-11-11: Structured interval logger (Claude's design; Emil said "you figure it out").** A
  cardio entry can carry `target.intervals` = { warmup, hard, easy, rounds, cooldown, hardRpe? } in
  minutes, the library's own shape (lib/intervals.js). Program weeks now keep it (library-start,
  normalizeProgramme, programmeSlot, planEntry), so hybrid and conditioning sessions arrive
  structured; programs started before this only have the text note until restarted, or the plan
  can be set up by hand. Any cardio exercise shows "Set up intervals" (this workout, optionally
  the routine too). The timer card (components/IntervalCard.jsx) runs on wall-clock times on the
  entry (`entry.ivRun`), with Pause, Skip and Finish now, a beep in each segment's last 3 seconds
  and a chime and buzz at every change (cues only while the screen is on; no push per segment).
  The run logs on the cardio row as whole minutes plus `set.iv` with the rounds done, and History
  reads "25 min · 2 rounds of 2 min hard". Not done: the Watch, editing `iv` in History, interval
  progression (research D: add a round or a little hard time, not both).
- **2026-11-11: Two programs added, Build / Three Days and Home / Three Days.** The audit's P1.4 gaps
  (no 3-day muscle plan, no limited-equipment plan). Written by Claude from the methodology (B):
  three full-body days, 2 to 3 sets an exercise, 6 to 15 reps for compounds and 10 to 20 for
  accessories, 1 to 3 RIR, double progression; week 1 at +1 RIR, week 8 one set fewer at +1 RIR,
  the same shape as build-4. Home needs a pair of dumbbells and a flat bench (no floor press in the
  catalogue); seven dumbbell exercises were added to the source and exercise map (Bulgarian split
  squat, hip thrust, pullover, rear delt fly, hammer curl, lying triceps extension, two-arm row).
  Both are `needs_review` like the rest and are in COACH_REVIEW.md, whose intro now counts programs.
  The API suite failed once under load during this check and passed alone (844/844).
