// Simple mode (docs/superpowers/specs/2026-11-12-simple-mode-design.md): a notebook page per day.
//
// A day's log is an ordinary workout record, marked `log: 'day'`, so everything the full app reads
// (History, Progress, records, the sync) sees it as the workout it is. There is no Start and no
// Finish: the record is written as the sets are, created with the first set and removed with the
// last. Only sets with something logged are kept, and each is `done`, the way a finished session
// files them. An exercise added but not yet logged lives on the Today screen, not here.
//
// Every helper that changes a day takes a state draft (useStore.update) and mutates it.
import { bestWeightForEntry, defaultConfig, lastEntryFor, modeOf, workoutDay, workoutVolume } from './history.js'
import { insertChronological } from './backfill.js'
import { rebuildPrHistory } from './workout-date.js'
import { stampWorkout } from './sync-merge.js'
import { beatsWeight } from './exercises.js'
import { todayISO, uid } from './format.js'

export const DAY_LOG = 'day'

// ---- The mode ---------------------------------------------------------------------------------

/** 'simple' or 'full'. Not chosen yet reads as full: nothing changes for a profile until it says so. */
export const appModeOf = S => (S?.appMode === 'simple' ? 'simple' : 'full')
export const isSimple = S => appModeOf(S) === 'simple'

/**
 * Whether the first-run question is due: nothing chosen and nothing logged or planned yet. A
 * profile that already has workouts or routines is someone using the full app, never asked.
 */
export function needsModeChoice(S) {
  if (!S || S.appMode === 'simple' || S.appMode === 'full' || S.active) return false
  return !(Array.isArray(S.workouts) && S.workouts.length) && !(Array.isArray(S.routines) && S.routines.length)
}

// ---- Reading a day ----------------------------------------------------------------------------

const list = S => (Array.isArray(S?.workouts) ? S.workouts : [])

/** The day log of `iso`, or null. */
export const dayLogOf = (S, iso) => list(S).find(w => w?.log === DAY_LOG && workoutDay(w) === iso) || null

/** Workouts of `iso` that are not its day log: sessions finished in the full app, shown read-only. */
export const otherWorkoutsOn = (S, iso) => list(S).filter(w => w?.log !== DAY_LOG && workoutDay(w) === iso)

/** Days with any workout before `iso`, newest first, each with its workouts: Today's "Earlier" list. */
export function earlierDays(S, iso, n = 5) {
  const by = new Map()
  for (const w of list(S)) {
    const d = workoutDay(w)
    if (!d || d >= iso) continue
    if (!by.has(d)) by.set(d, [])
    by.get(d).push(w)
  }
  return [...by.keys()].sort().reverse().slice(0, n).map(d => ({ d, workouts: by.get(d) }))
}

/** How an exercise is logged here: 'reps' (kg × reps), 'time' (seconds, optional kg) or 'cardio' (minutes). */
export const logModeOf = (id, target) => modeOf(target || defaultConfig(id))

/** Whether a set has anything in it worth keeping. */
export function hasValue(set, mode) {
  const n = v => Number(v) > 0
  if (mode === 'cardio') return n(set?.min)
  if (mode === 'time') return n(set?.sec)
  return n(set?.r)
}

/**
 * Last time this exercise was done before `iso`, in any workout: { d, sets } or null. Reads the
 * history as it stood that day, so filling in last Monday shows the session before it.
 */
export function lastTimeFor(S, id, iso) {
  const before = list(S).filter(w => { const d = workoutDay(w); return d && d < iso })
  return lastEntryFor({ ...S, workouts: before, lastFrom: 'any' }, id, null)
}

/** What the next set row starts from: the last set logged today, else the first set last time. */
export function nextSetFor(S, iso, id) {
  const mode = logModeOf(id)
  const today = dayLogOf(S, iso)?.entries?.find(e => e.id === id)
  const prev = today?.sets?.[today.sets.length - 1] || lastTimeFor(S, id, iso)?.sets?.[0] || null
  return blankSet(mode, prev)
}

function blankSet(mode, prev) {
  if (mode === 'cardio') return { min: prev?.min ?? null }
  if (mode === 'time') return { sec: prev?.sec ?? null, w: prev?.w ?? null }
  return { r: prev?.r ?? null, w: prev?.w ?? null }
}

// ---- Writing a day ----------------------------------------------------------------------------

// Only the fields of the mode, as numbers, and done: what a finished session files.
function cleanSet(set, mode) {
  const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)
  if (mode === 'cardio') return { min: num(set.min), done: true }
  if (mode === 'time') return { sec: num(set.sec), w: num(set.w), done: true }
  return { w: num(set.w), r: num(set.r), done: true }
}

