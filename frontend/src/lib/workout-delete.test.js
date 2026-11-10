import { describe, expect, it } from 'vitest'
import { deleteWorkout, restoreWorkout, workoutSnapshot } from './workout-delete.js'
import { mergeStates, stampChange } from './sync-merge.js'

const workout = { id: 'w', d: '2026-01-02', start: 100, end: 200, name: 'Push', entries: [{ id: 'bench', sets: [{ w: 50, r: 5, done: true }] }], prs: ['bench'], note: 'Good', media: [{ hash: 'photo' }] }
const state = () => ({ unit: 'kg', workouts: [{ ...workout, id: 'first' }, structuredClone(workout), { ...workout, id: 'last' }], dayNotes: { '2026-01-02': { text: 'Rest' } }, exWeights: { bench: 55 } })

describe('workout deletion and Undo', () => {
  it('restores the complete record in place without rolling back unrelated changes', () => {
    const S = state(), snap = workoutSnapshot(S, workout)
    deleteWorkout(S, workout)
    S.exWeights.bench = 60
    S.dayNotes['2026-01-03'] = { text: 'New note' }
    expect(restoreWorkout(S, snap)).toBe(true)
    expect(S.workouts.map(w => w.id)).toEqual(['first', 'w', 'last'])
    expect(S.workouts[1]).toEqual(workout)
    expect(S.exWeights.bench).toBe(60)
    expect(S.dayNotes['2026-01-03'].text).toBe('New note')
  })
  it('does not duplicate or overwrite a workout restored by sync', () => {
    const S = state(), snap = workoutSnapshot(S, workout)
    S.workouts[1].note = 'Remote edit'
    expect(restoreWorkout(S, snap)).toBe(false)
    expect(S.workouts[1].note).toBe('Remote edit')
    expect(workoutSnapshot(S, { id: 'missing' })).toBeNull()
  })
  it('handles legacy records without ids by day and start', () => {
    const w = { ...workout }; delete w.id
    const S = { workouts: [w, { ...w, start: 300 }] }
    const snap = workoutSnapshot(S, w)
    deleteWorkout(S, w)
    expect(S.workouts).toHaveLength(1)
    restoreWorkout(S, snap)
    expect(S.workouts).toEqual([w, { ...w, start: 300 }])
  })
  it('keeps a deletion deleted, and an Undo restored, through merges in both directions', () => {
    const original = state(), deleted = structuredClone(original)
    const snap = workoutSnapshot(original, workout)
    deleteWorkout(deleted, workout)
    deleted._ts = stampChange(original, deleted, 1000)
    expect(mergeStates(original, deleted).workouts.some(w => w.id === 'w')).toBe(false)
    const restored = structuredClone(deleted)
    restoreWorkout(restored, snap)
    restored._ts = stampChange(deleted, restored, 1001)
    for (const merged of [mergeStates(deleted, restored), mergeStates(restored, deleted)]) {
      expect(merged.workouts.filter(w => w.id === 'w')).toEqual([workout])
    }
  })
  it('converts restored weights if the profile unit changed during the toast', () => {
    const S = state(), snap = workoutSnapshot(S, workout)
    deleteWorkout(S, workout)
    S.unit = 'lb'
    restoreWorkout(S, snap)
    expect(S.workouts[1].entries[0].sets[0].w).toBe(110)
  })
})
