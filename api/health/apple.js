// Health Auto Export REST uploads. Secrets never enter the profile state or logs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicWrite } from '../durable.js';
import { createWindow } from '../rate-limit.js';
import { mergeData } from './data.js';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const list = value => Array.isArray(value) ? value : [];
const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const known = new Set(['step_count', 'resting_heart_rate', 'heart_rate', 'active_energy', 'sleep_analysis', 'body_mass', 'apple_exercise_time']);
export const MAX_BODY = 5 * 1024 * 1024;
const fail = (status, message) => Object.assign(new Error(message), { status });

// Parse the export's explicit offset, retaining its local calendar day independently of UTC.
function date(value) {
  if (typeof value !== 'string') return null;
  const iso = value.replace(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/, '$1T$2$3:$4');
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && /^\d{4}-\d\d-\d\dT/.test(iso) ? { at: new Date(ms).toISOString(), d: iso.slice(0, 10), ms } : null;
}
const energy = e => num(e?.qty) == null ? null : e.units === 'kJ' ? e.qty / 4.184 : e.units === 'kcal' || e.units === 'Cal' ? e.qty : null;

export function normalizeApple(body) {
  const input = body?.data ?? body;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (!Array.isArray(input.metrics) && !Array.isArray(input.workouts)) ||
      (input.metrics != null && !Array.isArray(input.metrics)) || (input.workouts != null && !Array.isArray(input.workouts))) throw fail(400, 'invalid health export');
  const data = { steps: {}, activeMinutes: {}, restingHr: {}, sleep: {}, weight: [], exercise: [], activeEnergy: {}, heartRate: {} };
  const unknownMetrics = [], rhr = {};
  const add = (field, day, value) => { if (value != null) data[field][day] = (data[field][day] || 0) + value; };
  for (const metric of list(input.metrics)) {
    const name = metric?.name;
    if (typeof name !== 'string') continue;
    if (!known.has(name)) { unknownMetrics.push(name.slice(0, 100)); continue; }
    for (const p of list(metric.data)) {
      if (!p || typeof p !== 'object') continue;
      const dt = date(name === 'sleep_analysis' ? p.sleepEnd || p.end || p.date : p.date);
      if (!dt) continue;
      const qty = num(p.qty);
      if (name === 'step_count') add('steps', dt.d, qty);
      if (name === 'apple_exercise_time') add('activeMinutes', dt.d, qty);
      if (name === 'active_energy') add('activeEnergy', dt.d, energy({ qty, units: metric.units }));
      if (name === 'heart_rate' && num(p.Avg) != null) data.heartRate[dt.at] = p.Avg;
      if (name === 'resting_heart_rate' && qty > 0) (rhr[dt.d] ||= []).push(qty);
      if (name === 'sleep_analysis') {
        const hours = num(p.totalSleep) ?? (['Asleep', 'Core', 'REM', 'Deep'].includes(p.value) ? qty : null);
        add('sleep', dt.d, hours == null ? null : hours * 60);
      }
      if (name === 'body_mass' && qty > 0 && ['kg', 'lb'].includes(metric.units)) data.weight.push({
        id: 'apple:' + hash(String(p.id || `${p.date}|${p.source || ''}`)), at: dt.at, d: dt.d,
        kg: qty * (metric.units === 'lb' ? 0.45359237 : 1), src: 'apple',
      });
    }
  }
  for (const [day, values] of Object.entries(rhr)) data.restingHr[day] = values.reduce((a, b) => a + b, 0) / values.length;
  for (const w of list(input.workouts)) {
    const start = date(w?.start), end = date(w?.end);
    if (!start || !end || end.ms <= start.ms) continue;
    const all = list(w.heartRateData).map(p => ({ t: date(p?.date)?.ms, bpm: num(p?.Avg) ?? num(p?.qty) }))
      .filter(p => p.t >= start.ms && p.t <= end.ms && p.bpm > 0 && p.bpm <= 300).sort((a, b) => a.t - b.t);
    const hrSamples = [];
    for (const p of all) if (!hrSamples.length || p.t - hrSamples.at(-1).t >= 5000) hrSamples.push(p);
    const distance = num(w.distance?.qty);
    const name = String(w.name || 'Workout').slice(0, 60);
    const type = /strength|weights/i.test(name) ? 'FREE_WEIGHTS' : /run/i.test(name) ? 'RUNNING' : /walk/i.test(name) ? 'WALKING' : /cycl|bik/i.test(name) ? 'BIKING' : /swim/i.test(name) ? 'SWIMMING' : /row/i.test(name) ? 'ROWING' : 'OTHER';
    data.exercise.push({ id: 'apple:' + hash(String(w.id || `${name}|${w.start}`)), name, type,
      start: start.at, end: end.at, d: start.d, minutes: (num(w.duration) ?? (end.ms - start.ms) / 1000) / 60,
      avgHr: num(w.avgHeartRate?.qty) ?? (all.length ? all.reduce((n, p) => n + p.bpm, 0) / all.length : null),
      kcal: energy(w.activeEnergyBurned), distanceKm: distance == null ? null : w.distance.units === 'km' ? distance : w.distance.units === 'mi' ? distance * 1.609344 : w.distance.units === 'm' ? distance / 1000 : null,
      steps: null, hrSamples, source: 'apple',
    });
  }
  return { data, unknownMetrics, received: { metrics: list(input.metrics).length, workouts: list(input.workouts).length } };
}

