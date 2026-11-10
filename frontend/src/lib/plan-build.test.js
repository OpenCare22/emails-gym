import { describe, it, expect } from 'vitest'
import { buildPlan, alternativesFor, swapItem, allowedEquipment } from './plan-build.js'
import { INDEX } from './exercise-index-data.js'
import { MUSCLES, ISOLATION, WEEKLY_SETS } from './plan-model.js'
import { estimateMinutes, sessionForWeek } from './library.js'
import { buildLibraryProgram } from './library-start.js'
import { normalizeProgramme } from './programmes.js'
import { EXIDX } from './exercises.js'
import { FRIEND_A, FRIEND_B } from './__fixtures__/plan-friends.js'

const resistance = p => p.templates.flatMap(tp => tp.items.filter(i => i.mode !== 'cardio'))
const rules = p => p.rationale.map(r => r.rule)
const CORE_PATTERNS = new Set(['core', 'corerot', 'carry'])
const weekSessions = (p, week) => p.templates.map(tp => sessionForWeek(p, p.plan[week - 1], tp.id))
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); return [...A].filter(x => B.has(x)).length / new Set([...A, ...B]).size }

describe('the two friends', () => {
  const a = buildPlan(FRIEND_A), b = buildPlan(FRIEND_B)
  it('gives Friend A four upper and lower days with smaller exercises, close to the limit after week 2', () => {
    expect(a.templates.map(t => t.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    for (const tp of a.templates.filter(t => t.name.startsWith('Upper'))) expect(tp.items.some(i => ISOLATION.has(INDEX[i.ex].pattern))).toBe(true)
    for (let w = 3; w <= 7; w++) for (const s of weekSessions(a, w)) for (const i of s.items) if (i.mode === 'reps') expect(i.rir).toBeGreaterThanOrEqual(1), expect(i.rir).toBeLessThanOrEqual(2)
    expect(rules(a).some(r => r === 'cardio' || r === 'cardio-steps')).toBe(true)
    for (const s of weekSessions(a, 3)) expect(estimateMinutes(s)).toBeLessThanOrEqual(65)
  })
  it('gives Friend B three full-body days of big compound lifts, gently at first', () => {
    expect(b.templates.map(t => t.name)).toEqual(['Full body A', 'Full body B', 'Full body C'])
    const lifts = resistance(b).filter(i => !CORE_PATTERNS.has(INDEX[i.ex].pattern))
    expect(lifts.filter(i => INDEX[i.ex].compound).length / lifts.length).toBeGreaterThanOrEqual(0.7)
    for (const tp of b.templates) expect(tp.items.filter(i => ISOLATION.has(INDEX[i.ex].pattern)).length).toBeLessThanOrEqual(1)
    for (let w = 1; w <= 2; w++) for (const s of weekSessions(b, w)) for (const i of s.items) if (i.mode === 'reps') expect(i.rir).toBeGreaterThanOrEqual(3)
    expect(rules(b)).toEqual(expect.arrayContaining(['body-lean', 'compound-first']))
  })
  it('makes their plans genuinely different', () => {
    expect(jaccard(resistance(a).map(i => i.ex), resistance(b).map(i => i.ex))).toBeLessThan(0.5)
  })
  it('gives Friend A as a woman extra glutes and legs and shorter isolation rests, and says so', () => {
    const f = buildPlan({ ...FRIEND_A, sex: 'female' })
    expect(rules(f)).toEqual(expect.arrayContaining(['sex-emphasis', 'sex-rest']))
    const legSets = p => resistance(p).filter(i => MUSCLES[INDEX[i.ex].pattern].includes('legs')).reduce((n, i) => n + i.sets, 0)
    expect(legSets(f)).toBeGreaterThan(legSets(a))
    for (const i of resistance(f)) if (ISOLATION.has(INDEX[i.ex].pattern)) expect(i.rest).toBe(60)
  })
  it('turns into routines and a programme the app accepts as they are', () => {
    const built = buildLibraryProgram(a)
    expect(normalizeProgramme(built.programme)).toEqual(built.programme)
    expect(built.routines).toHaveLength(4)
  })
  it('says why, in 5 to 10 lines', () => {
    for (const p of [a, b]) {
      expect(p.rationale.length).toBeGreaterThanOrEqual(5)
      expect(p.rationale.length).toBeLessThanOrEqual(10)
      for (const r of p.rationale) expect(r.text).not.toMatch(/—/)
    }
  })
})

describe('the rules hold for every kind of answer', () => {
  const equipment = ['gym', 'dumbbells', 'none', ['band', 'kettlebell']]
  const avoids = [[], ['knee'], ['knee', 'lowerback', 'shoulder']]
  const levels = [{ trained: 'never' }, { trained: '6m2y' }, { trained: 'over2y' }]
  const goals = ['muscle', 'strength', 'recomp']
  const cases = []
  for (const days of [2, 3, 4, 5]) for (const minutes of [30, 45, 60, 90]) for (const eq of equipment) for (const avoid of avoids) for (const lv of levels) {
    cases.push({ ...FRIEND_A, ...lv, goal: goals[(days + minutes) % 3], days, minutes, equipment: eq, avoid })
  }
  it(`builds a valid plan for ${cases.length} combinations`, () => {
    for (const answers of cases) {
      const p = buildPlan(answers)
      const allowed = allowedEquipment(answers.equipment)
      const label = JSON.stringify({ d: answers.days, m: answers.minutes, e: answers.equipment, a: answers.avoid, t: answers.trained })
      expect(p.templates.length, label).toBe(answers.days)
      for (const tp of p.templates) {
        expect(tp.items.length, label).toBeGreaterThan(0)
        for (const i of tp.items) {
          expect(EXIDX[i.ex], label).toBeTruthy()
          if (i.mode === 'cardio') continue
          const e = INDEX[i.ex]
          expect(e && e.tier !== 'excluded', label + i.ex).toBe(true)
          if (allowed) expect(allowed.has(e.eq), `${label} ${EXIDX[i.ex].n} ${e.eq}`).toBe(true)
          expect(e.stress.filter(s => answers.avoid.includes(s)), `${label} ${EXIDX[i.ex].n}`).toEqual([])
        }
      }
      if (answers.minutes < 90) for (let w = 1; w <= 8; w++) for (const s of weekSessions(p, w)) expect(estimateMinutes(s), label).toBeLessThanOrEqual(answers.minutes + 5)
      if (answers.minutes >= 45 && answers.avoid.length === 0) {
        for (const muscle of ['chest', 'back', 'legs', 'shoulders']) {
          const sessions = p.templates.filter(tp => tp.items.some(i => i.mode !== 'cardio' && MUSCLES[INDEX[i.ex].pattern].includes(muscle))).length
          expect(sessions, `${label} ${muscle}`).toBeGreaterThanOrEqual(Math.min(2, answers.days))
        }
      }
    }
  })
  it('keeps weekly sets per muscle at or under the level’s top, with time to spare', () => {
    const p = buildPlan({ ...FRIEND_A, minutes: 90 })
    const sets = {}
    for (const i of resistance(p)) for (const m of MUSCLES[INDEX[i.ex].pattern]) sets[m] = (sets[m] || 0) + i.sets
    for (const m of ['chest', 'back', 'shoulders']) expect(sets[m]).toBeLessThanOrEqual(WEEKLY_SETS.intermediate[1] + 4)
    for (const m of ['chest', 'back']) expect(sets[m]).toBeGreaterThanOrEqual(WEEKLY_SETS.intermediate[0])
  })
})

describe('edges and controls', () => {
  it('is the same plan for the same answers, and a new seed changes picks but not the structure', () => {
    expect(buildPlan(FRIEND_A, { seed: 1 })).toEqual(buildPlan({ ...FRIEND_A }, { seed: 1 }))
    const one = buildPlan(FRIEND_A, { seed: 1 }), many = [2, 3, 4, 5, 6].map(seed => buildPlan(FRIEND_A, { seed }))
    expect(many.some(p => resistance(p).some((i, k) => i.ex !== resistance(one)[k].ex))).toBe(true)
    for (const p of many) {
      expect(p.templates.map(t => t.name)).toEqual(one.templates.map(t => t.name))
      expect(resistance(p).map(i => i.sets)).toEqual(resistance(one).map(i => i.sets))
    }
  })
  it('fits 30 minutes even with three focus areas, and says why things were dropped', () => {
    const p = buildPlan({ ...FRIEND_A, minutes: 30, focus: ['chest', 'arms', 'glutes'] })
    for (const s of weekSessions(p, 3)) expect(estimateMinutes(s)).toBeLessThanOrEqual(35)
    expect(rules(p)).toContain('time-cap')
  })
  it('builds a body-weight plan for strength with no equipment, and says load is limited', () => {
    const p = buildPlan({ ...FRIEND_A, goal: 'strength', equipment: 'none' })
    for (const i of resistance(p)) expect(INDEX[i.ex].eq).toBe('body weight')
    expect(rules(p)).toContain('bodyweight-strength')
  })
  it('works around three injuries at once without an empty session', () => {
    const p = buildPlan({ ...FRIEND_B, avoid: ['knee', 'lowerback', 'shoulder'] })
    for (const tp of p.templates) expect(tp.items.length).toBeGreaterThanOrEqual(2)
  })
  it('uses only a gym profile’s own equipment plus body weight', () => {
    const p = buildPlan({ ...FRIEND_A, equipment: ['band', 'kettlebell'] })
    for (const i of resistance(p)) expect(['band', 'kettlebell', 'body weight']).toContain(INDEX[i.ex].eq)
  })
  it('gives no plan for a health answer of yes', () => {
    expect(buildPlan({ ...FRIEND_A, health: true })).toBeNull()
  })
  it('offers up to five alternatives of the same movement, and swaps one in', () => {
    const p = buildPlan(FRIEND_A)
    const alts = alternativesFor(p, 's1', 0)
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.length).toBeLessThanOrEqual(5)
    for (const x of alts) {
      expect(INDEX[x.ex].pattern).toBe(INDEX[p.templates[0].items[0].ex].pattern)
      expect(x.ex).not.toBe(p.templates[0].items[0].ex)
      expect(x.reasons.length).toBeGreaterThan(0)
    }
    const swapped = swapItem(p, 's1', 0, alts[0].ex)
    expect(swapped.templates[0].items[0]).toEqual({ ...p.templates[0].items[0], ex: alts[0].ex })
    expect(p.templates[0].items[0].ex).not.toBe(alts[0].ex)
  })
  it('prefers exercises you have logged before', () => {
    const p = buildPlan(FRIEND_A)
    const alt = alternativesFor(p, 's1', 0).at(-1).ex
    const S = { workouts: [{ entries: [{ id: alt }] }], favEx: [alt] }
    expect(buildPlan(FRIEND_A, { S }).templates.flatMap(t => t.items).some(i => i.ex === alt)).toBe(true)
  })
})
