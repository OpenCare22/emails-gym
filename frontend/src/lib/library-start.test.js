import { describe, it, expect } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { programs } from './library-data.js'
import { buildLibraryProgram, intervalNote, weekdayOf } from './library-start.js'
import { startProgramme, endProgramme, programmeSlot, normalizeProgramme } from './programmes.js'

describe('library copies', () => {
  it('copies every program without sharing references and preserves every weekly target', () => {
    for (const p of programs) {
      const before = JSON.stringify(p)
      let id = 0
      const built = buildLibraryProgram(p, () => `new${++id}`, 123)
      expect(built.programme.src).toEqual({ lib: p.id, version: p.version })
      expect(normalizeProgramme(built.programme)).toEqual(built.programme)
      p.templates.forEach((template, n) => {
        const routine = built.routines[n]
        expect(built.programme.days[weekdayOf(template.day)]).toContain(routine.id)
        template.items.forEach((i, j) => {
          const slot = routine.ex[j]
          expect(slot.id).toBe(i.ex)
          if (i.mode === 'time') expect(slot.sec).toBe(i.sec[0])
          if (i.mode === 'reps') expect([slot.repsMin, slot.reps]).toEqual(i.reps)
          if (i.side) expect(slot.side).toBe(true)
        })
        p.plan.forEach((w, wn) => {
          let lift = 0, cardio = 0
          template.items.forEach(i => {
            const actual = built.programme.weeks[wn].t[`${routine.id}:${i.ex}`]
            if (i.mode === 'cardio') {
              const expected = w.cardio[template.id][cardio++]
              expect(actual.min).toBe(expected.min)
              if (expected.intervals) expect(actual.note).toBe(intervalNote(expected.intervals))
            } else if (i.mode === 'time') expect(actual).toEqual({ sets: w.items[template.id][lift++].sets })
            else expect(actual).toEqual(w.items[template.id][lift++])
          })
        })
      })
      built.routines[0].ex[0].sets = 9
      built.programme.weeks[0].t = {}
      expect(JSON.stringify(p)).toBe(before)
      expect(buildLibraryProgram(p).programme.id).not.toBe(buildLibraryProgram(p).programme.id)
    }
  })
  it('starts through the existing engine, replaces a run and restores the original plan', () => {
    const s = { routines: [], week: { 2: ['original'] }, programmes: {} }
    for (const p of programs.slice(0, 2)) {
      const b = buildLibraryProgram(p)
      s.routines.push(...b.routines)
      s.programmes[b.programme.id] = b.programme
      startProgramme(s, b.programme.id, '2026-11-09')
      expect(s.week).toEqual(b.programme.days)
      expect(s.programme.saved.week).toEqual({ 2: ['original'] })
      const r = b.routines[0]
      expect(programmeSlot(s, r.id, r.ex[0].id, '2026-11-09').sets).toBe(1)
    }
    endProgramme(s, '2026-11-10')
    expect(s.week).toEqual({ 2: ['original'] })
  })
  it('opens copied slots in the existing workout builder with week-one targets', () => {
    for (const p of programs) {
      const b = buildLibraryProgram(p)
      const s = { unit: 'kg', workouts: [], exWeights: {}, routines: b.routines, programmes: { [b.programme.id]: b.programme }, week: {} }
      startProgramme(s, b.programme.id)
      b.routines.forEach(r => {
        const entries = buildSessionEntries(s, r)
        entries.forEach((entry, n) => {
          const slot = r.ex[n]
          const target = b.programme.weeks[0].t[`${r.id}:${slot.id}`]
          if (slot.mode === 'cardio') expect(entry.sets[0].min).toBe(target.min)
          else {
            const work = entry.sets.filter(row => !row.warmup)
            expect(work).toHaveLength(target.sets)
            if (slot.mode === 'time') expect(work[0].sec).toBe(slot.sec)
            else { expect(entry.plan.prog.rpe).toBe(10 - target.rir); expect(Number.isFinite(work[0].w)).toBe(true) }
          }
        })
      })
    }
  })
  it('maps library days to weekdays, Sunday as 0', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(weekdayOf)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })
  it('keeps routine slots to routine fields: no RIR on a slot, no RIR target on a hold, sets on cardio', () => {
    for (const p of programs) {
      const b = buildLibraryProgram(p)
      for (const r of b.routines) for (const slot of r.ex) {
        expect(slot.rir).toBeUndefined()
        if (slot.mode === 'cardio') expect(slot.sets).toBe(1)
        if (slot.mode === 'time') for (const w of b.programme.weeks) expect(w.t[`${r.id}:${slot.id}`].rir).toBeUndefined()
      }
    }
  })
  it('describes interval effort and all segments', () => {
    expect(intervalNote({ warmup: 6, rounds: 3, hard: 2, hardRpe: 7, easy: 3, cooldown: 4 }))
      .toBe('6 min easy, 3 rounds of 2 min hard (RPE 7) and 3 min easy, 4 min easy')
  })
})
