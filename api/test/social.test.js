import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSocial, MAX_MEMBERS, MAX_GROUPS } from '../social/index.js';
import { socialRoutes } from '../social/routes.js';
import { NUDGE_LINES } from '../social/nudge-lines.js';

const NOW = Date.parse('2026-11-11T12:00:00Z');
function setup() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-social-'));
  let now = NOW;
  const states = { a: { workouts: [{ d: '2026-11-10' }] }, b: { workouts: [] } };
  const social = createSocial({ dataDir, now: () => now, readState: uid => states[uid] || { workouts: [] }, nameOf: uid => ({ a: 'Emil', b: 'Dana' })[uid] || uid });
  return { social, dataDir, states, tick: ms => { now += ms; } };
}
const rejects = (fn, code) => assert.throws(fn, e => e.code === code);

test('a group starts with its owner and a 14-day invite; a friend joins with it', () => {
  const { social } = setup();
  const g = social.createGroup('a', '  Gym   lads ');
  assert.equal(g.name, 'Gym lads');
  assert.equal(g.owner, true);
  assert.equal(g.invite.code.length, 16);
  assert.equal(Date.parse(g.invite.expiresAt) - NOW, 14 * 864e5);
  assert.deepEqual(social.peek(g.invite.code), { name: 'Gym lads', members: 1, owner: 'Emil' });
  const joined = social.join('b', g.invite.code);
  assert.equal(joined.owner, false);
  assert.equal(joined.invite, undefined, 'only the owner sees the invite');
  assert.deepEqual(joined.members.map(m => [m.name, m.self]), [['Emil', false], ['Dana', true]]);
  assert.equal(social.join('b', g.invite.code).members.length, 2, 'joining twice changes nothing');
});

test('invites expire, can be replaced or turned off, and wrong codes are refused', () => {
  const { social, tick } = setup();
  const g = social.createGroup('a', 'G');
  rejects(() => social.join('b', 'nope'), 'invite-invalid');
  const fresh = social.invite('a', g.id);
  rejects(() => social.join('b', g.invite.code), 'invite-invalid');
  rejects(() => social.invite('b', g.id), 'no-group');
  social.invite('a', g.id, { off: true });
  rejects(() => social.join('b', fresh.code), 'invite-invalid');
  const later = social.invite('a', g.id);
  tick(15 * 864e5);
  rejects(() => social.join('b', later.code), 'invite-invalid');
});

test('groups are capped in size and per person, and joins are rate limited', () => {
  const { social } = setup();
  const g = social.createGroup('a', 'G');
  for (let i = 1; i < MAX_MEMBERS; i++) social.join('u' + i, g.invite.code);
  rejects(() => social.join('late', g.invite.code), 'full');
  for (let i = 1; i < MAX_GROUPS; i++) social.createGroup('a', 'G' + i);
  rejects(() => social.createGroup('a', 'one too many'), 'too-many-groups');
  for (let i = 0; i < 10; i++) { try { social.join('x', 'bad') } catch { /* counted */ } }
  rejects(() => social.join('x', 'bad'), 'slow-down');
});

test('sharing is off until chosen, only known keys, and only for your own groups', () => {
  const { social } = setup();
  const g = social.createGroup('a', 'G');
  social.join('b', g.invite.code);
  assert.equal(Object.values(social.describe('b').sharing[g.id]).some(Boolean), false);
  const s = social.setSharing('b', g.id, { workouts: true, streak: true, weightLog: true, prs: 'yes' });
  assert.deepEqual(Object.entries(s).filter(([, v]) => v).map(([k]) => k), ['workouts', 'streak']);
  assert.equal('weightLog' in s, false);
  rejects(() => social.setSharing('c', g.id, { workouts: true }), 'no-group');
  assert.equal(social.describe('b').nudges, true);
  social.setNudges('b', false);
  assert.equal(social.nudgesOn('b'), false);
});

test('leaving, removing and an owner leaving', () => {
  const { social } = setup();
  const g = social.createGroup('a', 'G');
  social.join('b', g.invite.code);
  social.join('c', g.invite.code);
  social.setSharing('c', g.id, { workouts: true });
  rejects(() => social.remove('b', g.id, 'c'), 'not-owner');
  social.remove('a', g.id, 'c');
  assert.equal(social.describe('c').groups.length, 0);
  assert.equal(social.sharingOf('c', g.id).workouts, false, 'a removed member’s sharing is gone');
  social.leave('a', g.id);
  assert.equal(social.describe('b').groups[0].owner, true, 'the longest-standing member takes over');
  social.leave('b', g.id);
  assert.equal(social.group(g.id), null, 'an empty group is deleted');
});

test('summaries are kept only for people in a group, refreshed on save, and removed with the profile', () => {
  const { social, dataDir, states } = setup();
  social.onStateWrite('a', states.a);
  assert.equal(social.summary('a'), null, 'not in a group: nothing is worked out');
  const g = social.createGroup('a', 'G');
  assert.equal(social.summary('a').workoutsAll, 1);
  social.onStateWrite('a', { workouts: [{ d: '2026-11-10' }, { d: '2026-11-11' }] });
  assert.equal(social.summary('a').workoutsAll, 2);
  social.join('b', g.invite.code);
  social.removeUser('a');
  assert.equal(social.summary('a'), null);
  assert.equal(fs.existsSync(path.join(dataDir, 'social', 'summaries', 'a.json')), false);
  assert.equal(social.describe('b').groups[0].owner, true);
  assert.equal((fs.statSync(path.join(dataDir, 'social', 'social.json')).mode & 0o777), 0o600);
});

