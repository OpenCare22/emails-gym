/* Google Health connections (PLAN.md Phase 4). One file per profile under DATA_DIR/health/, mode
 * 0600, never the profile's state (which syncs to every device and rides in every backup): the
 * Google tokens sealed with integrations/crypto.js (bound to the profile and field), the
 * connection's status, and the normalised data from health/data.js for the last 400 days.
 *
 * Off unless GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_CLIENT_SECRET are set; then /api/config
 * says { health: { google: true } } to a signed-in profile and the routes below answer.
 * The redirect URI Google calls back is ORIGIN + /api/google-health/callback. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { deriveKey, seal, open } from '../integrations/crypto.js';
import { atomicWrite } from '../durable.js';
import { googleHealth, HealthError } from './google.js';
import { pull, mergeData, SOURCE } from './data.js';

export const CALLBACK_PATH = '/api/google-health/callback';
const STATE_TTL_MS = 10 * 60 * 1000;
const BACKFILL_DAYS = 30;
const OVERLAP_DAYS = 3; // re-read the last few days: Google fills a day in as the watch syncs
const MIN_SYNC_MS = 2 * 60 * 1000;
const TICK_MS = 3 * 60 * 60 * 1000;

const day = ms => new Date(ms).toISOString().slice(0, 10);
const safeId = uid => String(uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

export function createHealth({ dataDir, secret, origin, env = process.env, now = Date.now, fetch = globalThis.fetch }) {
  const clientId = env.GOOGLE_HEALTH_CLIENT_ID, clientSecret = env.GOOGLE_HEALTH_CLIENT_SECRET;
  const on = !!(clientId && clientSecret);
  const dir = path.join(dataDir, 'health');
  const key = deriveKey(secret);
  const google = on ? googleHealth({ clientId, clientSecret, redirectUri: String(origin).replace(/\/$/, '') + CALLBACK_PATH, fetch }) : null;
  const running = new Map(); // uid -> the sync in flight, so two taps share one pull

  const file = uid => path.join(dir, safeId(uid) + '.json');
  function load(uid) {
    try { return JSON.parse(fs.readFileSync(file(uid), 'utf8')); } catch { return null; }
  }
  function save(uid, rec) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    atomicWrite(file(uid), JSON.stringify(rec), 0o600);
  }
  const sealed = (uid, name, value) => seal(key, value, `health|${uid}|${name}`);
  const opened = (uid, rec, name) => open(key, rec?.secrets?.[name], `health|${uid}|${name}`);

  // The OAuth `state`: the profile, an expiry and a nonce, HMAC-signed with a key of its own.
  const stateKey = crypto.createHmac('sha256', key).update('health-oauth-state').digest();
  const mac = s => crypto.createHmac('sha256', stateKey).update(s).digest('base64url');
  function makeState(uid) {
    const body = `${Buffer.from(String(uid)).toString('base64url')}.${now() + STATE_TTL_MS}.${crypto.randomBytes(9).toString('base64url')}`;
    return `${body}.${mac(body)}`;
  }
  function readState(state) {
    const parts = String(state || '').split('.');
    if (parts.length !== 4) return null;
    const body = parts.slice(0, 3).join('.');
    const want = Buffer.from(mac(body)), got = Buffer.from(parts[3]);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    if (Number(parts[1]) < now()) return null;
    return Buffer.from(parts[0], 'base64url').toString();
  }

  function describe(uid) {
    const rec = load(uid);
    if (!rec) return { available: on, connected: false };
    return {
      available: on, connected: true, source: SOURCE, status: rec.status || 'ok', connectedAt: rec.connectedAt,
      lastSync: rec.lastSync || null, ...(rec.lastError ? { lastError: rec.lastError } : {}), data: rec.data || {},
    };
  }

  async function accessToken(uid, rec) {
    const cached = opened(uid, rec, 'access');
    if (cached && rec.accessExpires > now() + 60_000) return cached;
    const refresh = opened(uid, rec, 'refresh');
    if (!refresh) throw new HealthError('Google Health needs reconnecting', { code: 'reconnect', status: 409 });
    const tok = await google.refresh(refresh);
    rec.secrets.access = sealed(uid, 'access', tok.access_token);
    rec.accessExpires = now() + (Number(tok.expires_in) || 3600) * 1000;
    if (tok.refresh_token) rec.secrets.refresh = sealed(uid, 'refresh', tok.refresh_token);
    return tok.access_token;
  }

  async function syncNow(uid, { force = false } = {}) {
    if (!on) throw new HealthError('Google Health is not set up on this server', { code: 'off', status: 404 });
    if (running.has(uid)) return running.get(uid);
    const job = (async () => {
      const rec = load(uid);
      if (!rec) throw new HealthError('Google Health is not connected', { code: 'not_connected', status: 404 });
      if (!force && rec.lastSync && now() - Date.parse(rec.lastSync) < MIN_SYNC_MS) return describe(uid);
      try {
        const access = await accessToken(uid, rec);
        const fromDay = rec.lastSync ? day(Date.parse(rec.lastSync) - OVERLAP_DAYS * 864e5) : day(now() - BACKFILL_DAYS * 864e5);
        const fresh = await pull(google, access, { fromDay, now: now() });
        rec.data = mergeData(rec.data, fresh, day(now()));
        rec.status = 'ok'; rec.lastSync = new Date(now()).toISOString(); delete rec.lastError;
      } catch (e) {
        rec.status = e.code === 'reconnect' || e.code === 'not_linked' ? e.code : 'attention';
        rec.lastError = { at: new Date(now()).toISOString(), code: e.code || 'error', msg: String(e.message || e).slice(0, 200) };
        save(uid, rec);
        throw e;
      }
      save(uid, rec);
      return describe(uid);
    })();
    running.set(uid, job);
    try { return await job; } finally { running.delete(uid); }
  }

  async function heartRate(uid, { start, end }) {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
    const from = Date.parse(start), to = Date.parse(end);
    if (!iso.test(start) || !iso.test(end) || !Number.isFinite(from) || !Number.isFinite(to) ||
        to <= from || to - from > 6 * 3600000 || from < now() - 120 * 864e5 || to > now()) {
      throw new HealthError('Choose a window of at most 6 hours within the last 120 days', { code: 'window', status: 400 });
    }
    if (!on) throw new HealthError('Google Health is not set up on this server', { code: 'off', status: 404 });
    const rec = load(uid);
    if (!rec) throw new HealthError('Google Health is not connected', { code: 'not_connected', status: 404 });
    try {
      const access = await accessToken(uid, rec);
      const points = await google.list(access, 'heart-rate', `heart_rate.sample_time.physical_time >= "${start}" AND heart_rate.sample_time.physical_time < "${end}"`, 10000);
      const samples = points.map(p => ({ t: Date.parse(p.heartRate?.sampleTime?.physicalTime), bpm: Math.round(Number(p.heartRate?.beatsPerMinute)) }))
        .filter(p => Number.isFinite(p.t) && p.t >= from && p.t < to && p.bpm >= 25 && p.bpm <= 250)
        .sort((a, b) => a.t - b.t);
      save(uid, rec); // persist refreshed tokens, never the samples
      return { samples };
    } catch (e) {
      rec.status = e.code === 'reconnect' || e.code === 'not_linked' ? e.code : 'attention';
      rec.lastError = { at: new Date(now()).toISOString(), code: e.code || 'error', msg: String(e.message || e).slice(0, 200) };
      save(uid, rec);
      throw e;
    }
  }

  async function connectCallback(sessionUid, { code, state, error }) {
    const uid = readState(state);
    if (!uid || uid !== sessionUid) throw new HealthError('That connection link expired or was for another profile. Try again.', { code: 'state', status: 400 });
    if (error) throw new HealthError(error === 'access_denied' ? 'You did not allow access' : `Google said: ${String(error).slice(0, 60)}`, { code: 'denied', status: 400 });
    if (!code) throw new HealthError('Google did not send a code', { code: 'no_code', status: 400 });
    const tok = await google.exchange(String(code).slice(0, 2000));
    if (!tok.refresh_token) throw new HealthError('Google did not give a lasting connection. Remove Email’s Gym from your Google account’s connected apps and try again.', { code: 'no_refresh', status: 400 });
    const id = await google.identity(tok.access_token);
    const old = load(uid);
    if (old) { const prev = opened(uid, old, 'refresh'); if (prev && prev !== tok.refresh_token) await google.revoke(prev); }
    save(uid, {
      provider: 'google-health', connectedAt: new Date(now()).toISOString(), status: 'ok',
      healthUserId: String(id?.healthUserId || '').slice(0, 64), scopes: String(tok.scope || '').slice(0, 600),
      accessExpires: now() + (Number(tok.expires_in) || 3600) * 1000,
      secrets: { refresh: sealed(uid, 'refresh', tok.refresh_token), access: sealed(uid, 'access', tok.access_token) },
      data: old?.data || {}, lastSync: null,
    });
    try { await syncNow(uid, { force: true }); } catch { /* the app shows the status */ }
  }

  async function disconnect(uid) {
    const rec = load(uid);
    if (!rec) return;
    const refresh = opened(uid, rec, 'refresh');
    if (refresh && google) await google.revoke(refresh);
    removeUser(uid);
  }
  function removeUser(uid) { try { fs.unlinkSync(file(uid)); } catch { /* none */ } }

  let timer = null;
  function start(listUserIds = () => []) {
    if (!on || timer) return;
    timer = setInterval(async () => {
      for (const uid of listUserIds()) {
        if (!load(uid)) continue;
        try { await syncNow(uid); } catch { /* recorded on the connection */ }
      }
    }, TICK_MS);
    timer.unref?.();
  }
  const stop = () => { clearInterval(timer); timer = null; };

  return {
    on, describe, syncNow, heartRate, disconnect, removeUser, start, stop, connectCallback,
    authorizeUrl: uid => google.authorizeUrl(makeState(uid)),
    publicConfig: () => (on ? { google: true } : null),
    _test: { makeState, readState, load },
  };
}
