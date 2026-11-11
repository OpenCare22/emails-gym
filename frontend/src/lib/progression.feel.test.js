import { describe, it, expect } from 'vitest'
import { nextPrescription, sessionsFor, stallCount } from './progression.js'
import { EXDB, isAssisted } from './exercises.js'

const LIFT = '0025' // barbell bench press
const LOWER = EXDB.find(e => e.bp === 'upper legs' && !isAssisted(e.id)).id
const cfg = { id: LIFT, sets: 3, reps: 5, weight: 100, prog: 'linear', inc: 2.5 }
const session = (weight, feel, reps = [5, 5, 5], target = {}, extra = {}) => ({
  id: LIFT, feel, target: { sets: reps.length, reps: 5, ...target },
  sets: reps.map(r => ({ w: weight, r, done: true })), ...extra
})
const state = entries => ({ unit: 'kg', workouts: entries.map((e, i) => ({ d: `2026-01-${String(i + 1).padStart(2, '0')}`, entries: [e] })) })
const plan = (entries, config = {}, st = {}) => nextPrescription({ ...state(entries), ...st }, { ...cfg, ...config })

describe('feel progression', () => {
  it.each([
    ['linear', [5, 5, 5], {}, { policy: 'linear', kind: 'up', weight: 102.5, why: ['Every rep last time. {0} {1} more.', 2.5, 'kg'] }],
    ['linear', [5, 5, 3], {}, { policy: 'linear', kind: 'hold', weight: 100, why: ['Missed reps last time. Same weight again ({0} of {1} to go).', 2, 3] }],
    ['double', [10, 10, 10], { reps: 12, repsMin: 8 }, { policy: 'double', kind: 'hold', weight: 100, reps: 11, why: ['Same weight, aim for {0} reps this time.', 11] }],
    ['double', [12, 12, 12], { reps: 12, repsMin: 8 }, { policy: 'double', kind: 'up', weight: 102.5, reps: 8, why: ['Top of the rep range in every set. {0} {1} more, back to {2} reps.', 2.5, 'kg', 8] }],
    ['triple', [10, 10, 10], { reps: 12, repsMin: 8, setsMax: 4 }, { policy: 'triple', kind: 'hold', weight: 100, reps: 11, sets: 3, rowReps: [11, 11, 11], why: ['Same weight, aim for {0} reps in every set.', 11] }],
    ['greyskull', [5, 5, 10], {}, { policy: 'greyskull', kind: 'up', weight: 105, why: ['Last set hit {0} reps, twice the target! Take a double jump of {1} {2}.', 10, 5, 'kg'] }]
  ])('no feel is unchanged: %s %j', (prog, reps, config, expected) => {
    const e = session(100, undefined, reps, { reps: prog === 'linear' ? 5 : Math.min(...reps) })
    expect(plan([e], { prog, ...config })).toEqual(expected)
    expect(plan([{ ...e, feel: 'good' }], { prog, ...config })).toEqual(expected)
  })
  it('Hard holds once, then steps without a stall', () => {
    const e = session(60, 'hard')
    expect(plan([e])).toMatchObject({ kind: 'hold', weight: 60, reps: 5, why: ['Felt hard last time: same weight once more.'] })
    expect(plan([e, e])).toMatchObject({ kind: 'up', weight: 62.5 })
    expect(stallCount(sessionsFor(state([e, e]), LIFT))).toBe(0)
  })
  it('Hard at a new weight or plan can hold again', () => {
    expect(plan([session(60, 'hard'), session(62.5, 'hard')]).kind).toBe('hold')
    expect(plan([session(60, 'hard'), session(60, 'hard', [6, 6, 6], { reps: 6 })]).reps).toBe(6)
  })
  it('Hard holds the double aim and triple rows', () => {
    expect(plan([session(100, 'hard', [10, 10, 10], { reps: 10 })], { prog: 'double', reps: 12, repsMin: 8 }).reps).toBe(10)
    expect(plan([session(100, 'hard', [12, 12, 12, 9], { reps: 12, rowReps: [12, 12, 12, 8] })], { prog: 'triple', reps: 12, repsMin: 8, setsMax: 4 })).toMatchObject({ kind: 'hold', rowReps: [12, 12, 12, 8], sets: 4 })
  })
  it.each([['linear', [5, 5, 5], {}], ['double', [12, 12, 12], { reps: 12, repsMin: 8 }], ['triple', [12, 12, 12], { reps: 12, repsMin: 8 }]])('Easy twice doubles a %s raise', (prog, reps, config) => {
    expect(plan([session(97.5, 'easy', reps), session(100, 'easy', reps)], { prog, ...config })).toMatchObject({ weight: 105, why: ['Easy twice in a row: {0} {1} more.', 5, 'kg'] })
  })
  it('requires two Easy hits at increasing weights, under the cap', () => {
    expect(plan([session(100, 'easy')]).weight).toBe(102.5)
    expect(plan([session(100, 'easy'), session(100, 'easy')]).weight).toBe(102.5)
    expect(plan([session(97.5, 'easy', [5, 5, 3]), session(100, 'easy')]).weight).toBe(102.5)
    expect(plan([session(37.5, 'easy'), session(40, 'easy')]).weight).toBe(42.5)
  })
  it('allows 7 percent for lower body, 5 percent for upper body', () => {
    const entries = [session(77.5, 'easy'), session(80, 'easy')]
    expect(plan(entries).weight).toBe(82.5)
    expect(plan(entries.map(e => ({ ...e, id: LOWER })), { id: LOWER }).weight).toBe(85)
  })
  it('ignores feel on misses and rep climbing', () => {
    for (const feel of ['easy', 'hard']) expect(plan([session(100, feel, [5, 5, 3])])).toEqual(plan([session(100, undefined, [5, 5, 3])]))
    expect(plan([session(97.5, 'easy'), session(100, 'easy', [10, 10, 10], { reps: 10 })], { prog: 'double', reps: 12, repsMin: 8 }).reps).toBe(11)
  })
  it('Greyskull AMRAP wins without stacking or applying the cap', () => {
    expect(plan([session(37.5, 'easy'), session(40, 'easy', [5, 5, 10])], { prog: 'greyskull' })).toMatchObject({ weight: 45, why: ['Last set hit {0} reps, twice the target! Take a double jump of {1} {2}.', 10, 5, 'kg'] })
  })
  it('uses the real owned stack jump for the cap', () => {
    const entries = [session(97.5, 'easy'), session(100, 'easy')]
    expect(plan(entries, {}, { stackWeights: { [LIFT]: { unit: 'kg', weights: [97.5, 100, 102, 104] } } }).weight).toBe(104)
    expect(plan(entries, {}, { stackWeights: { [LIFT]: { unit: 'kg', weights: [97.5, 100, 103, 106] } } }).weight).toBe(103)
  })
  it('reduces assistance for two Easy raises', () => {
    const id = EXDB.find(e => isAssisted(e.id)).id
    const entries = [session(102.5, 'easy'), session(100, 'easy')].map(e => ({ ...e, id }))
    expect(plan(entries, { id }).weight).toBe(95)
    expect(plan(entries.reverse(), { id }).weight).toBe(100)
  })
  it('does not borrow an Easy streak from another routine', () => {
    const st = state([session(97.5, 'easy'), session(100, 'easy')])
    st.workouts[0].routineIds = ['other']
    st.workouts[1].routineIds = ['own']
    expect(nextPrescription(st, cfg, { id: 'own' }).weight).toBe(102.5)
  })
  it('compares stamped plans for the Hard hold limit', () => {
    const planned = { sets: 3, reps: 5, weight: 100 }
    const e = session(100, 'hard', [5, 5, 5], {}, { planned })
    expect(plan([e, e]).weight).toBe(102.5)
    expect(plan([{ ...e, planned: { ...planned, sets: 2 } }, e]).weight).toBe(100)
  })
  it('reads RIR and copies back without mutating saved entries', () => {
    const back = { tier: 'short', step: 1, days: 12 }
    const e = session(100, undefined, [5, 5, 5], {}, { back })
    e.sets[2].rir = 0
    const st = state([e])
    const before = structuredClone(st)
    expect(sessionsFor(st, LIFT)[0]).toMatchObject({ feel: 'hard', back })
    expect(plan([e]).kind).toBe('first')
    expect(st).toEqual(before)
    expect(plan([{ ...e, back: undefined }]).kind).toBe('hold')
  })
})
