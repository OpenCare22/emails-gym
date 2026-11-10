// The week streak, hand-copied from frontend/src/lib/streak.js (the API image cannot import the
// frontend). Same rules: weeks in a row with a workout, a freeze earned every 4th trained week (at
// most 2 banked), a missed week uses a freeze or ends the run, this week still open. Change both
// files together: api/test/social-streak-parity.test.js runs both on the same fixtures.
export const FREEZE_EVERY = 4;
export const FREEZE_MAX = 2;
const MAX_WEEKS = 1500;
const MONDAY = 1, SUNDAY = 0;

const isISO = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const weekStartOf = S => (S?.weekStart === SUNDAY ? SUNDAY : MONDAY);
const offset = (day, ws) => (day - ws + 7) % 7;
/** The first day of the week `iso` falls in ('YYYY-MM-DD'), noon-local so DST cannot shift it. */
export function weekKey(iso, ws = MONDAY) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - offset(d.getDay(), ws));
  return isoOf(d);
}
const plusWeek = (iso, n = 1) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 7 * n); return isoOf(d); };

/** { current, best } weeks, as of `today` ('YYYY-MM-DD' in the person's own time zone). */
export function streakOf(S, today) {
  const ws = weekStartOf(S);
  const cur = weekKey(today, ws);
  const trained = new Set();
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w || !isISO(w.d)) continue;
    const k = weekKey(w.d, ws);
    if (k <= cur) trained.add(k);
  }
  if (!trained.size) return { current: 0, best: 0 };
  let wk = [...trained].sort()[0];
  const floor = plusWeek(cur, -MAX_WEEKS);
  if (wk < floor) wk = floor;
  let run = 0, best = 0, freezes = 0, earned = 0;
  for (let i = 0; i <= MAX_WEEKS && wk <= cur; i++, wk = plusWeek(wk)) {
    if (trained.has(wk)) {
      run++;
      earned++;
      if (earned % FREEZE_EVERY === 0 && freezes < FREEZE_MAX) freezes++;
    } else if (wk !== cur) {
      if (freezes > 0) freezes--; else { run = 0; earned = 0; freezes = 0; }
    }
    if (run > best) best = run;
  }
  return { current: run, best };
}
