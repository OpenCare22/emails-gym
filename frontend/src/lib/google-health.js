// Google Health (Fitbit) in the app (PLAN.md Phase 4; the server side is api/health/). The server
// holds the connection and the data; the app reads it from /api/google-health, keeps a copy in
// localStorage so Home shows numbers at once, asks for a sync when the last one is over 30
// minutes old, and copies Fitbit weigh-ins into the weight chart (a day you weighed in by hand
// keeps yours). Pure helpers first, each with a test; the small store below them does the I/O.
import { create } from 'zustand'
import { api } from './api.js'
import { mergeHeartRate } from './health-read.js'
import { addWeighIn } from './weigh-ins.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { lastBW } from './history.js'
import { t } from './i18n.js'

export const SRC = 'google'
export const STALE_MS = 30 * 60 * 1000
const CACHE = 'gym_ghealth_v1'
let generation = 0

const EXERCISE_IDS = { RUNNING: '0685', WALKING: '2258', HIKING: '2258', BIKING: '5214', ELLIPTICAL: '2192', ROWING: '1161', SWIMMING: '6944' }
const STRENGTH_TYPES = new Set(['FREE_WEIGHTS', 'FUNCTIONAL_STRENGTH_TRAINING', 'CIRCUIT_TRAINING'])
const exerciseTime = value => typeof value === 'number' ? value : Date.parse(value)

/** Today and the six preceding calendar days, with explicit import consent only. */
export function importableExercises(S, exercises, { today }) {
  const cutoff = new Date(Date.parse(today + 'T12:00:00Z') - 6 * 864e5).toISOString().slice(0, 10)
  const seen = new Set(S.ghDismissed || [])
  const workouts = S.workouts || []
  for (const w of workouts) if (w.src?.gh) seen.add(w.src.gh)
  return (exercises || []).filter(e => {
    if (!e?.id || seen.has(e.id) || STRENGTH_TYPES.has(e.type) || !e.d || e.d < cutoff || e.d > today) return false
    const start = exerciseTime(e.start), end = exerciseTime(e.end)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !(e.minutes > 0)) return false
    if (workouts.some(w => Math.min(end, exerciseTime(w.end)) - Math.max(start, exerciseTime(w.start)) > (end - start) / 2)) return false
    seen.add(e.id)
    return true
  }).sort((a, b) => exerciseTime(b.start) - exerciseTime(a.start)).slice(0, 3)
}

/** Dismissals sync as one setting; retain the 200 most recently dismissed ids. */
export function dismissExercise(S, id) {
  S.ghDismissed = [...(S.ghDismissed || []).filter(old => old !== id), id].slice(-200)
}

/** Use the same persisted boundary as a session finished in the app. */
export function workoutFromExercise(e, S) {
  const start = exerciseTime(e.start), end = exerciseTime(e.end)
  // Logged speeds are canonical km/h (lib/speed.js); history converts for the profile.
  const speed = e.distanceKm > 0 && e.minutes > 0 ? e.distanceKm * 60 / e.minutes : 0
  const workout = buildCompletedWorkout({
    id: `gh:${e.id}`, d: e.d, start, name: e.name || t('Workout'), bw: S.bodyweight?.length ? lastBW(S).w : null,
    entries: [{ id: EXERCISE_IDS[e.type] || '2258', sets: [{ min: e.minutes, speed, done: true, at: end }] }],
  }, { end })
  return { ...workout, src: { gh: e.id }, ...(e.avgHr ? { hr: { avg: e.avgHr, src: 'gh', n: 0 } } : {}) }
}

