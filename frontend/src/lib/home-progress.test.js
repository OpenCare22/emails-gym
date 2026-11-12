import { describe, expect, it } from 'vitest'
import { homeProgress } from './home-progress.js'
import { withExUnit } from './ex-unit.js'

const TODAY = '2026-11-12'
const ago = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
let n = 0
const wo = (daysAgo, entries, prs = []) => ({ id: 'w' + n++, d: ago(daysAgo), entries, prs })
const ex = (id, ...sets) => ({ id, sets: sets.map(s => (typeof s === 'number' ? { w: s, r: 5, done: true } : s)) })
const state = (workouts, extra = {}) => ({ unit: 'kg', workouts, routines: [], exWeights: {}, ...extra })

describe('homeProgress', () => {
  it('counts workouts and records in the last 28 days only', () => {
    const p = homeProgress(state([wo(0, [ex('a', 50)], ['a']), wo(27, [ex('a', 50)], ['a']), wo(28, [ex('a', 50)], ['a'])]), TODAY)
    expect(p.workouts).toBe(2)
    expect(p.records).toBe(2)
  })

  it('ranks by number of workouts in 56 days and keeps three', () => {
    const ws = []
    for (let i = 0; i < 4; i++) ws.push(wo(i, [ex('a', 50), ...(i < 3 ? [ex('b', 50)] : []), ...(i < 2 ? [ex('c', 50)] : []), ...(i < 1 ? [ex('d', 50)] : [])]))
    const p = homeProgress(state(ws), TODAY)
    expect(p.lifts.map(l => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('best and delta against the 28 days before', () => {
    const p = homeProgress(state([wo(35, [ex('bench', 80)]), wo(3, [ex('bench', 85)]), wo(2, [ex('row', 60)])]), TODAY)
    expect(p.lifts.find(l => l.id === 'bench')).toMatchObject({ best: 85, prev: 80, delta: 5 })
    expect(p.lifts.find(l => l.id === 'row')).toMatchObject({ best: 60, prev: null, delta: null })
  })

  it('ignores warm-ups, undone sets, timed and weightless sets', () => {
    const p = homeProgress(state([wo(1, [
      ex('bench', { w: 100, r: 5, done: true, phase: 'warmup' }, { w: 120, r: 5, done: false }, 80),
      ex('plank', { sec: 60, done: true }),
      ex('pushup', { w: 0, r: 20, done: true }),
    ])]), TODAY)
    expect(p.lifts.map(l => l.id)).toEqual(['bench'])
    expect(p.lifts[0].best).toBe(80)
  })

  it('shows an lb-pinned exercise in lb', () => {
    const p = homeProgress(state([wo(1, [ex('bench', 100)])], { exUnit: withExUnit({}, 'bench', 'lb', 1) }), TODAY)
    expect(p.lifts[0].unit).toBe('lb')
    expect(p.lifts[0].best).toBeCloseTo(220.5, 0)
  })

  it('leaves out an exercise trained only before the last 28 days', () => {
    const p = homeProgress(state([wo(40, [ex('old', 50)]), wo(1, [ex('new', 50)])]), TODAY)
    expect(p.lifts.map(l => l.id)).toEqual(['new'])
  })

  it('empty profile', () => {
    expect(homeProgress(state([]), TODAY)).toEqual({ workouts: 0, records: 0, lifts: [] })
  })
})
