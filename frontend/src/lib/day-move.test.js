import { describe, expect, it } from 'vitest'
import { canMoveFrom, canMoveTo, moveSession, undoMove } from './day-move.js'

// 2026-11-12 is a Thursday (getDay 4). Wed 11 is 3, Fri 13 is 5.
const TODAY = '2026-11-11' // Wednesday
const WED = '2026-11-11', THU = '2026-11-12', FRI = '2026-11-13', TUE = '2026-11-10', NEXT_MON = '2026-11-16'
const routines = [{ id: 'r1', name: 'Pull', ex: [{ id: 'x' }] }, { id: 'r2', name: 'Legs', ex: [{ id: 'y' }] }]
const st = (over = {}) => ({ routines, week: { 4: ['r1'] }, dayPlan: {}, workouts: [], queue: null, scheduleMode: 'week', ...over })

describe('moveSession', () => {
  it('moves to an empty day and leaves rest behind', () => {
    const s = st()
    moveSession(s, THU, WED)
    expect(s.dayPlan[WED]).toBe('r1')
    expect(s.dayPlan[THU]).toBe('rest')
  })

  it('swaps two single-routine days', () => {
    const s = st({ week: { 4: ['r1'], 5: ['r2'] } })
    moveSession(s, THU, FRI)
    expect(s.dayPlan[FRI]).toBe('r1')
    expect(s.dayPlan[THU]).toBe('r2')
  })

  it('moving back to its own weekday clears the overrides', () => {
    const s = st()
    moveSession(s, THU, WED)
    moveSession(s, WED, THU)
    expect(s.dayPlan).toEqual({})
  })

  it('undoMove restores exactly, a key that was absent included', () => {
    const s = st({ dayPlan: { [WED]: 'r2' } })
    const { before } = moveSession(s, THU, FRI)
    undoMove(s, before)
    expect(s.dayPlan).toEqual({ [WED]: 'r2' })
  })

  it('ignores deleted routine ids in the week', () => {
    const s = st({ week: { 4: ['r1'], 5: ['gone'] } })
    moveSession(s, THU, FRI)
    expect(s.dayPlan[THU]).toBe('rest')
    expect(s.dayPlan[FRI]).toBe('r1')
  })
})

describe('canMoveFrom', () => {
  it('a planned single-routine day today or later', () => expect(canMoveFrom(st(), THU, TODAY)).toBe(true))
  it('not a past day', () => expect(canMoveFrom(st({ week: { 2: ['r1'] } }), TUE, TODAY)).toBe(false))
  it('not a done day', () => expect(canMoveFrom(st({ workouts: [{ id: 'w', d: THU }] }), THU, TODAY)).toBe(false))
  it('not a combined day', () => expect(canMoveFrom(st({ week: { 4: ['r1', 'r2'] } }), THU, TODAY)).toBe(false))
  it('not in rotation mode', () => expect(canMoveFrom(st({ scheduleMode: 'rotation' }), THU, TODAY)).toBe(false))
  it('not a rest day', () => expect(canMoveFrom(st(), FRI, TODAY)).toBe(false))
  it('not a day with only a deleted routine', () => expect(canMoveFrom(st({ week: { 4: ['gone'] } }), THU, TODAY)).toBe(false))
})

describe('canMoveTo', () => {
  it('today', () => expect(canMoveTo(st(), THU, WED, TODAY)).toBe(true))
  it('not a past day', () => expect(canMoveTo(st(), THU, TUE, TODAY)).toBe(false))
  it('not a done day', () => expect(canMoveTo(st({ workouts: [{ id: 'w', d: WED }] }), THU, WED, TODAY)).toBe(false))
  it('not a combined day', () => expect(canMoveTo(st({ week: { 4: ['r1'], 5: ['r1', 'r2'] } }), THU, FRI, TODAY)).toBe(false))
  it('not the same day', () => expect(canMoveTo(st(), THU, THU, TODAY)).toBe(false))
  it('a later day of next week', () => expect(canMoveTo(st(), THU, NEXT_MON, TODAY)).toBe(true))
  it('not a day that already has the same routine', () => expect(canMoveTo(st(), THU, '2026-11-19', TODAY)).toBe(false))
})