/** Daily Google values take precedence; readings keep provider-specific identities. */
export function mergeHealthData(google = {}, apple = {}) {
  const data = { sources: {} }
  for (const key of ['steps', 'activeMinutes', 'restingHr', 'sleep', 'activeEnergy']) {
    data[key] = { ...apple[key], ...google[key] }
    data.sources[key] = Object.fromEntries(Object.keys(data[key]).map(d => [d, Object.hasOwn(google[key] || {}, d) ? 'google' : 'apple']))
  }
  data.weight = [...(apple.weight || []).map(w => ({ ...w, src: 'apple' })), ...(google.weight || [])].sort((a, b) => a.at.localeCompare(b.at))
  data.exercise = [...(apple.exercise || []), ...(google.exercise || [])].sort((a, b) => a.start.localeCompare(b.start))
  return data
}

/** Retry Apple samples on each new load because exports can arrive after the session ends. */
export function fillAppleHeartRate(S, data, now = Date.now()) {
  const samples = (data?.exercise || []).flatMap(e => e.hrSamples || [])
  for (const w of S.workouts || []) {
    if (w.start >= now - 14 * 864e5 && w.end > w.start && w.end <= now && (!w.hr || w.hr.src === 'apple')) {
      mergeHeartRate(S, w.id, samples.filter(p => p.t >= w.start - 120000 && p.t <= w.end + 120000), 'apple', now)
    }
  }
}

/** Steps on a day ('YYYY-MM-DD'), or null. */
export const stepsOn = (data, d) => (data?.steps && Number.isFinite(data.steps[d]) ? data.steps[d] : null)

/** The newest resting heart rate: { bpm, d }, or null. */
export function latestRestingHr(data) {
  const days = Object.keys(data?.restingHr || {}).sort()
  const d = days.at(-1)
  return d ? { bpm: data.restingHr[d], d } : null
}

