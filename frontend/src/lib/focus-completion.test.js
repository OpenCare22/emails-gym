import { describe, it, expect } from 'vitest'
import { undoFocusCompletion } from './focus-completion.js'

const receipt = { session: 'a', exercise: 'squat', idx: 0, i: 0, at: 123, count: 2, epoch: 0 }
const active = () => ({ id: 'a', cur: 1, entries: [{ id: 'squat', sets: [
  { w: 100, r: 8, done: true, at: 123 }, { w: 110, r: 5, done: true },
] }] })
describe('Focus completion undo', () => {
  it('clears only the completed status, keeping values, other sets and navigation', () => {
    const a = active()
    expect(undoFocusCompletion(a, receipt, 0)).toBe(true)
    expect(a.entries[0].sets[0]).toEqual({ w: 100, r: 8, done: false, at: 123 })
    expect(a.entries[0].sets[1].done).toBe(true)
    expect(a.cur).toBe(1)
    expect(undoFocusCompletion(a, receipt, 0)).toBe(false)
  })
  it('clears both sides without changing their measurements', () => {
    const a = active()
    a.entries[0].sets[0].sides = { L: { w: 10, r: 8, done: true }, R: { w: 10, r: 7, done: true } }
    undoFocusCompletion(a, receipt, 0)
    expect(a.entries[0].sets[0].sides).toEqual({ L: { w: 10, r: 8, done: false }, R: { w: 10, r: 7, done: false } })
  })
  it('rejects stale sessions, moved entries, removed rows and later completions', () => {
    expect(undoFocusCompletion(null, receipt, 0)).toBe(false)
    for (const change of [a => { a.id = 'b' }, a => { a.entries[0].id = 'other' },
      a => { a.entries[0].sets.shift() }, a => { a.entries[0].sets[0].at++ }]) {
      const a = active(); change(a)
      const before = structuredClone(a)
      expect(undoFocusCompletion(a, receipt, 0)).toBe(false)
      expect(a).toEqual(before)
    }
    expect(undoFocusCompletion(active(), receipt, 1)).toBe(false)
  })
})
