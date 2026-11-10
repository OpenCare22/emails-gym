import { describe, it, expect } from 'vitest'
import { programs } from './library-data.js'
import { matchPrograms, exclusions, MATCH_VERSION, WEIGHTS } from './program-match.js'

const base = { goal: 'muscle', level: 'intermediate', days: 4, minutes: 90, equipment: 'gym', cardio: 'some', health: false }
const ids = r => r.matches.map(m => m.program.id)

describe('finding a program (master plan §5 fixtures)', () => {
  it('intermediate, 4 days, full gym, 90 min, muscle: build-4 first', () => {
    const r = matchPrograms(base, programs)
    expect(ids(r)[0]).toBe('build-4')
    expect(r.matches[0].score).toBe(WEIGHTS.goal + WEIGHTS.days + WEIGHTS.minutes + WEIGHTS.level)
    expect(r.matches.length).toBeLessThanOrEqual(3)
  })
  it('with 60 min, build-4 still fits: its longest session is estimated at 60', () => {
    const r = matchPrograms({ ...base, minutes: 60 }, programs)
    expect(ids(r)[0]).toBe('build-4')
  })
  it('beginner, 2 days, dumbbells only: no gym plan is offered', () => {
    const r = matchPrograms({ ...base, goal: 'general', level: 'beginner', days: 2, minutes: 45, equipment: 'dumbbells' }, programs)
    expect(r.matches).toEqual([])
    expect(r.excluded.find(e => e.program.id === 'foundation-2').reasons.join(' ')).toMatch(/equipment/)
  })
  it('beginner, 2 days, full gym: foundation-2 first', () => {
    const r = matchPrograms({ ...base, goal: 'general', level: 'beginner', days: 2, minutes: 45 }, programs)
    expect(ids(r)[0]).toBe('foundation-2')
  })
  it('5 days with no equipment: no match until a body-weight plan exists', () => {
    expect(matchPrograms({ ...base, days: 5, equipment: 'none' }, programs).matches).toEqual([])
  })
  it('a health answer of yes suggests a professional and no program', () => {
    expect(matchPrograms({ ...base, health: true }, programs)).toEqual({ version: MATCH_VERSION, matches: [], excluded: [], advice: 'professional' })
  })
})

describe('the rules', () => {
  it('never offers more days than you have, or a program over your time by more than 10 min', () => {
    for (const days of [2, 3, 4, 5]) for (const minutes of [30, 45, 60]) {
      for (const m of matchPrograms({ ...base, days, minutes }, programs).matches) {
        expect(m.program.days).toBeLessThanOrEqual(days)
        expect(m.program.minutes[1]).toBeLessThanOrEqual(minutes + 10)
      }
    }
  })
  it('keeps a beginner off intermediate-only programs', () => {
    for (const m of matchPrograms({ ...base, level: 'beginner' }, programs).matches) {
      expect(m.program.level.some(l => l === 'beginner' || l === 'any')).toBe(true)
    }
  })
  it('excludes an unrelated goal instead of offering it as second best', () => {
    const r = matchPrograms({ ...base, goal: 'endurance', cardio: 'much' }, programs)
    expect(ids(r).every(id => ['conditioning-3', 'hybrid-4'].includes(id))).toBe(true)
    expect(exclusions(programs.find(p => p.id === 'build-4'), { ...base, goal: 'endurance' }).join(' ')).toMatch(/Built for/)
  })
  it('says why each match fits and what it does not', () => {
    const r = matchPrograms({ ...base, days: 5 }, programs)
    const build = r.matches.find(m => m.program.id === 'build-4')
    expect(build.why).toContain('Built for muscle growth')
    expect(build.compromises).toContain('4 days a week instead of the 5 you have')
  })
  it('gives the same answer for the same answers', () => {
    const a = matchPrograms(base, programs), b = matchPrograms({ ...base }, [...programs].reverse())
    expect(ids(a)).toEqual(ids(b))
    expect(a.matches.map(m => m.score)).toEqual(b.matches.map(m => m.score))
  })
  it('matches against a gym profile\'s own equipment list', () => {
    const r = matchPrograms({ ...base, goal: 'general', level: 'beginner', days: 2, minutes: 45, equipment: ['dumbbell', 'cable', 'sled machine'] }, programs)
    expect(ids(r)[0]).toBe('foundation-2')
    expect(matchPrograms({ ...base, equipment: ['dumbbell'] }, programs).matches).toEqual([])
  })
  it('never offers a retired program', () => {
    const retired = programs.map(p => p.id === 'build-4' ? { ...p, review: { ...p.review, status: 'retired' } } : p)
    expect(ids(matchPrograms(base, retired))).not.toContain('build-4')
  })
})
