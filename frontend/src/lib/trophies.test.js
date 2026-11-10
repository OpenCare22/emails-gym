import { describe, it, expect } from 'vitest'
import { trophyInfo, backgroundsFor, cardClass, freshTrophies, ALL_MILESTONES } from './trophies.js'

describe('trophies in the app', () => {
  it('names every trophy and says how to earn it', () => {
    for (const k of [...ALL_MILESTONES, 'week-workouts', 'week-steps']) {
      const i = trophyInfo(k)
      expect(i.name).not.toBe(k)
      expect(i.how.length).toBeGreaterThan(5)
      expect(i.name + i.how).not.toMatch(/—/)
    }
    expect(trophyInfo('squat-1.5').name).toBe('Squat at 1.5 × body weight')
    expect(trophyInfo('workouts-1').name).toBe('First workout')
  })
  it('unlocks backgrounds by trophies, and shows a locked one as plain', () => {
    const open = ts => backgroundsFor(ts).filter(b => b.open).map(b => b.id)
    expect(open([])).toEqual(['plain'])
    expect(open([{ kind: 'workouts-10' }, { kind: 'week-volume' }])).toEqual(['plain', 'stripes', 'rings'])
    expect(cardClass('stripes', [])).toBe('cardbg-plain')
    expect(cardClass('stripes', [{ kind: 'workouts-10' }])).toBe('cardbg-stripes')
    expect(cardClass('stripes')).toBe('cardbg-stripes')
    expect(cardClass('nope')).toBe('cardbg-plain')
  })
  it('celebrates only trophies new since the last look, never the whole cabinet the first time', () => {
    const mem = new Map(), store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
    expect(freshTrophies([{ id: 'workouts-1' }], store)).toEqual([])
    expect(freshTrophies([{ id: 'workouts-1' }, { id: 'streak-4' }], store)).toEqual([{ id: 'streak-4' }])
    expect(freshTrophies([{ id: 'workouts-1' }, { id: 'streak-4' }], store)).toEqual([])
  })
})