test('the routes need a session and answer refusals as { error, code }', async () => {
  const { social } = setup();
  let user = null, out;
  const body = {};
  const routes = socialRoutes({ social, readSession: () => user, readBody: async () => body, json: (_, status, b) => { out = { status, b }; } });
  await routes['GET /api/social']({}, {});
  assert.equal(out.status, 401);
  user = { id: 'a' };
  body.name = 'Crew';
  await routes['POST /api/social/groups']({}, {});
  assert.equal(out.b.group.name, 'Crew');
  body.code = 'wrong';
  await routes['POST /api/social/join']({}, {});
  assert.deepEqual([out.status, out.b.code], [404, 'invite-invalid']);
});

test('leaderboards show only who shares the metric with this group, you always, ties sharing a rank', () => {
  const { social, states } = setup();
  states.c = { workouts: [{ d: '2026-11-10' }] };
  states.d = { workouts: [{ d: '2026-11-09' }, { d: '2026-11-10' }] };
  const g = social.createGroup('a', 'G');
  for (const u of ['b', 'c', 'd']) social.join(u, g.invite.code);
  social.setSharing('c', g.id, { workouts: true });
  social.setSharing('d', g.id, { workouts: true });
  social.setSharing('b', g.id, { streak: true });
  const board = social.leaderboard('a', { groupId: g.id, metric: 'workouts', range: 'week' });
  assert.deepEqual(board.rows.map(r => [r.uid, r.value, r.rank, r.self]), [['d', 2, 1, false], ['c', 1, 2, false], ['a', 1, 2, true]]);
  assert.equal(board.rows.find(r => r.self).shared, false);
  assert.equal(board.rows.some(r => r.uid === 'b'), false, 'b shares streak, not workouts');
  const streak = social.leaderboard('b', { groupId: g.id, metric: 'streak' });
  assert.equal(streak.range, 'current');
  assert.ok('second' in streak.rows[0]);
  assert.throws(() => social.leaderboard('a', { groupId: g.id, metric: 'weight' }), e => e.code === 'metric');
  assert.throws(() => social.leaderboard('zz', { groupId: g.id }), e => e.code === 'no-group');
  // someone sharing a metric with no value yet is left out
  social.setSharing('b', g.id, { steps: true });
  assert.deepEqual(social.leaderboard('a', { groupId: g.id, metric: 'steps' }).rows.map(r => r.uid), ['a']);
});

test('nudges: same group only, one a day per friend, opted-out friends refused, in their tone', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eg-social-'));
  let now = NOW;
  const pushes = [];
  const states = { a: { workouts: [] }, b: { workouts: [], reminder: { tone: 'drill' } }, c: { workouts: [] }, z: { workouts: [] } };
  const social = createSocial({ dataDir, now: () => now, readState: uid => states[uid], nameOf: uid => ({ a: 'Emil Mladenov', b: 'Dana' })[uid] || uid,
    sendPush: async (uid, p) => { pushes.push([uid, p]); }, hasPush: uid => uid !== 'c' });
  const g = social.createGroup('a', 'G');
  social.join('b', g.invite.code);
  social.join('c', g.invite.code);
  social.onStateWrite('b', states.b);
  assert.deepEqual(await social.nudge('a', { groupId: g.id, to: 'b' }), { sent: true });
  assert.equal(pushes[0][0], 'b');
  assert.match(pushes[0][1].body, /Emil/);
  assert.ok(!/Mladenov/.test(pushes[0][1].body), 'first name only');
  assert.ok(NUDGE_LINES.drill.some(l => l.replace('{name}', 'Emil') === pushes[0][1].body), 'a line in Dana\u2019s own tone (drill)');
  await assert.rejects(social.nudge('a', { groupId: g.id, to: 'b' }), e => e.code === 'already-nudged');
  assert.equal(social.leaderboard('a', { groupId: g.id }).rows.length >= 1, true);
  assert.deepEqual(await social.nudge('a', { groupId: g.id, to: 'c' }), { sent: false }, 'no notifications: not sent, still counted');
  await assert.rejects(social.nudge('a', { groupId: g.id, to: 'z' }), e => e.code === 'no-member');
  await assert.rejects(social.nudge('a', { groupId: g.id, to: 'a' }), e => e.code === 'no-member');
  social.setNudges('b', false);
  now += 864e5;
  await assert.rejects(social.nudge('a', { groupId: g.id, to: 'b' }), e => e.code === 'nudges-off');
  social.setNudges('b', true);
  assert.deepEqual(await social.nudge('a', { groupId: g.id, to: 'b' }), { sent: true }, 'a new day');
});

test('a nudged friend shows as nudged on the board until the sender’s next day', async () => {
  const { social, states } = setup();
  states.b = { workouts: [{ d: '2026-11-10' }] };
  const g = social.createGroup('a', 'G');
  social.join('b', g.invite.code);
  social.setSharing('b', g.id, { workouts: true });
  await social.nudge('a', { groupId: g.id, to: 'b' });
  assert.equal(social.leaderboard('a', { groupId: g.id }).rows.find(r => r.uid === 'b').nudged, true);
});
