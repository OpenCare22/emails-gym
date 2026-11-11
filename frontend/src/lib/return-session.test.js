import { beforeEach, describe, it, expect } from 'vitest'
import { buildPlannedEntry } from './session-start.js'
import { isWarmupRow } from './workout-model.js'
import { setReturnEasing } from './return-break.js'
import { feelAsked, returnDays, showsReturnNote, setUsualPlan } from './return-session.js'

beforeEach(() => setReturnEasing(true))

const cfg = { id: '0025', sets: 3, reps: 5, weight: 100, inc: 2.5, prog: 'linear' }
const routine = { id: 'r', prog: 'linear', ex: [cfg] }
const state = () => ({
  unit: 'kg', exWeights: {}, routines: [routine],
  workouts: ['2026-02-12', '2026-02-16', '2026-02-19'].map(d => ({ d, routineIds: ['r'], entries: [{ id: cfg.id, target: { ...cfg }, sets: [5, 5, 5].map(r => ({ w: 100, r, done: true })) }] })),
})
// A running workout ten days after the last session, built the way Start builds it.
const running = () => {
  const s = state()
  s.active = { d: '2026-03-01', entries: [] }
  s.active.entries = [{ id: cfg.id, rid: 'r', ...buildPlannedEntry(s, cfg, routine) }]
  return s
}
const work = entry => entry.sets.filter(x => !isWarmupRow(x))

describe('feelAsked', () => {
  const entry = done => ({ id: '0025', plan: { policy: 'linear', kind: 'up' }, target: { sets: 3 }, sets: [true, true, done].map(d => ({ w: 60, r: 5, done: d })) })
  it('asks once every planned work set is done', () => {
    expect(feelAsked(entry(false))).toBe(false)
    expect(feelAsked(entry(true))).toBe(true)
  })
  it('an extra open set on top does not hide it', () => {
    const e = entry(true); e.sets.push({ w: 60, r: 5, done: false })
    expect(feelAsked(e)).toBe(true)
  })
  it('warm-ups do not count', () => {
    const e = entry(true); e.sets.unshift({ w: 20, r: 5, done: false, phase: 'warmup' })
    expect(feelAsked(e)).toBe(true)
  })
  it('a saved workout being edited: routine exercises and earlier answers only', () => {
    const saved = { id: '0025', target: { sets: 1 }, sets: [{ w: 60, r: 5, done: true }] }
    expect(feelAsked({ ...saved, rid: 'r1' })).toBe(true)
    expect(feelAsked({ ...saved, feel: 'easy' })).toBe(true)
    expect(feelAsked(saved)).toBe(false)
    expect(feelAsked({ ...saved, rid: 'r1', noProg: true })).toBe(false)
  })
  it('never for progression off, a freestyle entry or cardio', () => {
    expect(feelAsked({ ...entry(true), plan: { policy: 'off', kind: 'off' } })).toBe(false)
    expect(feelAsked({ ...entry(true), plan: null })).toBe(false)
    expect(feelAsked({ ...entry(true), target: { sets: 1, mode: 'cardio' } })).toBe(false)
  })
})

describe('return note', () => {
  it('names the longest break', () => {
    expect(returnDays({ entries: [{ back: { days: 9 } }, { back: { days: 12 } }, {}] })).toBe(12)
    expect(returnDays({ entries: [], usualPlan: { days: 10 } })).toBe(10)
  })
  it('shows for an eased workout, never for a past or edited one', () => {
    expect(showsReturnNote({ entries: [{ back: { days: 9 } }] })).toBe(true)
    expect(showsReturnNote({ entries: [{}] })).toBe(false)
    expect(showsReturnNote({ entries: [{ back: { days: 9 } }], backfill: {} })).toBe(false)
    expect(showsReturnNote({ entries: [{ back: { days: 9 } }], editingWorkoutId: 'w1' })).toBe(false)
  })
})

describe('setUsualPlan', () => {
  it('rebuilds eased entries at the usual plan and back again', () => {
    const s = running()
    expect(work(s.active.entries[0]).map(x => x.w)).toEqual([100, 100])
    setUsualPlan(s, true)
    expect(s.active.usualPlan).toEqual({ days: 10 })
    expect(work(s.active.entries[0]).map(x => x.w)).toEqual([102.5, 102.5, 102.5])
    expect(s.active.entries[0]).not.toHaveProperty('back')
    expect(showsReturnNote(s.active)).toBe(true)
    setUsualPlan(s, false)
    expect(s.active).not.toHaveProperty('usualPlan')
    expect(work(s.active.entries[0]).map(x => x.w)).toEqual([100, 100])
    expect(s.active.entries[0].back).toMatchObject({ days: 10, tier: 'short' })
  })
  it('keeps a logged set exactly as logged', () => {
    const s = running()
    const first = work(s.active.entries[0])[0]
    Object.assign(first, { w: 100, r: 6, done: true })
    setUsualPlan(s, true)
    const rows = work(s.active.entries[0])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ w: 100, r: 6, done: true })
    expect(rows.slice(1).map(x => x.w)).toEqual([102.5, 102.5])
  })
  it('leaves an exercise without a routine alone', () => {
    const s = running()
    s.active.entries.push({ id: '0031', sets: [{ w: 40, r: 8, done: false }] })
    setUsualPlan(s, true)
    expect(s.active.entries[1].sets).toEqual([{ w: 40, r: 8, done: false }])
  })
})
