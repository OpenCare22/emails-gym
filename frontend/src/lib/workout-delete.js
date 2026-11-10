import { entryKey, inUnitOf } from './sync-merge.js'

const key = w => entryKey('workouts', w)

// Snapshot only the removed record, so Undo never rolls back other work.
export function workoutSnapshot(S, workout) {
  const index = (S.workouts || []).findIndex(w => key(w) === key(workout))
  if (index < 0) return null
  return { workout: structuredClone(S.workouts[index]), index, unit: S.unit }
}

export function deleteWorkout(S, workout) {
  S.workouts = (S.workouts || []).filter(w => key(w) !== key(workout))
}

export function restoreWorkout(S, snap) {
  if (!snap?.workout || (S.workouts || []).some(w => key(w) === key(snap.workout))) return false
  const restored = inUnitOf({ unit: snap.unit, workouts: [structuredClone(snap.workout)], exUnit: S.exUnit }, S).workouts[0]
  S.workouts = [...(S.workouts || [])]
  S.workouts.splice(Math.min(snap.index, S.workouts.length), 0, restored)
  return true
}
