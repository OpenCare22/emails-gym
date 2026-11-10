import { describe, it, expect } from 'vitest'
import { activitySeries, average, restingHrChange } from './activity-series.js'

describe('activity series', () => {
  it('keeps zero, ignores missing and invalid days, and clips the range', () => {
    const s = activitySeries({ '2026-11-03': 999, '2026-11-04': 0, '2026-11-05': null, '2026-11-06': 100, '2026-11-07': NaN, '2026-11-08': -1, '2026-11-11': 999 }, { today: '2026-11-10' })
    expect(s.points).toHaveLength(7)
    expect(s.average).toBe(50)
    expect(s.points[1].y).toBeNull()
    expect(average([])).toBeNull()
  })
  it('uses Monday weeks and weights the range average by recorded days', () => {
    const s = activitySeries({ '2026-11-01': 0, '2026-11-02': 100, '2026-11-03': 200 }, { today: '2026-11-10', days: 30 })
    expect(s.points.find(p => p.d === '2026-11-02')).toMatchObject({ y: 150, count: 2, end: '2026-11-08' })
    expect(s.average).toBe(100)
  })
  it('preserves calendar days across DST, leap days and year boundaries', () => {
    for (const today of ['2026-03-31', '2026-11-02', '2024-03-01', '2026-01-03']) {
      const s = activitySeries({}, { today, days: 365, weekly: false })
      expect(s.points).toHaveLength(365)
      expect(s.points.at(-1).d).toBe(today)
      expect(s.average).toBeNull()
    }
  })
  it('compares only available readings in chronological order within the range', () => {
    const s = activitySeries({ '2026-11-10': 57, '2026-11-04': 60, '2026-10-01': 90 }, { today: '2026-11-10' })
    expect(restingHrChange(s.readings)).toBe(-3)
    expect(restingHrChange([])).toBeNull()
    expect(restingHrChange([{ y: 60 }])).toBeNull()
    expect(restingHrChange([{ y: 60 }, { y: 63 }])).toBe(3)
    expect(restingHrChange([{ y: 60 }, { y: 60 }])).toBe(0)
  })
})
