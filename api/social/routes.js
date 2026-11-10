/* /api/social: the Friends screen talks to these (PLAN.md Phase 7). Handed the session helpers by
 * server.js. Every route needs a signed-in profile and only acts as that profile; documented in
 * api/openapi.yaml (tag social). */

export function socialRoutes({ json, readBody, readSession, social }) {
  const guard = fn => async (req, res) => {
    const user = readSession(req);
    if (!user) return json(res, 401, { error: 'not signed in' });
    try { await fn(req, res, user); }
    catch (e) {
      if (!e?.status) throw e;
      json(res, e.status, { error: e.message, ...(e.code ? { code: e.code } : {}) });
    }
  };
  const str = (v, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');

  return {
    'GET /api/social': guard(async (req, res, user) => json(res, 200, social.describe(user.id))),

    'GET /api/social/summary': guard(async (req, res, user) => {
      json(res, 200, { summary: social.summary(user.id) || social.refreshSummary(user.id) });
    }),

    'GET /api/social/leaderboard': guard(async (req, res, user) => {
      const q = new URL(req.url, 'http://x').searchParams;
      json(res, 200, social.leaderboard(user.id, { groupId: str(q.get('groupId')), metric: str(q.get('metric'), 20), range: str(q.get('range'), 20) || undefined }));
    }),

    'POST /api/social/groups': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, { group: social.createGroup(user.id, body.name) });
    }),

    'POST /api/social/rename': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, social.rename(user.id, str(body.groupId), body.name));
    }),

    'POST /api/social/groups/invite': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, { invite: social.invite(user.id, str(body.groupId), { off: body.off === true }) });
    }),

    'POST /api/social/peek': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, social.peek(str(body.code, 40)));
    }),

    'POST /api/social/join': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, { group: social.join(user.id, str(body.code, 40)) });
    }),

    'POST /api/social/leave': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, social.leave(user.id, str(body.groupId)));
    }),

    'POST /api/social/remove': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, social.remove(user.id, str(body.groupId), str(body.uid, 64)));
    }),

    'POST /api/social/sharing': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, { sharing: social.setSharing(user.id, str(body.groupId), body.sharing) });
    }),

    'POST /api/social/nudges': guard(async (req, res, user) => {
      const body = await readBody(req);
      json(res, 200, { nudges: social.setNudges(user.id, body.on === true) });
    }),
  };
}
