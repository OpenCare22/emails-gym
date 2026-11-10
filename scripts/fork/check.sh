#!/bin/sh
# Every check the fork's tickets must pass, runnable in a team worktree.
# Links the main checkout's node_modules for the run and removes the links afterwards.
#   sh scripts/fork/check.sh          all checks
#   sh scripts/fork/check.sh quick    skip the two full test suites
set -u
MAIN=/Users/emilmladenov/Code/emails-gym
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT" || exit 1

LINKED=""
for d in . frontend api; do
  if [ -d "$d" ] && [ ! -e "$d/node_modules" ] && [ -d "$MAIN/$d/node_modules" ] && [ "$ROOT" != "$MAIN" ]; then
    ln -s "$MAIN/$d/node_modules" "$d/node_modules" && LINKED="$LINKED $d/node_modules"
  fi
done
cleanup() { for l in $LINKED; do [ -L "$l" ] && rm "$l"; done; }
trap cleanup EXIT INT TERM

FAILED=""
run() { name=$1; shift; echo "== $name"; if "$@"; then echo "== $name: ok"; else echo "== $name: FAILED"; FAILED="$FAILED $name"; fi; }

# Node 26 writes different PNG bytes than CI's Node 22, so the icon byte-comparison only runs on 22.
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
ICONS=""
[ "$NODE_MAJOR" != "22" ] && ICONS="--exclude scripts/app-icons.test.mjs"

if [ "${1:-}" != "quick" ]; then
  run api-tests sh -c 'cd api && npm test --silent'
  # --retry 1: media-sync.test.js can time out under full-suite load (docs/decisions.md).
  run frontend-tests sh -c "cd frontend && npx vitest run --retry 1 $ICONS"
fi
run library node scripts/library/build.mjs --check
run catalogue node scripts/catalogue/build.mjs --check
run coach-assets node scripts/build-coach-assets.mjs --check
run build sh -c 'cd frontend && npm run build --silent'

if [ -n "$FAILED" ]; then echo "FAILED:$FAILED"; exit 1; fi
echo "All checks passed."
