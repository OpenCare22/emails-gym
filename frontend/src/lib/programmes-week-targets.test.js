import { describe, it, expect } from 'vitest'
import { cleanWeek, resizeWeeks, stepWeek, bundleProgramme, importedProgramme, IMPORT_MAX_TARGETS, rpeAs } from './programmes.js'
import { buildSessionEntries } from './session-start.js'
import { readSession } from './progression.js'
import { buildProgrammeBundle, parsePlan, mergePlan } from './plan-share.js'

const cfg = { id: '0025', sets: 3, reps: 5, weight: 60, warmupSets: 2, note: 'Routine note' }
const routine = { id: 'A', name: 'Day A', ex: [cfg] }
const state = week => ({ unit: 'kg', workouts: [], exWeights: {}, routines: [routine], active: { d: '2026-10-19' },
  programmes: { P: { id: 'P', name: 'Block', days: { 1: ['A'] }, weeks: [week] } },
  programme: { id: 'P', startedOn: '2026-10-19' } })
const work = e => e.sets.filter(s => !s.warmup && s.phase !== 'warmup')

describe('week volume, effort, duration and notes', () => {
  it('cleans each field and keeps standalone targets', () => {
    expect(cleanWeek({ t: { a: { sets: 1 }, b: { rir: 0 }, c: { sets: 10, rir: 5, min: 300, note: '  easy  ' }, d: { rpe: 8, rir: 2 } } }))
      .toEqual({ t: { a: { sets: 1 }, b: { rir: 0 }, c: { sets: 10, rir: 5, min: 300, note: 'easy' }, d: { rpe: 8 } } })
    for (const v of [-1, 301, NaN, Infinity, '2', true, {}, null]) expect(cleanWeek({ t: { a: { sets: v, rir: v, min: v, note: false } } })).toEqual({})
    expect(cleanWeek({ t: { a: { sets: 1.5, min: 2.5, rir: 2.3, note: 'x'.repeat(201) } } }).t.a).toEqual({ rir: 2.5, note: 'x'.repeat(200) })
  })

  it('copies, steps, bundles and imports all fields, with the import cap', () => {
    const w = { t: { 'A:0025': { pct: 75, sets: 1, rir: 4, min: 20, note: 'Easy' } } }
    expect(resizeWeeks([w], 2)).toEqual([w, w])
    expect(stepWeek(w).t['A:0025']).toEqual({ ...w.t['A:0025'], pct: 77.5 })
    const s = state(w)
    expect(importedProgramme(bundleProgramme(s.programmes.P), { A: 'B' }).weeks[0].t['B:0025']).toEqual(w.t['A:0025'])
    const recipient = { unit: 'kg', routines: [], customEx: [], programmes: {} }
    mergePlan(recipient, parsePlan(JSON.stringify(buildProgrammeBundle(s, 'P'))))
    expect(Object.values(recipient.programmes)[0].weeks[0].t[recipient.routines[0].id + ':0025']).toEqual(w.t['A:0025'])
    const many = { ...s.programmes.P, weeks: [{ t: Object.fromEntries(Array.from({ length: 250 }, (_, i) => ['e' + i, { sets: 1 }])) }] }
    expect(Object.keys(importedProgramme(many, { A: 'B' }).weeks[0].t)).toHaveLength(IMPORT_MAX_TARGETS)
  })

  it('builds one work set, keeps warmups and grades against one, not the routine three', () => {
    const s = state({ rpe: 9, t: { '0025': { sets: 1, rir: 4, note: 'This week' } } })
    const [entry] = buildSessionEntries(s, routine)
    expect(work(entry)).toHaveLength(1)
    expect(entry.sets.filter(x => x.warmup)).toHaveLength(2)
    expect(entry.target).toMatchObject({ sets: 1, note: 'This week' })
    expect(entry.planned.sets).toBe(3)
    expect(entry.plan.prog.rpe).toBe(6)
    expect(rpeAs(entry.plan.prog.rpe, 'rir')).toEqual({ k: 'RIR', v: 4 })
    const logged = { ...entry, sets: entry.sets.map(x => ({ ...x, done: true })) }
    expect(readSession(logged, cfg).ok).toBe(true)
    expect(cfg.sets).toBe(3)
  })

  it('uses explicit sets during deload and preserves its exclusion', () => {
    const [entry] = buildSessionEntries(state({ deload: true, t: { '0025': { sets: 5 } } }), routine)
    expect(work(entry)).toHaveLength(5)
    expect(entry.noProg).toBe(true)
  })

  it('overrides cardio duration while retaining speed and ignores minutes on lifts', () => {
    const cardio = { id: 'A', ex: [{ id: '0025', mode: 'cardio', sets: 1, min: 20, speed: 8 }] }
    const s = state({ t: { '0025': { min: 35, note: 'Intervals' } } })
    s.routines = [cardio]
    const [entry] = buildSessionEntries(s, cardio)
    expect(entry.sets[0]).toMatchObject({ min: 35, speed: 8 })
    expect(entry.target).toMatchObject({ min: 35, note: 'Intervals' })
    expect(buildSessionEntries(state({ t: { '0025': { min: 35 } } }), routine)[0].target.min).toBeUndefined()
  })

  it('keeps the legacy session byte for byte when new fields are absent or invalid', () => {
    // Captured from the pre-ticket session builder, including property order.
    const baseline = [[{"id":"0025","target":{"id":"0025","sets":3,"reps":5,"weight":60,"warmupSets":2,"note":"Routine note"},"plan":{"policy":"linear","kind":"first","why":["Nothing logged yet, so this session sets the baseline."]},"sets":[{"w":30,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":45,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false}],"planned":{"sets":3,"reps":5,"weight":60}}],[{"id":"0025","target":{"id":"0025","sets":3,"reps":5,"weight":60,"warmupSets":2,"note":"Routine note"},"plan":{"policy":"linear","kind":"programme","why":["Week {0} of {1}",1,1,null],"prog":{"week":1,"weeks":1,"rpe":8}},"sets":[{"w":30,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":45,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false}],"planned":{"sets":3,"reps":5,"weight":60}}],[{"id":"0025","target":{"id":"0025","sets":3,"reps":5,"weight":55,"warmupSets":2,"note":"Routine note"},"plan":{"policy":"linear","kind":"programme","why":["Week {0} of {1}: deload week",1,1,null],"weight":55,"prog":{"week":1,"weeks":1,"deload":true}},"sets":[{"w":27.5,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":40,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":55,"r":5,"done":false},{"w":55,"r":5,"done":false},{"w":55,"r":5,"done":false}],"planned":{"sets":3,"reps":5,"weight":60},"noProg":true}],[{"id":"0025","target":{"id":"0025","sets":3,"reps":5,"weight":60,"warmupSets":2,"note":"Routine note"},"plan":{"policy":"linear","kind":"programme","why":["Week {0} of {1}",1,1,75],"prog":{"week":1,"weeks":1,"pct":75,"rpe":8}},"sets":[{"w":30,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":45,"r":5,"done":false,"phase":"warmup","warmup":true},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false},{"w":60,"r":5,"done":false}],"planned":{"sets":3,"reps":5,"weight":60}}]]
    let i = 0
    for (const week of [{}, { rpe: 8 }, { deload: true }, { t: { '0025': { pct: 75, rpe: 8 } } }]) {
      const legacy = JSON.stringify(buildSessionEntries(state(week), routine))
      expect(legacy).toBe(JSON.stringify(baseline[i++]))
      const invalid = { ...week, t: { ...week.t, '0025': { ...week.t?.['0025'], sets: '1', rir: 9, min: -1, note: false } } }
      expect(JSON.stringify(buildSessionEntries(state(invalid), routine))).toBe(legacy)
    }
  })
})
