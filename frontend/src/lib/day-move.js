// Moving a planned session to another date, for this date only (Home's week strip, the day
// sheet's "Move to another day"). It writes the per-date override `S.dayPlan`, the same field
// the day sheet's own picks write, so the routine keeps its weekday and sync sees an ordinary
// edit. `dayPlan[iso]` holds one routine id or 'rest', so only a day with exactly one routine
// moves; a combined day keeps its sheet. Past days and days already trained neither give nor
// take a session: a move never makes a day missed, and never rewrites one that is done.
// In rotation mode order decides, not weekdays, so nothing moves.
import { effectiveRoutineIds } from './history.js'
import { scheduleModeOf } from './rotation.js'

const done = (S, iso) => (S.workouts || []).some(w => w?.d === iso)
const weekdayOf = iso => new Date(iso + 'T12:00:00').getDay()
// What the weekday alone plans for a date: existing routines only.
const weekdayIds = (S, iso) => [].concat(S.week?.[weekdayOf(iso)] || []).filter(id => (S.routines || []).some(r => r.id === id))

/** A session on `iso` that can be picked up and moved. */
export function canMoveFrom(S, iso, today) {
  if (scheduleModeOf(S) === 'rotation') return false
  if (iso < today || done(S, iso)) return false
  return effectiveRoutineIds(S, iso).length === 1
}

/** `to` takes the session from `from` (a swap when `to` has one of its own). */
export function canMoveTo(S, from, to, today) {
  if (to === from || to < today || done(S, to)) return false
  const there = effectiveRoutineIds(S, to)
  // Swapping a session with the same routine changes nothing.
  return there.length === 0 || (there.length === 1 && there[0] !== effectiveRoutineIds(S, from)[0])
}

// The override for `iso` that makes it plan `value` (a routine id or 'rest'), or undefined when
// the weekday already plans exactly that.
function overrideFor(S, iso, value) {
  const wk = weekdayIds(S, iso)
  if (value === 'rest' ? wk.length === 0 : wk.length === 1 && wk[0] === value) return undefined
  return value
}

/** Moves (or swaps) in a state draft. Returns the two previous dayPlan values for undoMove. */
export function moveSession(s, from, to) {
  if (!s.dayPlan) s.dayPlan = {}
  const before = { [from]: s.dayPlan[from], [to]: s.dayPlan[to] }
  const moving = effectiveRoutineIds(s, from)[0]
  const other = effectiveRoutineIds(s, to)[0] ?? 'rest'
  const set = (iso, v) => { const o = overrideFor(s, iso, v); if (o === undefined) delete s.dayPlan[iso]; else s.dayPlan[iso] = o }
  set(to, moving)
  set(from, other)
  return { before }
}

/** Puts both days back as they were before the move. */
export function undoMove(s, before) {
  if (!s.dayPlan) s.dayPlan = {}
  for (const [iso, v] of Object.entries(before || {})) {
    if (v === undefined) delete s.dayPlan[iso]
    else s.dayPlan[iso] = v
  }
}
