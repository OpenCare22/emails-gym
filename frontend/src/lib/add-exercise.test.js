import { describe, expect, it } from 'vitest'
import { appendExercise } from './add-exercise.js'
import { workoutCountOf } from './favourites.js'

const base = over => ({ unit: 'kg', routines: [], workouts: [], exWeights: {}, active: null, ...over })

describe('appendExercise', () => {
  it('adds a freestyle entry at the end of the session', () => {
    const s = base({ active: { id: 'a', d: '2026-11-12', start: 1, routineIds: [], name: 'Freestyle', cur: 0, entries: [{ id: 'first', sets: [] }] } })
    appendExercise(s, '0025')
    expect(s.active.entries).toHaveLength(2)
    expect(s.active.entries[1].id).toBe('0025')
    expect(Array.isArray(s.active.entries[1].sets)).toBe(true)
    expect(s.active.entries[1].sets.length).toBeGreaterThan(0)
  })

  it('does nothing without a session', () => {
    const s = base()
    appendExercise(s, '0025')
    expect(s.active).toBeNull()
  })
})

describe('workoutCountOf', () => {
  it('counts logged workouts, not routines', () => {
    const S = base({
      routines: [{ id: 'r', ex: [{ id: 'a' }, { id: 'b' }] }],
      workouts: [{ entries: [{ id: 'a' }, { id: 'a' }] }, { entries: [{ id: 'a' }] }],
    })
    expect(workoutCountOf(S)).toEqual({ a: 2 })
  })
})
