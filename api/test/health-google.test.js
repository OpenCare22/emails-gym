import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHealth } from '../health/index.js';
import { stepsByDay, activeMinutesByDay, KEEP_DAYS, restingHrByDay, sleepByDay, weights, exercises, mergeData } from '../health/data.js';
import { healthRoutes } from '../health/routes.js';
import { SCOPES } from '../health/google.js';

const ENV = { GOOGLE_HEALTH_CLIENT_ID: 'cid', GOOGLE_HEALTH_CLIENT_SECRET: 'csecret' };
const NOW = Date.parse('2026-11-10T12:00:00Z');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eg-health-'));
const civil = (y, m, d) => ({ date: { year: y, month: m, day: d } });

// A fake Google: token, identity, revoke and the six data reads, each call recorded.
function fakeGoogle({ refreshFails = false } = {}) {
  const calls = [];
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const body = init.body ? (init.headers?.['Content-Type']?.includes('json') ? JSON.parse(init.body) : Object.fromEntries(new URLSearchParams(init.body))) : null;
    calls.push({ url: u, method: init.method || 'GET', body, auth: init.headers?.Authorization });
    if (u.host === 'oauth2.googleapis.com' && u.pathname === '/token') {
      if (body.grant_type === 'refresh_token' && refreshFails) return reply(400, { error: 'invalid_grant' });
      return reply(200, { access_token: 'acc-' + calls.length, expires_in: 3600, refresh_token: body.grant_type === 'authorization_code' ? 'ref-1' : undefined, scope: SCOPES.join(' ') });
    }
    if (u.pathname === '/revoke') return reply(200, {});
    if (u.pathname === '/v4/users/me/identity') return reply(200, { healthUserId: '42' });
    if (u.pathname.endsWith('/active-minutes/dataPoints:dailyRollUp')) return reply(200, { rollupDataPoints: [{ civilStartTime: civil(2026, 11, 10), activeMinutes: { activeMinutesRollupByActivityLevel: [{ activityLevel: 'LIGHT', activeMinutesSum: '90' }, { activityLevel: 'MODERATE', activeMinutesSum: '20' }, { activityLevel: 'VIGOROUS', activeMinutesSum: '12' }] } }] });
    if (u.pathname.endsWith('/steps/dataPoints:dailyRollUp')) return reply(200, { rollupDataPoints: [{ civilStartTime: civil(2026, 11, 9), steps: { countSum: '8123' } }, { civilStartTime: civil(2026, 11, 10), steps: { countSum: '2001' } }] });
    if (u.pathname.endsWith('/daily-resting-heart-rate/dataPoints')) return reply(200, { dataPoints: [{ dailyRestingHeartRate: { date: { year: 2026, month: 11, day: 10 }, beatsPerMinute: '58' } }], nextPageToken: '' });
    if (u.pathname.endsWith('/sleep/dataPoints')) return reply(200, { dataPoints: [{ sleep: { interval: { civilEndTime: civil(2026, 11, 10) }, summary: { minutesAsleep: '421' } } }] });
    if (u.pathname.endsWith('/heart-rate/dataPoints')) {
      const second = u.searchParams.get('pageToken') === 'hr2';
      return reply(200, { dataPoints: [{ heartRate: { beatsPerMinute: second ? '110' : '130', sampleTime: { physicalTime: second ? '2026-11-10T10:00:00Z' : '2026-11-10T10:30:00Z' } } }], ...(second ? {} : { nextPageToken: 'hr2' }) });
    }
    if (u.pathname.endsWith('/weight/dataPoints')) {
      // Two pages, to prove the page token is followed.
      if (!u.searchParams.get('pageToken')) return reply(200, { dataPoints: [{ name: 'users/42/dataTypes/weight/dataPoints/w1', weight: { weightGrams: 75400, sampleTime: { physicalTime: '2026-11-09T06:30:00Z', civilTime: civil(2026, 11, 9) } } }], nextPageToken: 'p2' });
      return reply(200, { dataPoints: [{ name: 'users/42/dataTypes/weight/dataPoints/w2', weight: { weightGrams: 75100, sampleTime: { physicalTime: '2026-11-10T06:30:00Z', civilTime: civil(2026, 11, 10) } } }] });
    }
    if (u.pathname.endsWith('/exercise/dataPoints')) return reply(200, { dataPoints: [{ name: 'x/e1', exercise: { exerciseType: 'RUNNING', displayName: 'Run', interval: { startTime: '2026-11-09T17:00:00Z', endTime: '2026-11-09T17:31:00Z', civilStartTime: civil(2026, 11, 9) }, metricsSummary: { averageHeartRateBeatsPerMinute: '151', caloriesKcal: 312.4, distanceMillimeters: 5230000, steps: '4800' } } }] });
    return reply(404, { error: { message: 'unexpected ' + u.pathname } });
  };
  return { fetch, calls };
}