export function createAppleHealth({ dataDir, now = Date.now, log = name => console.warn('apple-health: unknown metric', name) }) {
  const dir = path.join(dataDir, 'health');
  const file = uid => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(uid)) throw fail(400, 'invalid profile');
    return path.join(dir, `apple-${uid}.json`);
  };
  const load = uid => { try { return JSON.parse(fs.readFileSync(file(uid), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } };
  const save = (uid, rec) => { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); atomicWrite(file(uid), JSON.stringify(rec), 0o600); };
  const budget = createWindow({ max: 60, windowMs: 3600000, now });
  function trim(data = {}) {
    const cut = new Date(now() - 400 * 864e5).toISOString().slice(0, 10);
    const keep = values => Object.fromEntries(Object.entries(values || {}).filter(([d]) => d.slice(0, 10) >= cut));
    return { ...mergeData({}, data, new Date(now()).toISOString().slice(0, 10)), activeEnergy: keep(data.activeEnergy), heartRate: keep(data.heartRate), source: 'apple' };
  }
  function authenticate(auth) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(auth || '');
    if (!match) throw fail(401, 'invalid ingest token');
    const digest = Buffer.from(hash(match[1]), 'hex');
    let uid = null;
    for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const m = /^apple-([A-Za-z0-9_-]{1,64})\.json$/.exec(entry);
      if (!m) continue;
      const rec = load(m[1]);
      const stored = /^[a-f0-9]{64}$/.test(rec.tokenHash || '') ? Buffer.from(rec.tokenHash, 'hex') : Buffer.alloc(32);
      if (crypto.timingSafeEqual(stored, digest)) uid = m[1];
    }
    if (!uid) throw fail(401, 'invalid ingest token');
    const retryAfter = budget.take(digest.toString('hex'));
    if (retryAfter) throw Object.assign(fail(429, 'too many exports'), { retryAfter });
    return { uid, digest: digest.toString('hex') };
  }
  return {
    token(uid) {
      const token = crypto.randomBytes(32).toString('base64url');
      save(uid, { ...load(uid), tokenHash: hash(token), createdAt: new Date(now()).toISOString() });
      return { token };
    },
    describe(uid) {
      const rec = load(uid);
      return { connected: !!rec.tokenHash, lastReceived: rec.lastReceived || null, createdAt: rec.createdAt || null,
        unknownMetrics: rec.unknownMetrics || [], source: 'apple', data: trim(rec.data) };
    },
    removeUser(uid) { fs.rmSync(file(uid), { force: true }); },
    authenticate,
    ingest(auth, body) {
      // Recheck after the async body read: disconnect or rotation must invalidate in-flight uploads.
      const rec = load(auth.uid);
      if (rec.tokenHash !== auth.digest) throw fail(401, 'invalid ingest token');
      const parsed = normalizeApple(body);
      const names = new Set(rec.unknownMetrics || []);
      for (const name of parsed.unknownMetrics) if (!names.has(name) && names.size < 30) { names.add(name); log(name); }
      const data = { ...mergeData(rec.data, parsed.data, new Date(now()).toISOString().slice(0, 10)),
        activeEnergy: { ...rec.data?.activeEnergy, ...parsed.data.activeEnergy }, heartRate: { ...rec.data?.heartRate, ...parsed.data.heartRate } };
      save(auth.uid, { ...rec, lastReceived: new Date(now()).toISOString(), unknownMetrics: [...names], data: trim(data) });
      return { ok: true, received: parsed.received };
    },
  };
}

export async function readAppleBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) { req.resume(); throw fail(413, 'export too large'); }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw fail(415, 'expected application/json');
  // Do not destroy the socket on overflow: the caller still needs its 413 response.
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, over = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { if (!over) { over = true; chunks.length = 0; reject(fail(413, 'export too large')); } }
      else if (!over) chunks.push(chunk);
    });
    req.on('end', () => { if (over) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(fail(400, 'invalid JSON')); } });
    req.on('error', () => reject(fail(400, 'incomplete export')));
    req.on('aborted', () => reject(fail(400, 'incomplete export')));
  });
}
