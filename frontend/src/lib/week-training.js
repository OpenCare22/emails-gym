// Home's weekly training chart (DESIGN_PLAN step 5): completed sets on each day of the week `iso`
// falls in, from the logged workouts only. Warm-ups are not counted (they are not training sets),
// and a day with no workout is 0, never a guess. Pure, so it is tested beside it.
import { startOfWeek, isoOf, weekStartOf } from './format.js'
import { workoutDay } from './history.js'
import { isWarmupRow } from './workout-model.js'

/** Completed working sets in one workout. */
export function workoutSets(w) {
  let n = 0
  for (const e of Array.isArray(w?.entries) ? w.entries : []) {
    for (const s of Array.isArray(e?.sets) ? e.sets : []) if (s && s.done && !isWarmupRow(s)) n++
  }
  return n
}

/**
 * The seven days of the week `iso` is in, in the profile's week order:
 * [{ iso, sets, workouts, future }]. `future` is a day after `today`, so it can be drawn as not
 * yet happened rather than as a day without training.
 */
export function weekTraining(S, iso, today = iso) {
  const start = startOfWeek(iso, weekStartOf(S))
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    days.push({ iso: isoOf(d), sets: 0, workouts: 0, future: isoOf(d) > today })
  }
  const byDay = Object.fromEntries(days.map(d => [d.iso, d]))
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    const day = byDay[workoutDay(w)]
    if (!day) continue
    day.workouts++
    day.sets += workoutSets(w)
  }
  return days
}
