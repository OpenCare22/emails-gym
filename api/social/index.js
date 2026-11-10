/* Friends (PLAN.md Phase 7): groups joined by invite link, what each person shares with each group,
 * and a small summary per person (social/summary.js) that is all the social features ever read.
 * Nothing here touches another profile's state file.
 *
 *   DATA_DIR/social/social.json         { groups: [Group], sharing: { uid: { groupId: Sharing } }, nudges: { uid: bool } }
 *   DATA_DIR/social/summaries/<uid>.json  the person's summary, recomputed on each save and daily
 *
 *   Group   = { id, name, ownerId, createdAt, members: [{ uid, joinedAt }], invite: { code, expiresAt } | null }
 *   Sharing = { workouts, streak, volume, prs, steps, activeMinutes, strength, feed }   all false by default
 *
 * Every write goes temp-then-rename (durable.js), mode 0600. Invite codes and summaries are never logged. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicWrite } from '../durable.js';
import { createWindow } from '../rate-limit.js';
import { summaryOf, dayIn } from './summary.js';
import { nudgeLine } from './nudge-lines.js';
import { detectEvents } from '../integrations/events.js';

export const SHARE_KEYS = ['workouts', 'streak', 'volume', 'prs', 'steps', 'activeMinutes', 'strength', 'feed'];
export const MAX_MEMBERS = 12;
export const MAX_GROUPS = 5;
export const INVITE_DAYS = 14;
export const NUDGES_PER_DAY = 10;
export const FEED_DAYS = 30;
export const FEED_MAX = 200;
const KUDOS_PUSH_MS = 60 * 60 * 1000;
const TICK_MS = 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const safeId = uid => String(uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
export const noSharing = () => Object.fromEntries(SHARE_KEYS.map(k => [k, false]));

// What each leaderboard reads from a summary, and which sharing switch opens it to the group.
export const METRICS = {
  workouts: { share: 'workouts', ranges: { week: 'workoutsWeek', month: 'workoutsMonth', all: 'workoutsAll' } },
  streak: { share: 'streak', ranges: { current: 'streakWeeks' }, second: 'bestStreakWeeks' },
  volume: { share: 'volume', ranges: { week: 'volumeWeekKg', month: 'volumeMonthKg' } },
  prs: { share: 'prs', ranges: { month: 'prsMonth' } },
  steps: { share: 'steps', ranges: { week: 'stepsWeek' } },
  activeMinutes: { share: 'activeMinutes', ranges: { week: 'activeMinutesWeek' } },
  strength: { share: 'strength', ranges: { squat: 'squat', bench: 'bench', deadlift: 'deadlift' } },
};

/** Ranks with ties sharing a rank (1, 1, 3); people without a value come last, unranked. */
export function rankRows(rows) {
  const sorted = [...rows].sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || String(a.name).localeCompare(String(b.name)));
  let last = null, rank = 0;
  sorted.forEach((r, i) => {
    if (r.value == null) { r.rank = null; return; }
    if (r.value !== last) { rank = i + 1; last = r.value; }
    r.rank = rank;
  });
  return sorted;
}

