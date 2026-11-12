import { describe, it, expect } from 'vitest'
import {
  appModeOf, needsModeChoice, dayLogOf, otherWorkoutsOn, earlierDays, addSet, updateSet, removeSet,
  removeExercise, lastTimeFor, nextSetFor, yourExercises, DAY_LOG,
} from './day-log.js'
import { todayISO } from './format.js'

const base = () => ({ workouts: [], routines: [], exWeights: {}, favEx: [] })
const BENCH = '0025'
const PEC = '0596'
const PLANK = '0463'
const SQUAT = '0043'
const DAY = '2026-11-09'

describe('the mode', () => {
  it('reads anything but simple as full', () => {
    expect(appModeOf({})).toBe('full')
    expect(appModeOf({ appMode: 'full' })).toBe('full')
    expect(appModeOf({ appMode: 'simple' })).toBe('simple')
  })
  it('asks only a fresh profile that has not chosen', () => {
    expect(needsModeChoice(base())).toBe(true)
    expect(needsModeChoice({ ...base(), appMode: 'full' })).toBe(false)
    expect(needsModeChoice({ ...base(), appMode: 'simple' })).toBe(false)
    expect(needsModeChoice({ ...base(), workouts: [{ d: DAY, entries: [] }] })).toBe(false)
    expect(needsModeChoice({ ...base(), routines: [{ id: 'r', ex: [] }] })).toBe(false)
  })
})

describe('logging a day', () => {
  it('creates the day with the first set, as an ordinary done workout', () => {
    const s = base()
    expect(addSet(s, DAY, BENCH, { w: 80, r: 8 }, 1000)).toBe(true)
    const w = dayLogOf(s, DAY)
    expect(w).toMatchObject({ d: DAY, log: DAY_LOG, routineIds: [], name: 'Workout', _ts: 1000 })
    expect(w.entries).toHaveLength(1)
    expect(w.entries[0]).toMatchObject({ id: BENCH, topW: 80, sets: [{ w: 80, r: 8, done: true }] })
    expect(w.vol).toBeGreaterThan(0)
    expect(s.exWeights[BENCH]).toEqual({ w: 80, d: DAY })
  })

  it('ignores an empty set', () => {
    const s = base()
    expect(addSet(s, DAY, BENCH, { w: 80, r: null })).toBe(false)
    expect(s.workouts).toHaveLength(0)
  })

  it('adds further sets and exercises to the same day', () => {
    const s = base()
    addSet(s, DAY, BENCH, { w: 80, r: 8 })
    addSet(s, DAY, BENCH, { w: 85, r: 6 })
    addSet(s, DAY, PEC, { w: 50, r: 12 })
    expect(s.workouts).toHaveLength(1)
    const w = dayLogOf(s, DAY)
    expect(w.entries.map(e => e.id)).toEqual([BENCH, PEC])
    expect(w.entries[0].sets).toHaveLength(2)
    expect(w.entries[0].topW).toBe(85)
  })

  it('never changes the previous state in place', () => {
    const s = base()
    addSet(s, DAY, BENCH, { w: 80, r: 8 })
    const before = s.workouts
    const snap = JSON.stringify(before)
    updateSet(s, DAY, BENCH, 0, { w: 90 })
    expect(JSON.stringify(before)).toBe(snap)
    expect(dayLogOf(s, DAY).entries[0].sets[0].w).toBe(90)
  })

  it('removes a set changed to nothing, then the exercise, then the day', () => {
    const s = base()
    addSet(s, DAY, BENCH, { w: 80, r: 8 })
    addSet(s, DAY, PEC, { w: 50, r: 12 })
    updateSet(s, DAY, BENCH, 0, { r: 0 })
    expect(dayLogOf(s, DAY).entries.map(e => e.id)).toEqual([PEC])
    removeSet(s, DAY, PEC, 0)
    expect(dayLogOf(s, DAY)).toBeNull()
    expect(s.workouts).toHaveLength(0)
  })

  it('removes a whole exercise', () => {
    const s = base()
    addSet(s, DAY, BENCH, { w: 80, r: 8 })
    addSet(s, DAY, PEC, { w: 50, r: 12 })
    removeExercise(s, DAY, BENCH)
    expect(dayLogOf(s, DAY).entries.map(e => e.id)).toEqual([PEC])
  })

  it('files a past day in date order at noon', () => {
    const s = base()
    addSet(s, '2026-11-10', BENCH, { w: 80, r: 8 })
    addSet(s, '2026-11-05', BENCH, { w: 75, r: 8 })
    expect(s.workouts.map(w => w.d)).toEqual(['2026-11-05', '2026-11-10'])
    expect(new Date(s.workouts[0].start).getHours()).toBe(12)
  })

  it('awards a record only to the day that leads', () => {
    const s = base()
    addSet(s, '2026-11-05', BENCH, { w: 80, r: 8 })
    addSet(s, '2026-11-09', BENCH, { w: 85, r: 5 })
    expect(dayLogOf(s, '2026-11-09').prs).toContain(BENCH)
    updateSet(s, '2026-11-09', BENCH, 0, { w: 70 })
    expect(dayLogOf(s, '2026-11-09').prs).not.toContain(BENCH)
  })

  it('logs timed and cardio exercises by their own measure', () => {
    const s = base()
    addSet(s, DAY, PLANK, { sec: 60 })
    const plank = dayLogOf(s, DAY).entries.find(e => e.id === PLANK)
    expect(plank.sets[0]).toMatchObject({ sec: 60, done: true })
  })

  it('leaves workouts from the full app alone and reports them separately', () => {
    const full = { id: 'x', d: DAY, start: new Date(DAY + 'T18:00:00').getTime(), entries: [{ id: BENCH, sets: [{ w: 60, r: 5, done: true }] }], routineIds: ['r'] }
    const s = { ...base(), workouts: [full] }
    addSet(s, DAY, PEC, { w: 50, r: 12 })
    expect(s.workouts).toHaveLength(2)
    expect(otherWorkoutsOn(s, DAY)).toEqual([full])
  })
})