const noonOf = iso => new Date(iso + 'T12:00:00').getTime()

function freshLog(iso, now) {
  const start = iso === todayISO() ? now : noonOf(iso)
  return { id: uid(), d: iso, start, end: start, routineIds: [], routineId: null, name: 'Workout', bw: null, entries: [], prs: [], log: DAY_LOG }
}

// After a change to `w`: its numbers, its stamp for the sync, the records of `ids`, and the best
// weights the full app's progression starts from, raised the way finishing a session raises them.
function settle(s, w, ids, now) {
  for (const e of w.entries) e.topW = bestWeightForEntry(e) || null
  w.vol = workoutVolume(w)
  if (w.d === todayISO()) w.end = Math.max(w.start, now)
  stampWorkout(w, now)
  s.workouts = rebuildPrHistory(s.workouts, ids, w)
  s.exWeights = s.exWeights && typeof s.exWeights === 'object' ? s.exWeights : {}
  for (const e of w.entries) {
    if (!ids.includes(e.id)) continue
    const mx = e.topW || 0
    if (beatsWeight(e.id, mx, (s.exWeights[e.id] || {}).w || 0)) s.exWeights[e.id] = { w: mx, d: w.d }
  }
}

// The day log of `iso` in the draft as a fresh copy the draft owns, or null.
function ownLog(s, iso) {
  const i = (s.workouts || []).findIndex(w => w?.log === DAY_LOG && workoutDay(w) === iso)
  if (i < 0) return null
  const w = { ...s.workouts[i], entries: s.workouts[i].entries.map(e => ({ ...e, sets: [...e.sets] })) }
  s.workouts = [...s.workouts]
  s.workouts[i] = w
  return w
}

/** Log one set of `id` on `iso`. Creates the day and the exercise as needed. Returns false for an empty set. */
export function addSet(s, iso, id, set, now = Date.now()) {
  const mode = logModeOf(id)
  if (!hasValue(set, mode)) return false
  let w = ownLog(s, iso)
  if (!w) {
    w = freshLog(iso, now)
    s.workouts = insertChronological(Array.isArray(s.workouts) ? s.workouts : [], w)
  }
  let e = w.entries.find(x => x.id === id)
  if (!e) { e = { id, sets: [], topW: null, target: defaultConfig(id) }; w.entries.push(e) }
  e.sets.push(cleanSet(set, mode))
  settle(s, w, [id], now)
  return true
}

/** Change set `idx` of `id` on `iso`. A set changed to nothing is removed. */
export function updateSet(s, iso, id, idx, patch, now = Date.now()) {
  const w = ownLog(s, iso)
  const e = w?.entries.find(x => x.id === id)
  if (!e || !e.sets[idx]) return false
  const mode = logModeOf(id, e.target)
  const next = { ...e.sets[idx], ...patch }
  if (!hasValue(next, mode)) return removeSet(s, iso, id, idx, now)
  e.sets[idx] = cleanSet(next, mode)
  settle(s, w, [id], now)
  return true
}

/** Remove set `idx` of `id` on `iso`; the exercise goes with its last set, the day with its last exercise. */
export function removeSet(s, iso, id, idx, now = Date.now()) {
  const w = ownLog(s, iso)
  const e = w?.entries.find(x => x.id === id)
  if (!e || !e.sets[idx]) return false
  e.sets.splice(idx, 1)
  if (!e.sets.length) w.entries = w.entries.filter(x => x !== e)
  if (!w.entries.length) { s.workouts = s.workouts.filter(x => x !== w); s.workouts = rebuildPrHistory(s.workouts, [id]); return true }
  settle(s, w, [id], now)
  return true
}

/** Remove every set of `id` on `iso`. */
export function removeExercise(s, iso, id, now = Date.now()) {
  const w = ownLog(s, iso)
  if (!w || !w.entries.some(x => x.id === id)) return false
  w.entries = w.entries.filter(x => x.id !== id)
  if (!w.entries.length) { s.workouts = s.workouts.filter(x => x !== w); s.workouts = rebuildPrHistory(s.workouts, [id]); return true }
  settle(s, w, [id], now)
  return true
}

// ---- The picker's own list ----------------------------------------------------------------------

/**
 * The exercises this person does, for the top of the picker: favourites first, then everything
 * logged, most recent first. Each id once.
 */
export function yourExercises(S) {
  const fav = Array.isArray(S?.favEx) ? S.favEx : []
  const seen = new Set(fav)
  const out = [...fav]
  const ws = [...list(S)].sort((a, b) => String(workoutDay(b)).localeCompare(String(workoutDay(a))))
  for (const w of ws) for (const e of w.entries || []) {
    if (e?.id == null || seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e.id)
  }
  return out
}
