// One exercise added to the session in progress from outside the workout screen (the library's
// "Add to today's workout"), built the way the workout screen's own freestyle add builds it:
// last time's numbers carried forward (lib/history.js freestyleConfig), at the end of the session.
import { freestyleConfig, pickedExerciseConfig } from './history.js'
import { buildSessionEntry } from './session-start.js'
import { joinSessionNoProg } from './session-noprog.js'

/** Appends `exId` to `s.active` in a state draft. No session, nothing happens. */
export function appendExercise(s, exId) {
  if (!s?.active || !exId) return
  const cfg = freestyleConfig(s, { id: exId, ...pickedExerciseConfig(exId) })
  const built = buildSessionEntry(s, exId, cfg, null, null)
  s.active.entries.push(joinSessionNoProg(s.active, { id: exId, ...built }))
}