describe('reading back', () => {
  it('shows last time from before the day, from any workout', () => {
    const s = base()
    addSet(s, '2026-11-02', BENCH, { w: 75, r: 8 })
    addSet(s, DAY, BENCH, { w: 80, r: 8 })
    expect(lastTimeFor(s, BENCH, DAY)).toMatchObject({ d: '2026-11-02', sets: [{ w: 75, r: 8 }] })
    expect(lastTimeFor(s, BENCH, '2026-11-02')).toBeNull()
  })

  it('starts the next set from today, else from last time', () => {
    const s = base()
    addSet(s, '2026-11-02', BENCH, { w: 75, r: 8 })
    expect(nextSetFor(s, DAY, BENCH)).toEqual({ w: 75, r: 8 })
    addSet(s, DAY, BENCH, { w: 82.5, r: 6 })
    expect(nextSetFor(s, DAY, BENCH)).toEqual({ w: 82.5, r: 6 })
    expect(nextSetFor(s, DAY, PEC)).toEqual({ w: null, r: null })
  })

  it('lists earlier days newest first', () => {
    const s = base()
    addSet(s, '2026-11-02', BENCH, { w: 75, r: 8 })
    addSet(s, '2026-11-05', BENCH, { w: 75, r: 8 })
    addSet(s, DAY, BENCH, { w: 75, r: 8 })
    expect(earlierDays(s, DAY).map(x => x.d)).toEqual(['2026-11-05', '2026-11-02'])
  })

  it('puts favourites first, then what was logged most recently', () => {
    const s = { ...base(), favEx: [SQUAT] }
    addSet(s, '2026-11-02', PEC, { w: 50, r: 12 })
    addSet(s, DAY, BENCH, { w: 75, r: 8 })
    expect(yourExercises(s)).toEqual([SQUAT, BENCH, PEC])
  })

  it('stamps today with a real start time', () => {
    const s = base()
    const now = Date.now()
    addSet(s, todayISO(), BENCH, { w: 75, r: 8 }, now)
    expect(dayLogOf(s, todayISO()).start).toBe(now)
  })
})
