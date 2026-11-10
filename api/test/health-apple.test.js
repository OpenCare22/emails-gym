import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createAppleHealth, MAX_BODY } from '../health/apple.js';
import { healthRoutes } from '../health/routes.js';

const now = Date.parse('2026-11-10T12:00:00Z');
const at = '2026-11-09 23:30:00 -0800';
const metric = (name, data, units = 'count') => ({ name, data, units });
async function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apple-health-'));
  const logged = [];
  const apple = createAppleHealth({ dataDir: dir, now: () => now, log: n => logged.push(n) });
  let sessions = 0;
  const routes = healthRoutes({ apple, readSession: req => { sessions++; return req.headers.cookie === 'session' ? { id: 'alice' } : null; },
    json: (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); } });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const call = async (route, { token, body, raw, session, headers = {}, method = body || raw ? 'POST' : 'GET' } = {}) => {
    const bytes = Buffer.from(raw || JSON.stringify(body || {}));
    const req = Readable.from([bytes]);
    req.headers = { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(session ? { cookie: 'session' } : {}),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
    const out = { headers: new Map() };
    const res = { setHeader: (k, v) => out.headers.set(k.toLowerCase(), v), writeHead: status => { out.status = status; }, end: value => { out.body = JSON.parse(value); } };
    await routes[method + ' /api/apple-health' + route](req, res);
    return out;
  };
  return { apple, call, dir, logged, sessions: () => sessions };
}

test('session keys are shown once, stored hashed with 0600, rotated and deleted; ingest never reads a session', async t => {
  const f = await fixture(t);
  assert.equal((await f.call('/token', { method: 'POST' })).status, 401);
  const first = await f.call('/token', { method: 'POST', session: true });
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const token = first.body.token;
  const stored = fs.readFileSync(path.join(f.dir, 'health/apple-alice.json'), 'utf8');
  assert.ok(!stored.includes(token));
  assert.equal(fs.statSync(path.join(f.dir, 'health/apple-alice.json')).mode & 0o777, 0o600);
  const sessions = f.sessions();
  for (const bad of [undefined, 'wrong', 'x'.repeat(43)]) assert.equal((await f.call('/ingest', { token: bad, session: true, body: { metrics: [] } })).status, 401);
  assert.equal((await f.call('/ingest', { token, body: { metrics: [] } })).status, 200);
  assert.equal(f.sessions(), sessions);
  assert.ok(!JSON.stringify((await f.call('', { session: true })).body).includes('tokenHash'));
  const fresh = f.apple.token('alice').token;
  assert.equal((await f.call('/ingest', { token, body: { metrics: [] } })).status, 401);
  assert.equal((await f.call('/ingest', { token: fresh, body: { metrics: [] } })).status, 200);
  assert.equal((await f.call('/disconnect', { method: 'POST', session: true })).status, 200);
  assert.equal((await f.call('/ingest', { token: fresh, body: { metrics: [] } })).status, 401);
  assert.equal(f.apple.describe('alice').connected, false);
  assert.deepEqual(f.apple.describe('bob').data.steps, {});
});

test('both payload shapes, local dates, all metrics, both sleep formats, v1/v2 workouts and duplicates', async t => {
  const f = await fixture(t), token = f.apple.token('alice').token;
  const workout = { name: 'Running', start: '2026-11-09 10:00:00 +0000', end: '2026-11-09 11:00:00 +0000',
    heartRateData: [{ date: '2026-11-09 10:00:00 +0000', qty: 100 }, { date: '2026-11-09 10:00:02 +0000', qty: 120 }, { date: '2026-11-09 10:00:05 +0000', qty: 140 }] };
  const input = { metrics: [metric('step_count', [{ date: at, qty: 8000 }, { date: at, qty: 500 }]),
    metric('resting_heart_rate', [{ date: at, qty: 60 }]), metric('apple_exercise_time', [{ date: at, qty: 45 }], 'min'),
    metric('body_mass', [{ date: at, qty: 200 }], 'lb'), metric('active_energy', [{ date: at, qty: 418.4 }], 'kJ'),
    metric('heart_rate', [{ date: at, Min: 60, Avg: 80, Max: 120 }]),
    metric('sleep_analysis', [{ sleepEnd: at, totalSleep: 7, asleep: 7, core: 4, deep: 1, rem: 2, inBed: 8 }], 'hr'),
    metric('sleep_analysis', ['Core', 'REM', 'Deep', 'Asleep', 'Awake', 'In Bed'].map(value => ({ end: '2026-11-08 08:00:00 +0000', start: '2026-11-08 07:00:00 +0000', qty: 1, value })), 'hr'),
    metric('unexpected', []), metric('step_count', [{ date: '2020-01-01 00:00:00 +0000', qty: 12 }])],
    workouts: [workout, { ...workout, id: 'v2', duration: 3600, avgHeartRate: { qty: 150 }, distance: { qty: 3, units: 'mi' }, activeEnergyBurned: { qty: 300, units: 'kcal' }, heartRateData: workout.heartRateData.map(p => ({ date: p.date, Min: 80, Avg: p.qty, Max: 160 })) }] };
  assert.deepEqual((await f.call('/ingest', { token, body: { data: input } })).body, { ok: true, received: { metrics: 10, workouts: 2 } });
  const first = f.apple.describe('alice');
  assert.equal(first.source, 'apple');
  assert.deepEqual(first.data.steps, { '2026-11-09': 8500 });
  assert.equal(first.data.restingHr['2026-11-09'], 60);
  assert.equal(first.data.activeMinutes['2026-11-09'], 45);
  assert.equal(first.data.sleep['2026-11-09'], 420);
  assert.equal(first.data.sleep['2026-11-08'], 240);
  assert.equal(first.data.weight[0].kg, 200 * 0.45359237);
  assert.ok(Math.abs(first.data.activeEnergy['2026-11-09'] - 100) < 0.001);
  assert.equal(Object.values(first.data.heartRate)[0], 80);
  assert.deepEqual(first.data.exercise.map(e => e.avgHr).sort(), [120, 150]);
  assert.ok(first.data.exercise.every(e => e.hrSamples.length === 2));
  assert.equal((await f.call('/ingest', { token, body: input })).status, 200);
  assert.deepEqual(f.apple.describe('alice'), first);
  assert.deepEqual(f.logged, ['unexpected']);
  await f.call('/ingest', { token, body: { metrics: [metric('step_count', [{ date: at, qty: 9000 }])] } });
  assert.equal(f.apple.describe('alice').data.steps['2026-11-09'], 9000);
  assert.equal(f.apple.describe('alice').data.exercise.length, 2);
});

