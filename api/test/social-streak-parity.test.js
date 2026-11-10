/* The server's week streak (social/streak.js) must equal the app's (frontend/src/lib/streak.js):
   friends see the number the person sees on their own Home. Both run on the same fixtures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streakOf } from '../social/streak.js';
import { streakInfo } from '../../frontend/src/lib/streak.js';

const day = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const plan = (start, weeks) => weeks.flatMap((on, i) => (on ? [{ d: day(start, 7 * i + 2) }] : []));

const fixtures = [
  ['none', { workouts: [] }, '2026-11-10'],
  ['this week only', { workouts: [{ d: '2026-11-10' }] }, '2026-11-10'],
  ['8 straight weeks', { workouts: plan('2026-09-14', [1, 1, 1, 1, 1, 1, 1, 1]) }, '2026-11-10'],
  ['a gap covered by a freeze', { workouts: plan('2026-08-31', [1, 1, 1, 1, 0, 1, 1, 1, 1, 1]) }, '2026-11-10'],
  ['two gaps, one freeze', { workouts: plan('2026-08-31', [1, 1, 1, 1, 0, 0, 1, 1, 1, 1]) }, '2026-11-10'],
  ['eight weeks then two gaps', { workouts: plan('2026-07-06', [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]) }, '2026-11-10'],
  ['Sunday weeks', { weekStart: 0, workouts: [{ d: '2026-11-08' }, { d: '2026-11-01' }, { d: '2026-10-25' }] }, '2026-11-10'],
  ['this week open, last week missed', { workouts: plan('2026-09-14', [1, 1, 1, 1, 1, 1, 1, 0]) }, '2026-11-10'],
  ['future and bad dates ignored', { workouts: [{ d: '2026-12-01' }, { d: 'x' }, null, { d: '2026-11-09' }] }, '2026-11-10'],
];

for (const [name, S, today] of fixtures) {
  test(`streak parity: ${name}`, () => {
    const app = streakInfo(S, today);
    assert.deepEqual(streakOf(S, today), { current: app.current, best: app.best });
  });
}
