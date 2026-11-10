/* /api/google-health: Settings → Integrations and Home talk to these (PLAN.md Phase 4). Handed the
 * session helpers by server.js, like integrations/routes.js. Every route needs a signed-in profile
 * and only ever touches that profile's own connection. Documented in api/openapi.yaml (tag Health). */

export function healthRoutes({ json, readSession, health, audit = () => {} }) {
  const guard = fn => async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    try { await fn(req, res, user); }
    catch (e) {
      if (!e?.status) throw e;
      json(res, e.status, { error: e.message, ...(e.code ? { code: e.code } : {}) });
    }
  };
  const back = (res, query) => { res.writeHead(302, { Location: `/#/settings/integrations?${query}`, 'Cache-Control': 'no-store' }); res.end(); };

  return {
    'GET /api/google-health': guard(async (req, res, user) => json(res, 200, health.describe(user.id))),

    'GET /api/google-health/heart-rate': guard(async (req, res, user) => {
      const q = new URL(req.url, 'http://x').searchParams;
      json(res, 200, await health.heartRate(user.id, { start: q.get('start'), end: q.get('end') }));
    }),

    'POST /api/google-health/sync': guard(async (req, res, user) => json(res, 200, await health.syncNow(user.id, { force: true }))),

    'POST /api/google-health/disconnect': guard(async (req, res, user) => {
      await health.disconnect(user.id);
      audit(req, 'health.disconnect', { user, msg: 'google-health' });
      json(res, 200, { ok: true });
    }),

    // A page navigation, not a fetch: the app opens it and Google's consent screen follows.
    'GET /api/google-health/connect': async (req, res) => {
      const user = readSession(req);
      if (!user) return back(res, 'health=signin');
      if (!health.on) return back(res, 'health=off');
      res.writeHead(302, { Location: health.authorizeUrl(user.id), 'Cache-Control': 'no-store' });
      res.end();
    },

    'GET /api/google-health/callback': async (req, res) => {
      const user = readSession(req);
      if (!user) return back(res, 'health=signin');
      const q = new URL(req.url, 'http://x').searchParams;
      try {
        await health.connectCallback(user.id, { code: q.get('code'), state: q.get('state'), error: q.get('error') });
        audit(req, 'health.connect', { user, msg: 'google-health' });
        back(res, 'health=connected');
      } catch (e) {
        back(res, `health=failed&code=${encodeURIComponent(e.code || 'error')}`);
      }
    },
  };
}