function setup(opts) {
  const dataDir = tmp(), g = fakeGoogle(opts);
  let now = NOW;
  const health = createHealth({ dataDir, secret: 'test-secret-0123456789', origin: 'https://emailsgym.com', env: ENV, fetch: g.fetch, now: () => now });
  return { health, g, dataDir, tick: ms => { now += ms; } };
}

test('normalises the Google Health API’s own shapes', () => {
  assert.deepEqual(stepsByDay([{ civilStartTime: civil(2026, 1, 2), steps: { countSum: '40' } }]), { '2026-01-02': 40 });
  assert.deepEqual(restingHrByDay([{ dailyRestingHeartRate: { date: { year: 2026, month: 1, day: 2 }, beatsPerMinute: '61' } }]), { '2026-01-02': 61 });
  assert.deepEqual(sleepByDay([{ sleep: { interval: { civilEndTime: civil(2026, 1, 2) }, summary: { minutesAsleep: '400' } } }, { sleep: { interval: { civilEndTime: civil(2026, 1, 2) }, summary: { minutesAsleep: '20' } } }]), { '2026-01-02': 420 });
  assert.deepEqual(weights([{ name: 'a/w', weight: { weightGrams: 80250, sampleTime: { physicalTime: '2026-01-02T07:00:00Z', civilTime: civil(2026, 1, 2) } } }]), [{ id: 'a/w', at: '2026-01-02T07:00:00Z', d: '2026-01-02', kg: 80.25 }]);
  const [run] = exercises([{ name: 'e', exercise: { exerciseType: 'RUNNING', displayName: 'Run', interval: { startTime: '2026-01-02T07:00:00Z', endTime: '2026-01-02T07:45:00Z' }, metricsSummary: { distanceMillimeters: 10000000 } } }]);
  assert.deepEqual([run.minutes, run.distanceKm, run.d], [45, 10, '2026-01-02']);
  assert.deepEqual(weights([{ weight: {} }]), []);
});

test('merging keeps 400 days, replaces a day and dedupes by id', () => {
  const old = { steps: { '2025-01-01': 1, '2026-11-09': 5 }, weight: [{ id: 'a', d: '2026-11-01', at: '2026-11-01T00:00:00Z', kg: 80 }] };
  const m = mergeData(old, { steps: { '2026-11-09': 8000 }, weight: [{ id: 'a', d: '2026-11-01', at: '2026-11-01T00:00:00Z', kg: 79 }] }, '2026-11-10');
  assert.deepEqual(m.steps, { '2026-11-09': 8000 });
  assert.deepEqual(m.weight.map(w => w.kg), [79]);
});

test('is off and says nothing without the Google client id and secret', () => {
  const h = createHealth({ dataDir: tmp(), secret: 'test-secret-0123456789', origin: 'https://x', env: {} });
  assert.equal(h.on, false);
  assert.equal(h.publicConfig(), null);
  assert.deepEqual(h.describe('u1'), { available: false, connected: false });
});

test('asks Google for the three read-only scopes, offline, with a signed state for this profile', () => {
  const { health } = setup();
  const url = new URL(health.authorizeUrl('u1'));
  assert.equal(url.host, 'accounts.google.com');
  assert.equal(url.searchParams.get('scope'), SCOPES.join(' '));
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://emailsgym.com/api/google-health/callback');
  assert.equal(health._test.readState(url.searchParams.get('state')), 'u1');
  assert.equal(health._test.readState(url.searchParams.get('state') + 'x'), null);
});

