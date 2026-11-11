import { describe, it, expect } from 'vitest'
import { FEELS, feelOf, isLowerBody, doubleStepFits } from './feel.js'
import { EXDB } from './exercises.js'

const upper = EXDB.find(e => e.bp === 'chest')
const lower = EXDB.find(e => e.bp === 'upper legs')
const row = extra => ({ r: 5, done: true, ...extra })

describe('feelOf', () => {
  it('exports the three taps', () => expect(FEELS).toEqual(['easy', 'good', 'hard']))
  it.each(['easy', 'good', 'hard'])('reads %s ahead of effort', feel => {
    expect(feelOf({ feel, sets: [row({ rir: 4 })] })).toBe(feel)
  })
  it('reads old and unknown entries as unrated', () => {
    expect(feelOf({ sets: [row({ w: 50 })] })).toBe(null)
    expect(feelOf({ feel: 'meh', sets: [] })).toBe(null)
    expect(feelOf()).toBe(null)
  })
  it.each([[{ rir: 3 }, 'easy'], [{ rir: 2 }, 'good'], [{ rir: 1 }, 'good'], [{ rir: 0 }, 'hard'], [{ rpe: 10 }, 'hard']])('reads last work effort %o', (effort, feel) => {
    expect(feelOf({ sets: [row({ rir: 0 }), row(effort)] })).toBe(feel)
  })
  it('does not infer logged effort from an unrated failure set', () => {
    expect(feelOf({ sets: [row({ failure: true })] })).toBe(null)
  })
  it('skips warm-ups and undone rows, but does not search past an unrated work row', () => {
    expect(feelOf({ sets: [row({ rir: 1 }), row({ rir: 4, done: false }), row({ rir: 0, phase: 'warmup' })] })).toBe('good')
    expect(feelOf({ sets: [row({ rir: 4 }), row({})] })).toBe(null)
  })
})

describe('doubleStepFits', () => {
  it('resolves catalogue ids and configs', () => {
    expect(isLowerBody(lower.id)).toBe(true)
    expect(isLowerBody({ id: lower.id })).toBe(true)
    expect(isLowerBody(upper.id)).toBe(false)
    expect(isLowerBody({ id: 'custom-x' })).toBe(false)
  })
  it('recognizes lower body parts and targets', () => {
    for (const bp of ['upper legs', 'lower legs', 'hips', 'glutes']) expect(isLowerBody({ bp })).toBe(true)
    for (const tg of ['Glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves']) expect(isLowerBody({ tg })).toBe(true)
    expect(isLowerBody({ bp: 'full body', tg: 'spine' })).toBe(false)
  })
  it('uses 5 percent for upper and unknown exercises', () => {
    expect(doubleStepFits(upper.id, 100, 5)).toBe(true)
    expect(doubleStepFits(upper.id, 60, 5)).toBe(false)
    expect(doubleStepFits({ id: 'custom-x' }, 100, 6)).toBe(false)
  })
  it('uses 7 percent for lower body and tolerates rounding', () => {
    expect(doubleStepFits(lower.id, 100, 7 + 1e-10)).toBe(true)
    expect(doubleStepFits(lower.id, 100, 7.5)).toBe(false)
    expect(doubleStepFits(lower.id, 0, 0)).toBe(false)
  })
})
