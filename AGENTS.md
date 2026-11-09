# AGENTS.md

This repo is **Email's Gym**, a personal fork of openGym by Duarte Santos. Read `CLAUDE.md` first
(it maps the codebase), then the fork plan in `docs/fork/PLAN.md`. Project memory lives in
`TASKS.md` and `docs/decisions.md`.

## Ground rules

- Keep `LICENSE` (AGPL-3.0) and `NOTICE.md`.
- Never add, edit, resize or open anything in `catalogue/media/` (licensed from Gym visual).
- Keep `frontend/ios/`, the `MOBILE` code paths, `WatchSettings.jsx`, `lib/watch-sync.js`,
  `lib/watch-relay.js`, `api/watch-relay.js`, `lib/health-sync.js`, `lib/health-read.js`,
  `lib/heart-rate.js`, `AppleHealthPlugin.swift`, Capacitor and `capacitor.config.json`. They are
  needed for the iPhone + Apple Watch app later.
- Respect "Code that exists twice on purpose" in `CLAUDE.md`: change both sides together.
- No new dependencies. Plain, human user-facing text, no em dashes. Match the existing style.
- Don't push, don't touch git remotes, don't edit `docs/fork/`.

## Team worktrees (Codex tickets)

Ticket worktrees have no `node_modules`; never run `npm install` or `npm ci` in one. Run every
check with:

```bash
sh scripts/fork/check.sh          # all checks (api + frontend suites, locales, strings, catalogue, coach assets, api docs, build)
sh scripts/fork/check.sh quick    # everything except the two test suites
```

It links the main checkout's `node_modules` for the run and removes the links when it exits.
For a single test file, link them yourself the same way, and remove the links before you finish.

Known flake: `src/lib/media-sync.test.js` › "signed in, evicts synced main files over the cap"
can time out (5 s) when the whole suite runs at once; `check.sh` retries failed tests once.

On this Mac's Node 26 (CI uses 22), `frontend/scripts/app-icons.test.mjs` fails because Node 26's
zlib writes different PNG bytes, so `check.sh` skips it unless Node is 22. Don't regenerate or edit
the icons to make it pass. Claude re-runs every ticket under Node 22 before merging.

In your result, list every check you ran with its pass/fail counts, and anything you couldn't run.