test('connects, seals the tokens, pulls 30 days, and serves the data', async () => {
  const { health, g, dataDir } = setup();
  const state = new URL(health.authorizeUrl('u1')).searchParams.get('state');
  await health.connectCallback('u1', { code: 'the-code', state });
  const raw = fs.readFileSync(path.join(dataDir, 'health', 'u1.json'), 'utf8');
  assert.ok(!raw.includes('ref-1'), 'the refresh token is never stored in the clear');
  assert.equal((fs.statSync(path.join(dataDir, 'health', 'u1.json')).mode & 0o777), 0o600);
  const d = health.describe('u1');
  assert.equal(d.connected, true);
  assert.equal(d.status, 'ok');
  assert.deepEqual(d.data.steps, { '2026-11-09': 8123, '2026-11-10': 2001 });
  assert.deepEqual(d.data.activeMinutes, { '2026-11-10': 32 });
  assert.deepEqual(d.data.restingHr, { '2026-11-10': 58 });
  assert.deepEqual(d.data.sleep, { '2026-11-10': 421 });
  assert.deepEqual(d.data.weight.map(w => w.kg), [75.4, 75.1]);
  assert.equal(d.data.exercise[0].avgHr, 151);
  const stepsCall = g.calls.find(c => c.url.pathname.endsWith('steps/dataPoints:dailyRollUp'));
  assert.deepEqual(stepsCall.body.range.start.date, { year: 2026, month: 10, day: 11 }, '30 days back on first connect');
  const activeCall = g.calls.find(c => c.url.pathname.endsWith('active-minutes/dataPoints:dailyRollUp'));
  assert.deepEqual(activeCall.body, stepsCall.body);
  const rhr = g.calls.find(c => c.url.pathname.endsWith('daily-resting-heart-rate/dataPoints'));
  assert.equal(rhr.url.searchParams.get('filter'), 'daily_resting_heart_rate.date >= "2026-10-11"');
});

test('refuses a state made for another profile, or an expired one', async () => {
  const { health, tick } = setup();
  const state = new URL(health.authorizeUrl('u1')).searchParams.get('state');
  await assert.rejects(health.connectCallback('u2', { code: 'c', state }), e => e.code === 'state');
  tick(11 * 60 * 1000);
  await assert.rejects(health.connectCallback('u1', { code: 'c', state }), e => e.code === 'state');
});

test('later syncs read only the last few days, and not more often than every two minutes', async () => {
  const { health, g, tick } = setup();
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  const before = g.calls.length;
  await health.syncNow('u1');
  assert.equal(g.calls.length, before, 'too soon: no new calls');
  tick(60 * 60 * 1000);
  await health.syncNow('u1');
  const last = g.calls.filter(c => c.url.pathname.endsWith('daily-resting-heart-rate/dataPoints')).at(-1);
  assert.equal(last.url.searchParams.get('filter'), 'daily_resting_heart_rate.date >= "2026-11-07"');
});

test('a refresh token that expired (7 days in Testing) asks to reconnect', async () => {
  const { health, tick } = setup({ refreshFails: true });
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  tick(8 * 24 * 60 * 60 * 1000);
  await assert.rejects(health.syncNow('u1'), e => e.code === 'reconnect' && e.status === 409);
  assert.equal(health.describe('u1').status, 'reconnect');
  assert.deepEqual(health.describe('u1').data.restingHr, { '2026-11-10': 58 }, 'the data already pulled stays');
});

test('disconnecting revokes the token and deletes the file', async () => {
  const { health, g, dataDir } = setup();
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  await health.disconnect('u1');
  assert.ok(g.calls.some(c => c.url.pathname === '/revoke' && c.body.token === 'ref-1'));
  assert.equal(fs.existsSync(path.join(dataDir, 'health', 'u1.json')), false);
  assert.equal(health.describe('u1').connected, false);
});

