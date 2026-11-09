import { describe, expect, it } from 'vitest'
import { weekTraining, workoutSets } from './week-training.js'

const set = (over = {}) => ({ w: 60, r: 8, done: true, ...over })
const workout = (d, sets) => ({ id: d, d, entries: [{ id: '0025', sets }] })

describe('weekTraining', () => {
  it('counts completed working sets per day, Monday first by default', () => {
    const S = { workouts: [
      workout('2026-11-09', [set(), set(), set({ done: false })]),          // Monday: 2 done
      workout('2026-11-11', [set({ phase: 'warmup' }), set(), set()]),      // Wednesday: warm-up not counted
      workout('2026-11-11', [set()]),                                       // a second session that day
      workout('2026-11-02', [set(), set()]),                                // the week before: left out
    ] }
    const days = weekTraining(S, '2026-11-12', '2026-11-12')
    expect(days.map(d => d.iso)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(days.map(d => d.sets)).toEqual([2, 0, 3, 0, 0, 0, 0])
    expect(days.map(d => d.workouts)).toEqual([1, 0, 2, 0, 0, 0, 0])
    expect(days.map(d => d.future)).toEqual([false, false, false, false, true, true, true])
  })

  it('follows a Sunday week', () => {
    const days = weekTraining({ weekStart: 0, workouts: [] }, '2026-11-12')
    expect(days[0].iso).toBe('2026-11-08')
    expect(days[6].iso).toBe('2026-11-14')
  })

  it('stands up to a thin or broken state', () => {
    expect(weekTraining({}, '2026-11-12').every(d => d.sets === 0)).toBe(true)
    expect(weekTraining({ workouts: [null, { d: 'nope' }, { d: '2026-11-10', entries: 'x' }] }, '2026-11-12')[1]).toMatchObject({ sets: 0, workouts: 1 })
    expect(workoutSets({ entries: [{ sets: [null, set()] }] })).toBe(1)
  })
})