/** Average steps over the 7 days before `today`, for a quiet comparison; null with under 3 days. */
export function weekAverageSteps(data, today) {
  const t = Date.parse(today + 'T12:00:00Z')
  const vals = []
  for (let i = 1; i <= 7; i++) { const v = stepsOn(data, new Date(t - i * 864e5).toISOString().slice(0, 10)); if (v != null) vals.push(v) }
  return vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

const localTime = iso => { const dt = new Date(iso); return Number.isNaN(dt) ? null : `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` }

/**
 * Adds the Fitbit weigh-ins S doesn't have yet (S mutated, profile unit), skipping any day with a
 * reading typed in by hand. Returns how many were added.
 */
export function applyWeighIns(S, weights, kgToUnit = kg => (S.unit === 'lb' ? kg / 0.45359237 : kg)) {
  if (!Array.isArray(weights) || !weights.length) return 0
  const days = Array.isArray(S.bodyweight) ? S.bodyweight : []
  const seen = new Set(), manual = new Set()
  for (const day of days) {
    for (const r of day?.ins || []) { if (r.sid) seen.add(r.sid); if (!r.src) manual.add(day.d) }
    if (!day?.ins && day?.d && !day.src) manual.add(day.d)
  }
  let added = 0
  for (const w of weights) {
    if (!w?.id || seen.has(w.id) || manual.has(w.d)) continue
    if (addWeighIn(S, { d: w.d, at: localTime(w.at), w: kgToUnit(w.kg), t: Date.parse(w.at) || Date.now(), src: w.src || SRC, sid: w.id })) { added++; seen.add(w.id) }
  }
  return added
}

/** Fill recent finished sessions, mutating S; getSamples receives millisecond bounds. */
export async function fillWorkoutHeartRate(S, getSamples, { now = Date.now(), tried = [] } = {}) {
  const seen = new Set(tried), ids = []
  const workouts = (S?.workouts || []).filter(w => w?.id && !seen.has(w.id) && !w.hr &&
    Number(w.start) > 0 && Number(w.start) >= now - 14 * 864e5 && Number(w.end) > Number(w.start) && Number(w.end) <= now)
    .sort((a, b) => Number(b.start) - Number(a.start)).slice(0, 5)
  for (const w of workouts) {
    ids.push(w.id)
    const samples = await getSamples(Number(w.start) - 120000, Number(w.end) + 120000)
    mergeHeartRate(S, w.id, samples, 'gh', now)
  }
  return ids
}

async function fillStoredHeartRate() {
  const { useStore } = await import('../store/useStore.js')
  const { S, user } = useStore.getState()
  if (!user?.id || !S?.workouts?.length) return
  const key = `${CACHE}_hr_${user.id}`
  let tried = []
  try { const saved = JSON.parse(localStorage.getItem(key)); if (Array.isArray(saved)) tried = saved } catch { /* private mode */ }
  const copy = structuredClone(S), readings = []
  const ids = await fillWorkoutHeartRate(copy, async (start, end) => {
    const q = new URLSearchParams({ start: new Date(start).toISOString(), end: new Date(end).toISOString() })
    const { samples } = await api(`/api/google-health/heart-rate?${q}`)
    readings.push(samples)
    return samples
  }, { tried })
  if (useStore.getState().user?.id !== user.id) return
  if (ids.length) {
    useStore.getState().update(state => {
      ids.forEach((id, i) => {
        if (!state.workouts?.find(w => w.id === id)?.hr) mergeHeartRate(state, id, readings[i], 'gh')
      })
    })
    try { localStorage.setItem(key, JSON.stringify([...new Set([...tried, ...ids])])) } catch { /* private mode */ }
  }
}

function cached() {
  try { return JSON.parse(localStorage.getItem(CACHE)) || null } catch { return null }
}

export const useGoogleHealth = create((set, get) => ({
  info: cached(), // the last /api/google-health answer
  busy: false,
  error: null,
  async load({ sync = 'auto' } = {}, onWeights) {
    if (get().busy) return get().info
    const current = generation
    set({ busy: true, error: null })
    try {
      const [g, a] = await Promise.allSettled([api('/api/google-health'), api('/api/apple-health')])
      if (current !== generation) return null
      if (g.status === 'rejected' && a.status === 'rejected') throw g.reason
      let info = g.status === 'fulfilled' ? g.value || {} : { connected: false }
      const apple = a.status === 'fulfilled' ? a.value : null
      const failed = [g, a].find(r => r.status === 'rejected')
      if (failed) set({ error: failed.reason?.message || String(failed.reason) })
      const stale = info.connected && info.status !== 'reconnect' && (!info.lastSync || Date.now() - Date.parse(info.lastSync) > STALE_MS)
      if (info.connected && (sync === 'now' || (sync === 'auto' && stale))) {
        try { info = await api('/api/google-health/sync', { method: 'POST', timeout: 60000 }) }
        catch (e) { info = await api('/api/google-health').catch(() => info); set({ error: e?.message || String(e) }) }
      }
      if (current !== generation) return null
      info = { ...info, googleData: info.data, apple, anyConnected: !!(info.connected || apple?.connected), data: mergeHealthData(info.data, apple?.data) }
      try { localStorage.setItem(CACHE, JSON.stringify(info)) } catch { /* private mode */ }
      set({ info })
      if (info?.data?.weight?.length && onWeights) onWeights(info.data.weight)
      if (apple?.connected && apple.data?.exercise?.length) {
        const { useStore } = await import('../store/useStore.js')
        if (current !== generation) return null
        useStore.getState().update(s => { fillAppleHeartRate(s, apple.data) })
      }
      if (info.connected && info.status === 'ok') {
        try { await fillStoredHeartRate() } catch (e) { set({ error: e?.message || String(e) }) }
      }
      return info
    } catch (e) {
      if (current === generation) set({ error: e?.message || String(e) })
      return get().info
    } finally { if (current === generation) set({ busy: false }) }
  },
  async disconnect() {
    await api('/api/google-health/disconnect', { method: 'POST' })
    generation++
    set({ busy: false })
    try { localStorage.removeItem(CACHE) } catch { /* fine */ }
    const apple = get().info?.apple
    set({ info: { available: true, connected: false, apple, anyConnected: !!apple?.connected, data: mergeHealthData({}, apple?.data) } })
  },
  clear() { generation++; try { localStorage.removeItem(CACHE) } catch { /* fine */ } set({ info: null, busy: false, error: null }) },
}))
