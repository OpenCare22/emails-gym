// Intervals from a program week to a logged row: the library plan rides on the programme week,
// the session's cardio entry carries it, the timer logs the rounds, and History reads them.
import { describe, it, expect } from 'vitest'
import { buildLibraryProgram } from './library-start.js'
import { normalizeProgramme, programmeSlot, startProgramme } from './programmes.js'
import { buildPlannedEntry } from './session-start.js'
import { setLabel } from './history.js'
import { logIntervalRun } from './intervals.js'
import { EXDB } from './exercises.js'

const C3 = { warmup: 6, hard: 2, easy: 3, rounds: 2, cooldown: 4, hardRpe: 8 }
const RUN = EXDB.find(e => e.bp === 'cardio').id

describe('intervals through a program', () => {
  const program = {
    id: 'iv-test', version: 1, title: 'Interval test',
    templates: [{ id: 'a', name: 'Run', day: 1, items: [{ ex: RUN, mode: 'cardio', min: 25, intensity: 'interval' }] }],
    plan: [{ week: 1, items: { a: [] }, cardio: { a: [{ min: 25, intervals: C3 }] } }],
  }
  it('keeps the structured plan on the programme week', () => {
    const built = buildLibraryProgram(program, (() => { let n = 0; return () => 'id' + ++n })())
    const key = `${built.routines[0].id}:${RUN}`
    expect(built.programme.weeks[0].t[key]).toMatchObject({ min: 25, intervals: C3 })
    expect(normalizeProgramme(built.programme).weeks[0].t[key].intervals).toEqual(C3)
  })
  it('the session entry carries it', () => {
    const built = buildLibraryProgram(program)
    const s = { unit: 'kg', routines: built.routines, programmes: { [built.programme.id]: built.programme }, week: {}, workouts: [] }
    startProgramme(s, built.programme.id, '2026-11-09')
    const routine = s.routines[0]
    expect(programmeSlot(s, routine.id, RUN, '2026-11-09')).toMatchObject({ intervals: C3 })
    s.active = { d: '2026-11-09' }
    const entry = buildPlannedEntry(s, routine.ex[0], routine)
    expect(entry.target.intervals).toEqual(C3)
  })
})

describe('logging a run', () => {
  const state = () => ({ active: { entries: [{ id: RUN, target: { mode: 'cardio', min: 25, speed: 9, intervals: C3 }, ivRun: { at: 1, paused: 0 }, sets: [{ min: 25, speed: 9, done: false }] }] } })
  it('fills the open row with minutes and rounds and ends the run', () => {
    const s = state()
    expect(logIntervalRun(s, 0, 25 * 60)).toBe(true)
    const row = s.active.entries[0].sets[0]
    expect(row).toMatchObject({ min: 25, speed: 9, done: true, iv: { ...C3, done: 2 } })
    expect(s.active.entries[0]).not.toHaveProperty('ivRun')
  })
  it('a run stopped early logs what was done', () => {
    const s = state()
    logIntervalRun(s, 0, 9 * 60)
    expect(s.active.entries[0].sets[0]).toMatchObject({ min: 9, iv: { done: 1 } })
  })
  it('adds a row when every row is already logged', () => {
    const s = state(); s.active.entries[0].sets[0].done = true
    logIntervalRun(s, 0, 60)
    expect(s.active.entries[0].sets).toHaveLength(2)
  })
  it('History reads the rounds', () => {
    expect(setLabel(RUN, { min: 25, speed: 9, done: true, iv: { ...C3, done: 2 } }, { mode: 'cardio' })).toBe('25 min · 2 rounds of 2 min hard')
    expect(setLabel(RUN, { min: 25, speed: 9, done: true }, { mode: 'cardio' })).toBe('25 min @ 9 km/h')
  })
})
