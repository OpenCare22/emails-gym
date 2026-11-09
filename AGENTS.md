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

Ticket worktrees have no `node_modules`. Before running any command, link the main checkout's
installs (never run `npm install` or `npm ci` in a worktree):

```bash
for d in . frontend api mcp; do [ -d "$d" ] && [ ! -e "$d/node_modules" ] && ln -s "/Users/emilmladenov/Code/emails-gym/$d/node_modules" "$d/node_modules"; done
```

Skip `mcp` if the ticket deleted it. Remove the symlinks before you finish, so they are not part
of the diff.

## Checks

```bash
cd frontend && npx vitest run            # whole frontend suite
cd api && npm test
cd frontend && node scripts/check-locales.mjs && node scripts/check-source-strings.mjs --strict
node scripts/catalogue/build.mjs --check
node scripts/build-coach-assets.mjs --check
node scripts/build-api-docs.mjs --check
cd frontend && npm run build
```

Known flake: `src/lib/media-sync.test.js` › "signed in, evicts synced main files over the cap"
can time out (5 s) when the whole suite runs at once. If it is the only failure, rerun that file
alone; if it passes, the suite counts as green. Say so in your result.

On this Mac's Node 26 (CI uses 22), the two tests in `frontend/scripts/app-icons.test.mjs` fail
because Node 26's zlib writes different PNG bytes. That is expected: don't regenerate or edit the
icons to make them pass. Claude re-runs every ticket under Node 22 before merging.

In your result, list every check you ran with its pass/fail counts, and anything you couldn't run.
