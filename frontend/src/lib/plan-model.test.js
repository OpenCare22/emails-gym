import { describe, it, expect } from 'vitest'
import * as R from './plan-model.js'
import { PATTERNS } from './exercise-index.js'

describe('EG Plan Model v1 tables', () => {
  it('is named and versioned', () => {
    expect(R.MODEL).toEqual({ name: 'EG Plan Model', version: 1 })
  })
  it('builds sessions only from known patterns, and every split from known sessions', () => {
    for (const s of Object.values(R.SESSIONS)) {
      expect(typeof s.name()).toBe('string')
      for (const slot of s.slots) { expect(PATTERNS).toContain(slot.pattern); expect(['main', 'accessory']).toContain(slot.role) }
    }
    for (const [days, byLevel] of Object.entries(R.SPLITS)) for (const types of Object.values(byLevel)) {
      expect(types).toHaveLength(Number(days))
      for (const type of types) expect(R.SESSIONS[type]).toBeTruthy()
      expect(R.WEEKDAYS[days]).toHaveLength(Number(days))
    }
  })
  it('maps every pattern and focus area to muscles', () => {
    for (const p of PATTERNS) expect(R.MUSCLES[p]?.length).toBeGreaterThan(0)
    for (const p of Object.values(R.FOCUS_SLOTS)) expect(PATTERNS).toContain(p)
  })
  it('keeps the numbers inside the research ranges', () => {
    for (const [lo, hi] of Object.values(R.WEEKLY_SETS)) expect(lo).toBeLessThan(hi)
    for (const table of Object.values(R.REPS)) for (const [lo, hi] of Object.values(table)) { expect(lo).toBeGreaterThan(0); expect(lo).toBeLessThan(hi) }
    for (const phase of ['start', 'block']) for (const lv of Object.values(R.RIR[phase])) for (const v of Object.values(lv)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(5) }
    expect(R.REST.main).toBeGreaterThanOrEqual(120)
    expect(R.REST.isolation).toBeLessThanOrEqual(120)
  })
  it('has a plain sentence for every reason, with no em dashes', () => {
    const texts = [R.splitReason(3, 'novice', ['full_a', 'full_b', 'full_c']), R.splitReason(4, 'intermediate', ['upper_a']), R.splitReason(5, 'advanced', ['push']),
      ...Object.keys(R.REPS).map(R.repsReason), R.rirReason('novice'), R.rirReason('advanced'), R.restReason(), R.weeksReason(),
      R.cardioReason('sessions'), R.cardioReason('steps'), R.timeReason(45), R.bodyweightReason(), R.focusReason(['arms']), R.disclaimer(), R.weekNote(1), R.weekNote(5), R.weekNote(8)]
    for (const text of texts) { expect(text.length).toBeGreaterThan(10); expect(text).not.toMatch(/—/) }
  })
})
