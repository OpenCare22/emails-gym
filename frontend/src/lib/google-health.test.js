import { describe, it, expect } from 'vitest'
import { stepsOn, latestRestingHr, weekAverageSteps, applyWeighIns } from './google-health.js'

const data = { steps: { '2026-11-07': 9000, '2026-11-08': 7000, '2026-11-09': 8000, '2026-11-10': 2500 }, restingHr: { '2026-11-09': 60, '2026-11-10': 58 } }

describe('Google Health in the app', () => {
  it('reads today’s steps and the latest resting heart rate', () => {
    expect(stepsOn(data, '2026-11-10')).toBe(2500)
    expect(stepsOn(data, '2026-11-11')).toBeNull()
    expect(latestRestingHr(data)).toEqual({ bpm: 58, d: '2026-11-10' })
    expect(latestRestingHr({})).toBeNull()
  })
  it('averages the week before today, only with enough days', () => {
    expect(weekAverageSteps(data, '2026-11-10')).toBe(8000)
    expect(weekAverageSteps({ steps: { '2026-11-09': 1 } }, '2026-11-10')).toBeNull()
  })
  it('adds Fitbit weigh-ins once, in the profile unit, and never over a day weighed by hand', () => {
    const S = { unit: 'kg', bodyweight: [{ d: '2026-11-08', w: 76, t: 1, ins: [{ id: 'm', at: '07:00', w: 76, t: 1 }] }] }
    const weights = [
      { id: 'w1', at: '2026-11-08T06:00:00Z', d: '2026-11-08', kg: 75.9 },
      { id: 'w2', at: '2026-11-09T06:00:00Z', d: '2026-11-09', kg: 75.4 },
    ]
    expect(applyWeighIns(S, weights)).toBe(1)
    expect(applyWeighIns(S, weights)).toBe(0)
    const day = S.bodyweight.find(b => b.d === '2026-11-09')
    expect(day.w).toBe(75.4)
    expect(day.ins[0]).toMatchObject({ src: 'google', sid: 'w2' })
    expect(S.bodyweight.find(b => b.d === '2026-11-08').w).toBe(76)
    const L = { unit: 'lb', bodyweight: [] }
    applyWeighIns(L, [weights[1]])
    expect(L.bodyweight[0].w).toBe(166.2)
  })
})
