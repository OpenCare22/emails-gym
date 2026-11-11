import { beforeEach, describe, it, expect } from 'vitest'
import { buildPlannedEntry, buildSessionEntry } from './session-start.js'
import { isWarmupRow } from './workout-model.js'

import { setReturnEasing } from './return-break.js'

beforeEach(() => setReturnEasing(true))

const cfg = { id: '0025', sets: 3, reps: 5, weight: 100, inc: 2.5, prog: 'linear' }
const routine = { id: 'r', prog: 'linear', ex: [cfg] }
const state = (dates = ['2026-02-12', '2026-02-16', '2026-02-19']) => ({
  unit: 'kg', active: { d: '2026-03-01' }, exWeights: {}, routines: [routine],
  workouts: dates.map(d => ({ d, routineIds: ['r'], entries: [{ id: cfg.id, target: { ...cfg }, sets: [5, 5, 5].map(r => ({ w: 100, r, done: true })) }] })),
})
const work = entry => entry.sets.filter(s => !isWarmupRow(s))

describe('session return easing', () => {
  it('eases the entry and stamps its actual target', () => {
    const st = state(); const before = JSON.stringify(st)
    const entry = buildPlannedEntry(st, cfg, routine)
    expect(work(entry)).toHaveLength(2)
    expect(work(entry).map(s => s.w)).toEqual([100, 100])
    expect(entry).toMatchObject({ target: { sets: 2 }, plan: { kind: 'return' }, back: { tier: 'short' } })
    expect(JSON.stringify(st)).toBe(before)
  })
  it('warm-ups ramp to the eased weight', () => {
    const entry = buildPlannedEntry(state(['2026-02-09']), { ...cfg, warmup: 'auto', warmupSets: 2 }, routine)
    expect(work(entry).map(s => s.w)).toEqual([90, 90])
    const warm = entry.sets.filter(isWarmupRow)
    expect(warm.length).toBeGreaterThan(0)
    expect(warm.at(-1).w).toBeLessThan(90)
  })
  it('noEase builds the usual plan', () => {
    const entry = buildPlannedEntry(state(), cfg, routine, { noEase: true })
    expect(work(entry)).toHaveLength(3)
    expect(work(entry).every(s => s.w === 102.5)).toBe(true)
    expect(entry).not.toHaveProperty('back')
  })
  it('usualPlan applies when an exercise is added or swapped', () => {
    const st = state(); st.active.usualPlan = { days: 10 }
    const entry = buildSessionEntry(st, cfg.id, cfg, routine)
    expect(work(entry)).toHaveLength(3)
    expect(entry.plan.kind).toBe('up')
    expect(entry).not.toHaveProperty('back')
  })
  it('noProg remains off', () => {
    const entry = buildPlannedEntry(state(), cfg, routine, { noProg: true })
    expect(entry.plan.kind).toBe('off')
    expect(entry).not.toHaveProperty('back')
  })
})

describe('return baseline weight meaning', () => {
  it('stores a pinned-unit baseline in profile units and reads it back for the next rung', () => {
    const st = state(['2026-01-20'])
    st.exUnit = { [cfg.id]: { unit: 'lb' } }
    const first = buildPlannedEntry(st, cfg, routine)
    expect(first.back.from.weight).toBeCloseTo(100, 2)
    st.workouts.push({ d: '2026-03-01', routineIds: ['r'], entries: [{ id: cfg.id, ...first, sets: first.sets.map(s => ({ ...s, done: true })) }] })
    st.active.d = '2026-03-04'
    const next = buildPlannedEntry({ ...st, workouts: [...st.workouts] }, cfg, routine)
    expect(next.back.step).toBe(2)
    expect(next.target.weight).toBeGreaterThan(85)
    expect(next.target.weight).toBeLessThanOrEqual(90)
  })
  it('reads the ramp baseline in the chosen dumbbell meaning', () => {
    const c = { ...cfg, id: '0289', weight: 40, dbLoad: 'total' }
    const r = { ...routine, ex: [c] }
    const st = state(['2026-01-20'])
    st.workouts[0].entries = [{ id: c.id, target: { ...c }, sets: [5, 5, 5].map(r => ({ w: 40, r, done: true })) }]
    const first = buildPlannedEntry(st, c, r)
    st.workouts.push({ d: '2026-03-01', routineIds: ['r'], entries: [{ id: c.id, ...first, sets: first.sets.map(s => ({ ...s, done: true })) }] })
    st.active.d = '2026-03-04'
    const next = buildPlannedEntry(st, { ...c, weight: 20, dbLoad: 'each' }, r)
    expect(next.back.from.weight).toBe(20)
    expect(next.target.weight).toBe(17.5)
  })
})
