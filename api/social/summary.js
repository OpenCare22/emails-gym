// A person's shared summary (PLAN.md Phase 7): the few numbers friends may see, worked out from
// their own state when it is saved, so leaderboards never read anyone's log. Pure. Each number is
// shown to a group only when the person shares that metric with it (social/index.js).
import { streakOf, weekKey, weekStartOf } from './streak.js';

const LB_KG = 0.45359237;
// Catalogue ids per lift, as frontend/src/lib/strength-level.js STANDARDS.
export const LIFTS = { squat: ['0043', '3593'], bench: ['0025'], deadlift: ['0032', '0117'] };
const TONES = ['friendly', 'guilt', 'drill'];
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const isWarm = s => s?.warmup === true || s?.phase === 'warmup';
const isISO = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** 'YYYY-MM-DD' for `now` in time zone `tz` (UTC when unknown). */
export function dayIn(now, tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }
  catch { return new Date(now).toISOString().slice(0, 10); }
}
const daysBefore = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);

function latestBodyKg(S, toKg) {
  const days = (Array.isArray(S?.bodyweight) ? S.bodyweight : []).filter(b => b && isISO(b.d) && num(b.w) > 0);
  if (!days.length) return null;
  return toKg(num(days.reduce((a, b) => (a.d >= b.d ? a : b)).w));
}

/** steps/activeMinutes: { 'YYYY-MM-DD': n } from the person's health data (Google, then Apple). */
export function summaryOf(S, { now = Date.now(), health = {} } = {}) {
  const tz = S?.reminder?.tz || null;
  const today = dayIn(now, tz);
  const ws = weekStartOf(S);
  const week = weekKey(today, ws);
  const month = today.slice(0, 7);
  const toKg = S?.unit === 'lb' ? v => v * LB_KG : v => v;
  const workouts = (Array.isArray(S?.workouts) ? S.workouts : []).filter(w => w && isISO(w.d) && w.d <= today);
  let workoutsWeek = 0, workoutsMonth = 0, volumeWeekKg = 0, volumeMonthKg = 0, prsMonth = 0, prsAll = 0;
  const since90 = daysBefore(today, 90);
  const best = { squat: 0, bench: 0, deadlift: 0 };
  for (const w of workouts) {
    const inWeek = weekKey(w.d, ws) === week, inMonth = w.d.slice(0, 7) === month;
    if (inWeek) workoutsWeek++;
    const prs = Array.isArray(w.prs) ? w.prs.length : 0;
    prsAll += prs;
    if (inMonth) { workoutsMonth++; prsMonth += prs; }
    for (const e of Array.isArray(w.entries) ? w.entries : []) {
      for (const s of Array.isArray(e?.sets) ? e.sets : []) {
        if (!s || isWarm(s) || s.done === false) continue;
        const kg = toKg(num(s.w)), r = num(s.r);
        if (kg > 0 && r > 0) {
          const v = kg * r;
          if (inWeek) volumeWeekKg += v;
          if (inMonth) volumeMonthKg += v;
          if (w.d >= since90 && r <= 10) {
            for (const [lift, ids] of Object.entries(LIFTS)) if (ids.includes(String(e.id))) best[lift] = Math.max(best[lift], kg * (1 + r / 30));
          }
        }
      }
    }
  }
  const body = latestBodyKg(S, toKg);
  const ratio = v => (body && v > 0 ? Math.round((v / body) * 100) / 100 : null);
  const sumWeek = byDay => {
    let n = 0, any = false;
    for (const [d, v] of Object.entries(byDay || {})) if (isISO(d) && d <= today && weekKey(d, ws) === week && Number.isFinite(v)) { n += v; any = true; }
    return any ? Math.round(n) : null;
  };
  const streak = streakOf(S, today);
  return {
    week, today,
    workoutsWeek, workoutsMonth, workoutsAll: workouts.length,
    streakWeeks: streak.current, bestStreakWeeks: streak.best,
    volumeWeekKg: Math.round(volumeWeekKg), volumeMonthKg: Math.round(volumeMonthKg), prsMonth, prsAll,
    stepsWeek: sumWeek(health.steps), activeMinutesWeek: sumWeek(health.activeMinutes),
    strength: { squat: ratio(best.squat), bench: ratio(best.bench), deadlift: ratio(best.deadlift) },
    tone: TONES.includes(S?.reminder?.tone) ? S.reminder.tone : 'friendly',
    // The card background they picked (frontend/src/lib/trophies.js); the app checks they unlocked it.
    card: typeof S?.socialCard === 'string' && /^[a-z-]{1,20}$/.test(S.socialCard) ? S.socialCard : null,
  };
}
