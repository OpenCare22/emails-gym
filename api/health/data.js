/* Google Health data, normalised (PLAN.md Phase 4): the app only ever sees these shapes, each
 * value with its day in the person's own time zone and a `source`, so a second provider (Apple
 * Health, Phase 4b) can fill the same fields. Pure, so the tests feed it the API's own JSON.
 *
 *   { steps: { 'YYYY-MM-DD': n }, restingHr: { day: bpm }, sleep: { day: minutesAsleep },
 *     weight: [{ id, at, d, kg }], exercise: [{ id, type, name, start, end, d, minutes, avgHr, kcal, distanceKm, steps }] }
 */
export const SOURCE = 'google';
export const KEEP_DAYS = 120;

const num = v => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const pad = n => String(n).padStart(2, '0');
export const civilDay = c => (c?.date?.year ? `${c.date.year}-${pad(c.date.month)}-${pad(c.date.day)}` : null);
export const dateDay = d => (d?.year ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : null);

export function stepsByDay(rollups) {
  const out = {};
  for (const r of rollups || []) {
    const d = civilDay(r.civilStartTime), n = num(r.steps?.countSum);
    if (d && n != null) out[d] = n;
  }
  return out;
}

export function restingHrByDay(points) {
  const out = {};
  for (const p of points || []) {
    const v = p.dailyRestingHeartRate, d = dateDay(v?.date), bpm = num(v?.beatsPerMinute);
    if (d && bpm) out[d] = bpm;
  }
  return out;
}

export function sleepByDay(points) {
  const out = {};
  for (const p of points || []) {
    const s = p.sleep, d = civilDay(s?.interval?.civilEndTime), min = num(s?.summary?.minutesAsleep);
    // Naps on the same day add to the night.
    if (d && min) out[d] = (out[d] || 0) + min;
  }
  return out;
}

export function weights(points) {
  return (points || []).map(p => {
    const w = p.weight, kg = num(w?.weightGrams);
    const at = w?.sampleTime?.physicalTime;
    const d = civilDay(w?.sampleTime?.civilTime) || (at ? at.slice(0, 10) : null);
    return kg && at && d ? { id: String(p.name || at).slice(-80), at, d, kg: Math.round(kg) / 1000 } : null;
  }).filter(Boolean);
}

export function exercises(points) {
  return (points || []).map(p => {
    const e = p.exercise, i = e?.interval, m = e?.metricsSummary || {};
    if (!i?.startTime || !i?.endTime) return null;
    const minutes = Math.round((Date.parse(i.endTime) - Date.parse(i.startTime)) / 60000);
    return {
      id: String(p.name || i.startTime).slice(-80), type: String(e.exerciseType || 'OTHER').slice(0, 40),
      name: String(e.displayName || e.exerciseType || '').slice(0, 60), start: i.startTime, end: i.endTime,
      d: civilDay(i.civilStartTime) || i.startTime.slice(0, 10), minutes,
      avgHr: num(m.averageHeartRateBeatsPerMinute), kcal: num(m.caloriesKcal) == null ? null : Math.round(num(m.caloriesKcal)),
      distanceKm: num(m.distanceMillimeters) == null ? null : Math.round(num(m.distanceMillimeters) / 10000) / 100,
      steps: num(m.steps),
    };
  }).filter(Boolean);
}

const byId = (list, add) => { const m = new Map(list.map(x => [x.id, x])); for (const x of add) m.set(x.id, x); return [...m.values()]; };

/** The stored data with a fresh pull folded in, older than KEEP_DAYS dropped. */
export function mergeData(old = {}, add = {}, today = new Date().toISOString().slice(0, 10)) {
  const cut = new Date(Date.parse(today + 'T00:00:00Z') - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const keepDays = o => Object.fromEntries(Object.entries(o).filter(([d]) => d >= cut).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    steps: keepDays({ ...(old.steps || {}), ...(add.steps || {}) }),
    restingHr: keepDays({ ...(old.restingHr || {}), ...(add.restingHr || {}) }),
    sleep: keepDays({ ...(old.sleep || {}), ...(add.sleep || {}) }),
    weight: byId(old.weight || [], add.weight || []).filter(w => w.d >= cut).sort((a, b) => (a.at < b.at ? -1 : 1)),
    exercise: byId(old.exercise || [], add.exercise || []).filter(e => e.d >= cut).sort((a, b) => (a.start < b.start ? -1 : 1)),
  };
}

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Pulls everything since `fromDay` (inclusive) to tomorrow with a fresh access token. */
export async function pull(client, access, { fromDay, now = Date.now() }) {
  const toDay = iso(now + 864e5);
  const since = `${fromDay}T00:00:00Z`;
  const [steps, rhr, sleep, weight, exercise] = await Promise.all([
    client.dailyRollUp(access, 'steps', fromDay, toDay),
    client.list(access, 'daily-resting-heart-rate', `daily_resting_heart_rate.date >= "${fromDay}"`, 200),
    client.list(access, 'sleep', `sleep.interval.end_time >= "${since}"`, 25),
    client.list(access, 'weight', `weight.sample_time.physical_time >= "${since}"`, 200),
    client.list(access, 'exercise', `exercise.interval.civil_start_time >= "${fromDay}"`, 25),
  ]);
  return { steps: stepsByDay(steps), restingHr: restingHrByDay(rhr), sleep: sleepByDay(sleep), weight: weights(weight), exercise: exercises(exercise) };
}
