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
import { summaryOf } from './summary.js';

export const SHARE_KEYS = ['workouts', 'streak', 'volume', 'prs', 'steps', 'activeMinutes', 'strength', 'feed'];
export const MAX_MEMBERS = 12;
export const MAX_GROUPS = 5;
export const INVITE_DAYS = 14;
const TICK_MS = 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const safeId = uid => String(uid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
export const noSharing = () => Object.fromEntries(SHARE_KEYS.map(k => [k, false]));

export function createSocial({ dataDir, now = Date.now, readState = () => null, healthOf = () => ({}), nameOf = uid => uid }) {
  const dir = path.join(dataDir, 'social');
  const file = path.join(dir, 'social.json');
  const sumFile = uid => path.join(dir, 'summaries', safeId(uid) + '.json');
  const joins = createWindow({ max: 10, windowMs: 60 * 60 * 1000, now });

  const blank = () => ({ groups: [], sharing: {}, nudges: {} });
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
      return clean;
    },
    setNudges(uid, on) { const d = load(); d.nudges[uid] = !!on; save(d); return !!on; },
    sharingOf(uid, groupId) { return { ...noSharing(), ...(load().sharing[uid]?.[groupId] || {}) }; },
    nudgesOn: uid => load().nudges[uid] !== false,
    group(groupId) { return load().groups.find(g => g.id === groupId) || null; },
    summary: readSummary,
    refreshSummary,
    /** After a profile's state is saved: only worth the work for someone in a group. */
    onStateWrite(uid, state) { if (inAnyGroup(uid)) refreshSummary(uid, state); },
    removeUser(uid) {
      const d = load();
      for (const g of groupsOf(d, uid)) drop(d, uid, g.id);
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
