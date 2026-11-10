import { describe, it, expect } from 'vitest'
import { mergeHealthData, applyWeighIns, fillAppleHeartRate } from './google-health.js'

describe('Apple and Google health data', () => {
  it('prefers each Google daily value, including zero, and keeps both sets of readings', () => {
    const apple = { steps: { '2026-11-09': 8000, '2026-11-10': 2000 }, sleep: { '2026-11-09': 420 },
      weight: [{ id: 'apple:w', at: '2026-11-09T08:00:00Z', d: '2026-11-09', kg: 80 }], exercise: [{ id: 'apple:e', start: '2026-11-09T08:00:00Z' }] }
    const google = { steps: { '2026-11-09': 0 }, restingHr: { '2026-11-09': 60 },
      weight: [{ id: 'g', at: '2026-11-09T07:00:00Z', d: '2026-11-09', kg: 81 }] }
    const data = mergeHealthData(google, apple)
    expect(data.steps).toEqual({ '2026-11-09': 0, '2026-11-10': 2000 })
    expect(data.sources.steps).toEqual({ '2026-11-09': 'google', '2026-11-10': 'apple' })
    expect(data.sources.sleep).toEqual({ '2026-11-09': 'apple' })
    expect(data.sleep).toEqual(apple.sleep)
    expect(data.restingHr).toEqual(google.restingHr)
    expect(data.weight.map(w => w.id)).toEqual(['g', 'apple:w'])
    expect(data.exercise).toEqual(apple.exercise)
    expect(apple.weight[0].src).toBeUndefined()
    const state = { unit: 'kg', bodyweight: [] }
    expect(applyWeighIns(state, data.weight)).toBe(2)
    expect(applyWeighIns(state, data.weight)).toBe(0)
    expect(state.bodyweight[0].ins.map(w => w.src)).toEqual(['google', 'apple'])
    expect(mergeHealthData(undefined, apple).steps).toEqual(apple.steps)
  })
  it('fills sessions from Apple workout samples, retries late exports and preserves watch HR', () => {
    const now = Date.now(), start = now - 3600000, end = start + 1800000
    const state = { workouts: [{ id: 'gym', start, end, entries: [{ sets: [{ done: true, at: start + 60000 }] }] },
      { id: 'watch', start, end, hr: { avg: 99, src: 'watch' } }] }
    fillAppleHeartRate(state, { exercise: [] }, now)
    expect(state.workouts[0].hr).toBeUndefined()
    const samples = [{ t: start, bpm: 100 }, { t: start + 5000, bpm: 120 }]
    fillAppleHeartRate(state, { exercise: [{ hrSamples: samples }] }, now)
    expect(state.workouts[0].hr).toMatchObject({ avg: 110, src: 'apple', n: 2 })
    fillAppleHeartRate(state, { exercise: [{ hrSamples: [...samples, { t: start + 10000, bpm: 140 }] }] }, now)
    expect(state.workouts[0].hr).toMatchObject({ avg: 120, n: 3 })
    expect(state.workouts[1].hr).toEqual({ avg: 99, src: 'watch' })
  })
})