export function createSocial({ dataDir, now = Date.now, readState = () => null, healthOf = () => ({}), nameOf = uid => uid, sendPush = async () => {}, hasPush = () => false }) {
  const dir = path.join(dataDir, 'social');
  const file = path.join(dir, 'social.json');
  const sumFile = uid => path.join(dir, 'summaries', safeId(uid) + '.json');
  const joins = createWindow({ max: 10, windowMs: 60 * 60 * 1000, now });

  const blank = () => ({ groups: [], sharing: {}, nudges: {}, nudgeLog: {}, kudosPush: {} });
  function load() {
    try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); return { ...blank(), ...d }; } catch { return blank(); }
  }
  function save(d) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    atomicWrite(file, JSON.stringify(d), 0o600);
  }
  const code = () => crypto.randomBytes(12).toString('base64url');
  const newInvite = () => ({ code: code(), expiresAt: new Date(now() + INVITE_DAYS * 864e5).toISOString() });
  const groupsOf = (d, uid) => d.groups.filter(g => g.members.some(m => m.uid === uid));
  const member = (d, groupId, uid) => {
    const g = d.groups.find(x => x.id === groupId);
    if (!g || !g.members.some(m => m.uid === uid)) throw fail(404, 'no-group', 'no such group');
    return g;
  };
  const owner = (d, groupId, uid) => {
    const g = member(d, groupId, uid);
    if (g.ownerId !== uid) throw fail(403, 'not-owner', 'only the group owner can do that');
    return g;
  };
  const cleanName = name => {
    const n = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!n) throw fail(400, 'name', 'give the group a name');
    return n;
  };
  function drop(d, uid, groupId) {
    const g = d.groups.find(x => x.id === groupId);
    if (!g) return;
    g.members = g.members.filter(m => m.uid !== uid);
    if (d.sharing[uid]) delete d.sharing[uid][groupId];
    if (!g.members.length) d.groups = d.groups.filter(x => x.id !== groupId);
    else if (g.ownerId === uid) g.ownerId = [...g.members].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : 1))[0].uid;
  }

  function view(d, uid) {
    return {
      groups: groupsOf(d, uid).map(g => ({
        id: g.id, name: g.name, owner: g.ownerId === uid,
        members: g.members.map(m => ({ uid: m.uid, name: nameOf(m.uid), self: m.uid === uid, owner: m.uid === g.ownerId })),
        ...(g.ownerId === uid ? { invite: g.invite && Date.parse(g.invite.expiresAt) > now() ? g.invite : null } : {}),
      })),
      sharing: Object.fromEntries(groupsOf(d, uid).map(g => [g.id, { ...noSharing(), ...(d.sharing[uid]?.[g.id] || {}) }])),
      nudges: d.nudges[uid] !== false,
    };
  }

  // ---- the feed: one file per group, items keep no weights, exercises or anything else of the log ----
  const feedFile = gid => path.join(dir, 'feed', safeId(gid) + '.json');
  const readFeed = gid => { try { return JSON.parse(fs.readFileSync(feedFile(gid), 'utf8')); } catch { return []; } };
  function writeFeed(gid, items) {
    const cut = new Date(now() - FEED_DAYS * 864e5).toISOString();
    const keep = items.filter(i => i.at >= cut).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, FEED_MAX);
    fs.mkdirSync(path.dirname(feedFile(gid)), { recursive: true, mode: 0o700 });
    atomicWrite(feedFile(gid), JSON.stringify(keep), 0o600);
  }
  const itemOf = (uid, w, at) => {
    const work = (Array.isArray(w.entries) ? w.entries : []).reduce((n, e) => n + (Array.isArray(e?.sets) ? e.sets.filter(x => x && x.done !== false && x.warmup !== true && x.phase !== 'warmup').length : 0), 0);
    const minutes = Number(w.end) > Number(w.start) ? Math.round((Number(w.end) - Number(w.start)) / 60000) : null;
    return { id: `${uid}:${String(w.id).slice(0, 80)}`, uid, at: new Date(at).toISOString(), kind: 'workout',
      title: typeof w.name === 'string' && w.name.trim() ? w.name.trim().slice(0, 60) : null,
      sets: work, prs: Array.isArray(w.prs) ? w.prs.length : 0, minutes, kudos: [] };
  };

  // The sender's own calendar day: a nudge limit resets at their midnight.
  const senderDay = uid => dayIn(now(), readState(uid)?.reminder?.tz || null);

  // ---- summaries ----
  function readSummary(uid) { try { return JSON.parse(fs.readFileSync(sumFile(uid), 'utf8')); } catch { return null; } }
  function refreshSummary(uid, state = readState(uid)) {
    if (!state) return null;
    const s = { ...summaryOf(state, { now: now(), health: healthOf(uid) || {} }), updatedAt: new Date(now()).toISOString() };
    fs.mkdirSync(path.dirname(sumFile(uid)), { recursive: true, mode: 0o700 });
    atomicWrite(sumFile(uid), JSON.stringify(s), 0o600);
    return s;
  }
  const inAnyGroup = uid => groupsOf(load(), uid).length > 0;

  let timer = null;
  return {
    SHARE_KEYS,
    describe: uid => view(load(), uid),
    createGroup(uid, name) {
      const d = load();
      if (groupsOf(d, uid).length >= MAX_GROUPS) throw fail(409, 'too-many-groups', `you can be in at most ${MAX_GROUPS} groups`);
      const g = { id: 'g_' + code(), name: cleanName(name), ownerId: uid, createdAt: new Date(now()).toISOString(), members: [{ uid, joinedAt: new Date(now()).toISOString() }], invite: newInvite() };
      d.groups.push(g);
      save(d);
      try { refreshSummary(uid); } catch { /* shown on the next save */ }
      return view(d, uid).groups.find(x => x.id === g.id);
    },
    rename(uid, groupId, name) { const d = load(); owner(d, groupId, uid).name = cleanName(name); save(d); return view(d, uid); },
    invite(uid, groupId, { off = false } = {}) {
      const d = load();
      const g = owner(d, groupId, uid);
      g.invite = off ? null : newInvite();
      save(d);
      return g.invite;
    },
    join(uid, inviteCode) {
      if (joins.take(uid)) throw fail(429, 'slow-down', 'too many tries, wait a while');
      const d = load();
      const c = String(inviteCode || '').slice(0, 40);
      const g = d.groups.find(x => x.invite && x.invite.code === c && Date.parse(x.invite.expiresAt) > now());
      if (!g) throw fail(404, 'invite-invalid', 'this invite link has expired or was turned off');
      if (!g.members.some(m => m.uid === uid)) {
        if (g.members.length >= MAX_MEMBERS) throw fail(409, 'full', `this group is full (${MAX_MEMBERS} people)`);
        if (groupsOf(d, uid).length >= MAX_GROUPS) throw fail(409, 'too-many-groups', `you can be in at most ${MAX_GROUPS} groups`);
        g.members.push({ uid, joinedAt: new Date(now()).toISOString() });
        save(d);
        try { refreshSummary(uid); } catch { /* shown on the next save */ }
      }
      return view(d, uid).groups.find(x => x.id === g.id);
    },
    /** The group an invite opens, for the join sheet: its name and size, nothing else. */
    peek(inviteCode) {
      const d = load();
      const g = d.groups.find(x => x.invite && x.invite.code === String(inviteCode || '').slice(0, 40) && Date.parse(x.invite.expiresAt) > now());
      if (!g) throw fail(404, 'invite-invalid', 'this invite link has expired or was turned off');
      return { name: g.name, members: g.members.length, owner: nameOf(g.ownerId) };
    },
    leave(uid, groupId) { const d = load(); member(d, groupId, uid); drop(d, uid, groupId); save(d); return view(d, uid); },
    remove(uid, groupId, who) {
      const d = load();
      const g = owner(d, groupId, uid);
      if (who === uid) throw fail(400, 'self', 'leave the group instead');
      if (!g.members.some(m => m.uid === who)) throw fail(404, 'no-member', 'not in this group');
      drop(d, who, groupId);
      save(d);
      return view(d, uid);
    },
    setSharing(uid, groupId, sharing) {
      const d = load();
      member(d, groupId, uid);
      const clean = { ...noSharing(), ...(d.sharing[uid]?.[groupId] || {}) };
      for (const k of SHARE_KEYS) if (typeof sharing?.[k] === 'boolean') clean[k] = sharing[k];
      (d.sharing[uid] ||= {})[groupId] = clean;
      save(d);
      if (!clean.feed) { const items = readFeed(groupId); if (items.some(i => i.uid === uid)) writeFeed(groupId, items.filter(i => i.uid !== uid)); }
      return clean;
    },
    setNudges(uid, on) { const d = load(); d.nudges[uid] = !!on; save(d); return !!on; },
    /** One group's board for a metric: members who share it with this group, and you. */
    leaderboard(uid, { groupId, metric = 'workouts', range } = {}) {
      const d = load();
      const g = member(d, groupId, uid);
      const m = METRICS[metric];
      if (!m) throw fail(400, 'metric', 'unknown metric');
      const r = range && m.ranges[range] ? range : Object.keys(m.ranges)[0];
      const field = m.ranges[r];
      const rows = [];
      for (const { uid: who } of g.members) {
        const self = who === uid;
        const shared = !!d.sharing[who]?.[groupId]?.[m.share];
        if (!shared && !self) continue;
        const sum = readSummary(who) || (self ? refreshSummary(who) : null);
        const value = metric === 'strength' ? sum?.strength?.[field] ?? null : sum?.[field] ?? null;
        if (value == null && !self) continue;
        rows.push({ uid: who, name: nameOf(who), value, ...(m.second && sum ? { second: sum[m.second] ?? null } : {}), self, ...(self ? { shared } : {}) });
      }
      const today = senderDay(uid);
      for (const row of rows) if (!row.self && d.nudgeLog?.[`${uid}|${row.uid}|${today}`]) row.nudged = true;
      return { metric, range: r, members: g.members.length, rows: rankRows(rows) };
    },
    /** A push to a friend in the same group: one a day per friend, NUDGES_PER_DAY a day in all. */
    async nudge(uid, { groupId, to }) {
      const d = load();
      const g = member(d, groupId, uid);
      if (to === uid || !g.members.some(m => m.uid === to)) throw fail(404, 'no-member', 'not in this group');
      if (d.nudges[to] === false) throw fail(409, 'nudges-off', 'they have nudges turned off');
      const today = senderDay(uid);
      const key = `${uid}|${to}|${today}`;
      const log = d.nudgeLog || {};
      if (log[key]) throw fail(429, 'already-nudged', 'you already nudged them today');
      if (Object.keys(log).filter(k => k.startsWith(uid + '|') && k.endsWith('|' + today)).length >= NUDGES_PER_DAY) throw fail(429, 'limit', 'that is enough nudges for today');
      // Keep two days of log: enough for every time zone's "today".
      const cut = now() - 2 * 864e5;
      d.nudgeLog = Object.fromEntries(Object.entries(log).filter(([, at]) => at > cut));
      d.nudgeLog[key] = now();
      save(d);
      const tone = readSummary(to)?.tone || 'friendly';
      const body = nudgeLine(tone, nameOf(uid), Math.floor(now() / 864e5) + to.length);
      if (!hasPush(to)) return { sent: false };
      try { await sendPush(to, { title: "Email\u2019s Gym", body, tag: 'nudge-' + uid, url: '#/friends' }); } catch { return { sent: false }; }
      return { sent: true };
    },
    sharingOf(uid, groupId) { return { ...noSharing(), ...(load().sharing[uid]?.[groupId] || {}) }; },
    nudgesOn: uid => load().nudges[uid] !== false,
    group(groupId) { return load().groups.find(g => g.id === groupId) || null; },
    summary: readSummary,
    refreshSummary,
    /** After a profile's state is saved: only worth the work for someone in a group. */
    onStateWrite(uid, state, prev = null) {
      const d = load();
      const groups = groupsOf(d, uid);
      if (!groups.length) return;
      refreshSummary(uid, state);
      const finished = detectEvents(prev, state, { now: now() }).filter(e => e.type === 'workout.finished');
      if (!finished.length) return;
      for (const g of groups) {
        if (!d.sharing[uid]?.[g.id]?.feed) continue;
        const items = readFeed(g.id);
        const have = new Set(items.map(i => i.id));
        const add = finished.map(e => itemOf(uid, e.data, e.at)).filter(i => !have.has(i.id));
        if (add.length) writeFeed(g.id, [...add, ...items]);
      }
    },
    /** A group's feed, newest first, with names and kudos counts. */
    feed(uid, groupId) {
      const d = load();
      const g = member(d, groupId, uid);
      const members = new Set(g.members.map(m => m.uid));
      return { items: readFeed(groupId).filter(i => members.has(i.uid) && d.sharing[i.uid]?.[groupId]?.feed).slice(0, 50).map(({ kudos = [], ...i }) => ({
        ...i, name: nameOf(i.uid), self: i.uid === uid, kudos: { count: kudos.length, mine: kudos.includes(uid) },
      })) };
    },
    /** Kudos on a friend's item, or taken back. The owner hears of it at most once an hour. */
    async kudos(uid, { groupId, itemId }) {
      const d = load();
      member(d, groupId, uid);
      const items = readFeed(groupId);
      const item = items.find(i => i.id === itemId);
      if (!item) throw fail(404, 'no-item', 'that is no longer in the feed');
      if (item.uid === uid) throw fail(400, 'own', 'not on your own workout');
      const had = (item.kudos || []).includes(uid);
      item.kudos = had ? item.kudos.filter(x => x !== uid) : [...(item.kudos || []), uid];
      writeFeed(groupId, items);
      if (!had && d.nudges[item.uid] !== false && hasPush(item.uid) && !(now() - (d.kudosPush[item.uid] || 0) < KUDOS_PUSH_MS)) {
        d.kudosPush[item.uid] = now();
        save(d);
        try { await sendPush(item.uid, { title: "Email\u2019s Gym", body: `${String(nameOf(uid)).split(/\s+/)[0]} gave you kudos`, tag: 'kudos', url: '#/friends' }); } catch { /* best effort */ }
      }
      return { count: item.kudos.length, mine: !had };
    },
    removeUser(uid) {
      const d = load();
      for (const g of groupsOf(d, uid)) {
        drop(d, uid, g.id);
        const items = readFeed(g.id);
        if (items.length) writeFeed(g.id, items.filter(i => i.uid !== uid).map(i => ({ ...i, kudos: (i.kudos || []).filter(x => x !== uid) })));
      }
      delete d.sharing[uid]; delete d.nudges[uid];
      save(d);
      try { fs.unlinkSync(sumFile(uid)); } catch { /* none */ }
    },
    /** Hourly: a summary from another week, or a day old, is worked out again (a new week resets "this week"). */
    start() {
      if (timer) return;
      timer = setInterval(() => {
        const d = load();
        const uids = new Set(d.groups.flatMap(g => g.members.map(m => m.uid)));
        for (const uid of uids) {
          const s = readSummary(uid);
          if (!s || now() - Date.parse(s.updatedAt) > STALE_MS || s.today !== new Date(now()).toISOString().slice(0, 10)) {
            try { refreshSummary(uid); } catch { /* next hour */ }
          }
        }
      }, TICK_MS);
      timer.unref?.();
    },
    stop() { clearInterval(timer); timer = null; },
  };
}