test('heart rate validates windows, pages with the physical-time filter, and never caches samples', async () => {
  const { health, g, dataDir, tick } = setup();
  const window = { start: '2026-11-10T10:00:00Z', end: '2026-11-10T11:00:00Z' };
  await assert.rejects(health.heartRate('u1', window), e => e.status === 404 && e.code === 'not_connected');
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  const before = g.calls.length;
  for (const bad of [
    { ...window, start: '2026-11-10T04:00:00Z' },
    { start: '2026-01-01T10:00:00Z', end: '2026-01-01T11:00:00Z' },
    { ...window, end: '2026-11-10T13:00:00Z' },
    { ...window, start: window.end }, { ...window, start: 'bad' }, {},
  ]) await assert.rejects(health.heartRate('u1', bad), e => e.status === 400);
  assert.equal(g.calls.length, before);
  tick(3600000);
  assert.deepEqual(await health.heartRate('u1', window), { samples: [
    { t: Date.parse(window.start), bpm: 110 }, { t: Date.parse('2026-11-10T10:30:00Z'), bpm: 130 },
  ] });
  const calls = g.calls.filter(c => c.url.pathname.endsWith('/heart-rate/dataPoints'));
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.url.searchParams.get('filter'), `heart_rate.sample_time.physical_time >= "${window.start}" AND heart_rate.sample_time.physical_time < "${window.end}"`);
    assert.equal(c.url.searchParams.get('pageSize'), '10000');
  }
  assert.equal(calls[1].url.searchParams.get('pageToken'), 'hr2');
  assert.ok(g.calls.some(c => c.body?.grant_type === 'refresh_token'));
  assert.ok(!fs.readFileSync(path.join(dataDir, 'health', 'u1.json'), 'utf8').includes('samples'));
});

test('heart rate reports expired refresh tokens as reconnect', async () => {
  const { health, tick } = setup({ refreshFails: true });
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  tick(3600000);
  await assert.rejects(health.heartRate('u1', { start: '2026-11-10T10:00:00Z', end: '2026-11-10T11:00:00Z' }), e => e.status === 409 && e.code === 'reconnect');
  assert.equal(health.describe('u1').status, 'reconnect');
});

test('heart-rate route requires a session and reads only its profile', async () => {
  const { health } = setup();
  await health.connectCallback('u1', { code: 'c', state: new URL(health.authorizeUrl('u1')).searchParams.get('state') });
  let user = null, answer;
  const routes = healthRoutes({ health, readSession: () => user, json: (_, status, body) => { answer = { status, body }; } });
  const route = routes['GET /api/google-health/heart-rate'];
  const req = { url: '/api/google-health/heart-rate?start=2026-11-10T10:00:00Z&end=2026-11-10T11:00:00Z' };
  await route(req, {});
  assert.equal(answer.status, 401);
  user = { id: 'u2' };
  await route(req, {});
  assert.equal(answer.status, 404);
  user = { id: 'u1' };
  await route(req, {});
  assert.equal(answer.status, 200);
  assert.equal(answer.body.samples.length, 2);
  await route({ url: '/api/google-health/heart-rate' }, {});
  assert.equal(answer.status, 400);
});

test('active minutes omit light, preserve zero and ignore missing or invalid rollups', () => {
  const roll = levels => ({ civilStartTime: civil(2026, 11, 10), activeMinutes: { activeMinutesRollupByActivityLevel: levels } });
  assert.deepEqual(activeMinutesByDay([roll([{ activityLevel: 'LIGHT', activeMinutesSum: '50' }])]), { '2026-11-10': 0 });
  assert.deepEqual(activeMinutesByDay([roll([{ activityLevel: 'MODERATE', activeMinutesSum: '0' }])]), { '2026-11-10': 0 });
  assert.deepEqual(activeMinutesByDay([{}, roll([{ activityLevel: 'MODERATE', activeMinutesSum: 'bad' }]), roll([{ activityLevel: 'VIGOROUS', activeMinutesSum: '-1' }])]), {});
});

test('retention includes the 400-day boundary for every metric and replaces active minutes', () => {
  assert.equal(KEEP_DAYS, 400);
  const today = '2026-11-10';
  const boundary = new Date(Date.parse(today) - 400 * 864e5).toISOString().slice(0, 10);
  const expired = new Date(Date.parse(today) - 401 * 864e5).toISOString().slice(0, 10);
  const old = {};
  for (const key of ['steps', 'activeMinutes', 'restingHr', 'sleep']) old[key] = { [expired]: 1, [boundary]: 2, '2026-01-01': 3 };
  const merged = mergeData(old, { activeMinutes: { '2026-01-01': 40 } }, today);
  for (const key of ['steps', 'activeMinutes', 'restingHr', 'sleep']) {
    assert.equal(merged[key][expired], undefined);
    assert.equal(merged[key][boundary], 2);
    assert.equal(merged[key]['2026-01-01'], key === 'activeMinutes' ? 40 : 3);
  }
});
