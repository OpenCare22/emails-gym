// The running workout's side of easing back in and "How did that feel?"
// (docs/superpowers/specs/2026-11-11-return-and-feel-design.md). The rules themselves live in
// return-break.js and progression.js; this only decides when the workout asks and rebuilds its
// entries when you switch between the eased plan and your usual one.
import { buildPlannedEntry, builtOutOfProgression } from './session-start.js'
import { sessionHistory } from './backfill.js'
import { modeOf } from './history.js'
import { isWarmupRow } from './workout-model.js'

const loggedRow = x => x.done || x.sides?.L?.done || x.sides?.R?.done

/** Whether the feel row shows under this entry: its planned work sets are all done. */
export function feelAsked(entry) {
  const plan = entry?.plan
  if (!plan || plan.kind === 'off' || plan.policy === 'off') return false
  if (modeOf({ ...(entry.target || {}), id: entry.id }) === 'cardio') return false
  const work = (entry.sets || []).filter(s => !isWarmupRow(s))
  const planned = Math.max(1, entry.target?.sets || work.length)
  return work.length >= planned && work.slice(0, planned).every(s => s.done)
}

/** The days the return note names: the longest break among the eased entries. */
export function returnDays(active) {
  const eased = (active?.entries || []).map(e => e?.back?.days || 0)
  return Math.max(0, active?.usualPlan?.days || 0, ...eased)
}

/** Whether the workout shows the return note at all. */
export const showsReturnNote = active => !!active && !active.backfill && active.editingWorkoutId == null
  && (!!active.usualPlan || (active.entries || []).some(e => e?.back))

/**
 * Switch the running workout (a draft of the state) to your usual plan (`on`) or back to easing
 * in. Only open rows change: logged warm-ups and sets stay as they were, in place, the way an
 * exercise's settings rebuild them (views/Workout.jsx). The choice is this workout's only.
 */
export function setUsualPlan(s, on) {
  const A = s.active
  if (!A) return
  const days = returnDays(A)
  if (on) A.usualPlan = { days }
  else delete A.usualPlan
  const past = sessionHistory(s)
  A.entries.forEach(entry => {
    if (!entry?.rid || (on && !entry.back)) return
    const work = entry.sets.filter(x => !isWarmupRow(x))
    if (!on && work.length && work.every(loggedRow)) return
    const routine = (s.routines || []).find(r => r.id === entry.rid)
    const cfg = routine?.ex?.find(c => c?.id === entry.id)
    if (!cfg) return
    const built = buildPlannedEntry(past, cfg, routine, { noProg: builtOutOfProgression(entry, routine), noEase: on })
    if (!on && !built.back) return
    const doneWarm = entry.sets.filter(x => loggedRow(x) && isWarmupRow(x))
    const doneWork = entry.sets.filter(x => loggedRow(x) && !isWarmupRow(x))
    const freshWarm = built.sets.filter(isWarmupRow)
    const freshWork = built.sets.filter(x => !isWarmupRow(x))
    entry.target = built.target
    entry.plan = built.plan
    entry.planned = built.planned
    if (built.back) entry.back = built.back
    else delete entry.back
    entry.sets = [...doneWarm, ...freshWarm.slice(doneWarm.length), ...doneWork, ...freshWork.slice(doneWork.length)]
  })
}
