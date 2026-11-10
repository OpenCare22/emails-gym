import { describe, it, expect } from 'vitest'
import { importableExercises, workoutFromExercise, dismissExercise } from './google-health.js'
import { toSpeed, speedUnitOf } from './speed.js'
import { stampChange, mergeStates } from './sync-merge.js'

const today = '2026-11-10'
const exercise = (over = {}) => ({ id: 'run', type: 'RUNNING', name: 'Run', d: today,
  start: `${today}T10:00:00Z`, end: `${today}T10:30:00Z`, minutes: 30, distanceKm: 5, avgHr: 151, ...over })
const state = () => ({ workouts: [], bodyweight: [], ghDismissed: [], unit: 'kg' })
const offer = (exercises, S = state()) => importableExercises(S, exercises, { today })

describe('Fitbit import offers', () => {
  it('includes today and six preceding days, excludes older and future days', () => {
    const days = ['2026-11-03', '2026-11-04', today, '2026-11-11']
    expect(offer(days.map(d => exercise({ id: d, d, start: d + 'T10:00:00Z', end: d + 'T10:30:00Z' }))).map(e => e.id)).toEqual([today, '2026-11-04'])
  })
  it('excludes dismissed, imported, strength and malformed activities', () => {
    const S = state(); S.ghDismissed = ['dismissed']; S.workouts = [{ src: { gh: 'imported' } }]
    expect(offer([
      exercise({ id: 'dismissed' }), exercise({ id: 'imported' }),
      ...['FREE_WEIGHTS', 'FUNCTIONAL_STRENGTH_TRAINING', 'CIRCUIT_TRAINING'].map(type => exercise({ id: type, type })),
      exercise({ start: 'bad' }), exercise({ end: `${today}T10:00:00Z` }), exercise({ minutes: 0 }),
    ], S)).toEqual([])
  })
  it('suppresses overlap strictly over half the detected duration', () => {
    const S = state()
    S.workouts = [{ start: Date.parse(`${today}T09:00:00Z`), end: Date.parse(`${today}T10:15:00Z`) }]
    expect(offer([exercise()], S)).toHaveLength(1)
    S.workouts[0].end++
    expect(offer([exercise()], S)).toEqual([])
    S.workouts = [{ start: Date.parse(`${today}T10:30:00Z`), end: Date.parse(`${today}T11:00:00Z`) }]
    expect(offer([exercise()], S)).toHaveLength(1)
  })
  it('sorts newest first, deduplicates and caps at three without mutating input', () => {
    const input = [4, 6, 5, 9, 8].map(day => exercise({ id: String(day), start: `2026-11-0${day}T10:00:00Z`, end: `2026-11-0${day}T10:30:00Z` }))
    const before = structuredClone(input)
    expect(offer([...input, input[3]]).map(e => e.id)).toEqual(['9', '8', '6'])
    expect(input).toEqual(before)
  })
  it('caps dismissal history at 200 and syncs it as one setting', () => {
    const S = state(); S.ghDismissed = Array.from({ length: 200 }, (_, i) => String(i))
    const next = structuredClone(S)
    dismissExercise(next, 'new')
    expect(next.ghDismissed).toHaveLength(200)
    expect(next.ghDismissed[0]).toBe('1')
    dismissExercise(next, 'new')
    expect(next.ghDismissed).toHaveLength(200)
    next._ts = stampChange(S, next, 100)
    expect(next.edited.ghDismissed).toBe(100)
    expect(mergeStates(next, S).ghDismissed).toEqual(next.ghDismissed)
  })
})

describe('Fitbit finished workouts', () => {
  it('writes the completed workout shape with source and optional heart rate', () => {
    const e = exercise(), S = state()
    expect(workoutFromExercise(e, S)).toEqual({
      id: 'gh:run', d: today, start: Date.parse(e.start), end: Date.parse(e.end), name: 'Run',
      routineIds: [], routineId: null, bw: null, prs: [], src: { gh: 'run' }, hr: { avg: 151, src: 'gh', n: 0 },
      entries: [{ id: '0685', topW: null, target: null, sets: [{ min: 30, speed: 10, done: true, at: Date.parse(e.end) }] }],
    })
    expect(workoutFromExercise(exercise({ avgHr: null, distanceKm: null }), S)).not.toHaveProperty('hr')
    expect(workoutFromExercise(exercise({ distanceKm: null }), S).entries[0].sets[0].speed).toBe(0)
    expect(S.workouts).toEqual([])
  })
  it.each([['RUNNING', '0685'], ['WALKING', '2258'], ['HIKING', '2258'], ['BIKING', '5214'], ['ELLIPTICAL', '2192'], ['ROWING', '1161'], ['SWIMMING', '6944'], ['OTHER', '2258']])('maps %s to %s and preserves Fitbit name', (type, id) => {
    const w = workoutFromExercise(exercise({ type, name: 'My session' }), state())
    expect(w.entries[0].id).toBe(id)
    expect(w.name).toBe('My session')
  })
  it.each([['kg', undefined, 10], ['lb', undefined, 6.21], ['kg', 'mph', 6.21], ['lb', 'kmh', 10]])('keeps canonical speed for %s / %s and displays %s', (unit, speedUnit, display) => {
    const S = { ...state(), unit, speedUnit }
    const speed = workoutFromExercise(exercise(), S).entries[0].sets[0].speed
    expect(speed).toBe(10)
    expect(toSpeed(speed, speedUnitOf(S))).toBe(display)
  })
})