test('limits unknown names, rejects bad shapes, oversized and excessive requests', async t => {
  const f = await fixture(t), token = f.apple.token('alice').token;
  assert.equal((await f.call('/ingest', { token, raw: '{bad' })).status, 400);
  assert.equal((await f.call('/ingest', { token, body: { metrics: 'bad' } })).status, 400);
  assert.equal((await f.call('/ingest', { token, raw: ' '.repeat(MAX_BODY + 1) })).status, 413);
  assert.equal((await f.call('/ingest', { token, body: { metrics: [] }, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  await f.call('/ingest', { token, body: { metrics: Array.from({ length: 40 }, (_, i) => metric('unknown' + i, [])) } });
  assert.equal(f.apple.describe('alice').unknownMetrics.length, 30);
  for (let i = 5; i < 60; i++) assert.equal((await f.call('/ingest', { token, body: { metrics: [] } })).status, 200);
  const limited = await f.call('/ingest', { token, body: { metrics: [] } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '3600');
  const other = f.apple.token('bob').token;
  assert.equal((await f.call('/ingest', { token: other, body: { workouts: [] } })).status, 200);
});

test('rotation and removal invalidate an upload already reading its body; retention advances', async t => {
  const f = await fixture(t), token = f.apple.token('alice').token;
  const auth = f.apple.authenticate(`Bearer ${token}`);
  f.apple.token('alice');
  assert.throws(() => f.apple.ingest(auth, { metrics: [] }), { status: 401 });
  const next = f.apple.token('alice').token, pending = f.apple.authenticate(`Bearer ${next}`);
  f.apple.removeUser('alice');
  assert.throws(() => f.apple.ingest(pending, { metrics: [] }), { status: 401 });
  assert.equal(fs.existsSync(path.join(f.dir, 'health/apple-alice.json')), false);
});

test('retains only 400 days, persists across restart, and replaces weights and workouts by id', async t => {
  const f = await fixture(t), token = f.apple.token('alice').token;
  const body = { metrics: [metric('body_mass', [{ date: at, id: 'scale', qty: 80 }], 'kg')], workouts: [{ id: 'session', name: 'Strength training', start: '2026-11-09 10:00:00 +0000', end: '2026-11-09 11:00:00 +0000' }] };
  await f.call('/ingest', { token, body });
  body.metrics[0].data[0].qty = 81;
  body.workouts[0].avgHeartRate = { qty: 123 };
  await f.call('/ingest', { token, body });
  const restarted = createAppleHealth({ dataDir: f.dir, now: () => now });
  assert.ok(restarted.authenticate(`Bearer ${token}`));
  assert.equal(restarted.describe('alice').data.weight.length, 1);
  assert.equal(restarted.describe('alice').data.weight[0].kg, 81);
  assert.equal(restarted.describe('alice').data.exercise.length, 1);
  assert.equal(restarted.describe('alice').data.exercise[0].avgHr, 123);
  const later = createAppleHealth({ dataDir: f.dir, now: () => now + 401 * 864e5 });
  assert.deepEqual(later.describe('alice').data.weight, []);
  assert.deepEqual(later.describe('alice').data.exercise, []);
});
