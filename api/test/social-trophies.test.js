import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSocial } from '../social/index.js';
import { newMilestones, weekWinners, metricOf } from '../social/trophies.js';

test('milestones are reached once, and belong to their metric', () => {
  const s = { workoutsAll: 12, bestStreakWeeks: 5, prsAll: 1, strength: { squat: 1.6, bench: 0.8, deadlift: null } };
  const first = newMilestones(s, [], 'x').map(t => t.kind);
  assert.deepEqual(first.sort(), ['bench-0.75', 'records-1', 'squat-1', 'squat-1.5', 'streak-4', 'workouts-1', 'workouts-10'].sort());
  assert.deepEqual(newMilestones(s, first.map(kind => ({ kind })), 'x'), []);
  assert.equal(metricOf('squat-1.5'), 'strength');
  assert.equal(metricOf('week-volume'), 'volume');
});

test('a week’s winners: top value per shared metric, ties all win, zeros and unshared never', () => {
  const snap = { a: { workoutsWeek: 3, volumeWeekKg: 5000, stepsWeek: 0 }, b: { workoutsWeek: 3, volumeWeekKg: 9000 }, c: { workoutsWeek: 5 } };
  const shares = (uid, metric) => !(uid === 'c' && metric === 'workouts');
  const won = weekWinners(snap, shares, { groupId: 'g', week: '2026-11-02', at: 'x' }).map(w => [w.uid, w.trophy.kind]);
  assert.deepEqual(won.sort(), [['a', 'week-workouts'], ['b', 'week-volume'], ['b', 'week-workouts']].sort());
});

test('weeks are awarded once they end, and others see only what is shared with their group', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-social-'));
  let now = Date.parse('2026-11-11T12:00:00Z');
  const states = { a: { workouts: [{ d: '2026-11-10' }, { d: '2026-11-11' }] }, b: { workouts: [{ d: '2026-11-10' }], socialCard: 'stripes' } };
  const social = createSocial({ dataDir, now: () => now, readState: uid => states[uid], nameOf: uid => uid });
  const g = social.createGroup('a', 'G');
  social.join('b', g.invite.code);
  social.setSharing('a', g.id, { workouts: true });
  social.onStateWrite('a', states.a);
  social.onStateWrite('b', states.b);
  social.awardWeeks();
  assert.equal(social.trophies('a', { groupId: g.id }).trophies.filter(t => t.kind.startsWith('week-')).length, 0, 'the week is still on');
  now = Date.parse('2026-11-17T01:00:00Z');
  social.awardWeeks();
  const mine = social.trophies('a', { groupId: g.id }).trophies.map(t => t.kind);
  assert.ok(mine.includes('week-workouts'), 'a shared workouts and had the most');
  assert.ok(mine.includes('workouts-1'));
  const bSeenByA = social.trophies('a', { groupId: g.id, uid: 'b' });
  assert.deepEqual(bSeenByA.trophies, [], 'b shares nothing, so a sees none of b’s');
  assert.equal(bSeenByA.card, 'stripes');
  assert.ok(social.trophies('b', { groupId: g.id }).trophies.some(t => t.kind === 'workouts-1'), 'b sees their own');
  social.awardWeeks();
  assert.equal(social.trophies('a', { groupId: g.id }).trophies.filter(t => t.kind === 'week-workouts').length, 1, 'awarded once');
  social.removeUser('a');
  assert.throws(() => social.trophies('b', { groupId: g.id, uid: 'a' }), e => e.code === 'no-member');
});
