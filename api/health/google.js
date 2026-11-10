/* Google Health API (PLAN.md Phase 4): the Fitbit Air's data, read with each person's own Google
 * account through server-side OAuth. https://developers.google.com/health, REST v4 at
 * health.googleapis.com. The legacy Fitbit Web API was switched off on 2026-11-02.
 *
 * Read-only scopes, the three this app uses:
 *   activity_and_fitness   steps, active minutes, exercise sessions
 *   health_metrics_and_measurements   heart rate, daily resting heart rate, weight
 *   sleep
 * A person may grant only some of them; whatever was withheld simply comes back empty.
 *
 * While the Cloud project is in "Testing", Google's refresh tokens expire after 7 days; a refresh
 * then answers `invalid_grant` and the person reconnects (status 'reconnect'). `fetch` is
 * injectable so the tests never reach Google. */

export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
];
export const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const API = 'https://health.googleapis.com/v4';
const MAX_PAGES = 20;

export class HealthError extends Error {
  constructor(message, { code = 'error', status = 502 } = {}) { super(message); this.code = code; this.status = status; }
}

export function googleHealth({ clientId, clientSecret, redirectUri, fetch: http = globalThis.fetch, timeoutMs = 15000 }) {
  const call = async (url, init = {}) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try { return await http(url, { ...init, signal: ctl.signal }); }
    catch (e) { throw new HealthError(`Google Health did not answer: ${e.message || e}`, { code: 'unreachable' }); }
    finally { clearTimeout(timer); }
  };
  const form = body => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });

  async function token(body) {
    const res = await call(TOKEN_URL, form({ client_id: clientId, client_secret: clientSecret, ...body }));
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      // A refresh token that expired (7 days in Testing) or was revoked: only reconnecting helps.
      if (out.error === 'invalid_grant') throw new HealthError('Google Health needs reconnecting', { code: 'reconnect', status: 409 });
      throw new HealthError(`Google refused the token request: ${out.error || res.status}`, { code: 'token' });
    }
    return out;
  }

  async function get(access, path, query = {}) {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, v);
    const res = await call(url, { headers: { Authorization: `Bearer ${access}` } });
    return answer(res);
  }
  async function post(access, path, body) {
    const res = await call(API + path, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return answer(res);
  }
  async function answer(res) {
    const out = await res.json().catch(() => ({}));
    if (res.ok) return out;
    const reason = out?.error?.details?.find?.(d => d.reason)?.reason || out?.error?.status || '';
    if (res.status === 401) throw new HealthError('Google Health access expired', { code: 'unauthorized', status: 401 });
    if (res.status === 403) return { denied: true } // a scope the person did not grant: no data, not an error
    if (reason === 'ACCOUNT_NOT_LINKED') throw new HealthError('This Google account has no Google Health profile yet. Open the Google Health app and sign in with Google first.', { code: 'not_linked', status: 409 });
    if (res.status === 429) throw new HealthError('Google Health is busy, try again in a minute', { code: 'rate', status: 429 });
    throw new HealthError(`Google Health answered ${res.status} ${out?.error?.message || ''}`.trim(), { code: 'api' });
  }

  return {
    authorizeUrl(state) {
      const u = new URL(AUTH_URL);
      u.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
      }).toString();
      return u.toString();
    },
    exchange: code => token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    refresh: refreshToken => token({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    async revoke(tok) { try { await call(REVOKE_URL, form({ token: tok })); } catch { /* best effort */ } },
    identity: access => get(access, '/users/me/identity'),
    /** Every data point of a type matching `filter`, following page tokens (bounded). */
    async list(access, type, filter, pageSize) {
      const points = [];
      let pageToken = ''
      for (let i = 0; i < MAX_PAGES; i++) {
        const out = await get(access, `/users/me/dataTypes/${type}/dataPoints`, { filter, pageSize, pageToken });
        if (out.denied) return points;
        points.push(...(out.dataPoints || []));
        pageToken = out.nextPageToken || '';
        if (!pageToken) break;
      }
      return points;
    },
    /** One value per day for [from, to), dates as 'YYYY-MM-DD' in the person's own time zone. */
    async dailyRollUp(access, type, from, to) {
      const d = iso => { const [year, month, day] = iso.split('-').map(Number); return { date: { year, month, day } }; };
      const out = await post(access, `/users/me/dataTypes/${type}/dataPoints:dailyRollUp`, { range: { start: d(from), end: d(to) }, windowSizeDays: 1, pageSize: 120 });
      return out.denied ? [] : out.rollupDataPoints || [];
    },
  };
}
