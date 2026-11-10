import { describe, it, expect } from 'vitest'
import { classify, patternOf, PATTERNS, COMPOUND_PATTERNS } from './exercise-index.js'
import { INDEX, BY_PATTERN } from './exercise-index-data.js'
import { EXIDX } from './exercises.js'

const ex = (name, extra = {}) => ({ id: 'x', name, target: 'quads', bodyPart: 'upper legs', equipment: 'dumbbell', category: 'strength', secondaryMuscles: [], ...extra })

describe('classify', () => {
  it('marks a core barbell bench press as a skilled compound push', () => {
    const e = classify({ id: '0025', name: 'barbell bench press', target: 'pectorals', bodyPart: 'chest', equipment: 'barbell', category: 'strength' }, { core: { '0025': 'hpush' } })
    expect(e).toMatchObject({ pattern: 'hpush', compound: true, skill: 3, tier: 'core' })
    expect(e.stress).toContain('shoulder')
  })
  it('excludes stretching, mobility, yoga, pilates, rehab, combat and cardio', () => {
    for (const category of ['stretching', 'mobility', 'yoga', 'pilates', 'rehab', 'combat', 'cardio']) {
      expect(classify(ex('dumbbell squat', { category })).tier).toBe('excluded')
    }
  })
  it('never treats numbered versions, camera angles or one side as standard', () => {
    for (const name of ['dumbbell squat v. 2', 'dumbbell squat (side pov)', 'dumbbell squat (left)', 'dumbbell squat with knee raise']) {
      expect(classify(ex(name)).tier).toBe('variant')
    }
  })
  it('grades skill: machines 1, dumbbells 2, barbell compounds 3', () => {
    expect(classify(ex('lever full squat', { equipment: 'leverage machine' })).skill).toBe(1)
    expect(classify(ex('dumbbell squat')).skill).toBe(2)
    expect(classify(ex('barbell full squat', { equipment: 'barbell' })).skill).toBe(3)
  })
  it('records the areas a lift loads', () => {
    expect(classify(ex('dumbbell squat')).stress).toContain('knee')
    expect(classify(ex('barbell deadlift', { equipment: 'barbell', target: 'glutes' })).stress).toContain('lowerback')
    expect(classify(ex('dumbbell shoulder press', { target: 'delts', bodyPart: 'shoulders' })).stress).toContain('shoulder')
  })
  it('lets an override win', () => {
    const e = classify(ex('dumbbell squat'), { overrides: { x: { pattern: 'lunge', tier: 'variant', stress: [] } } })
    expect(e).toMatchObject({ pattern: 'lunge', tier: 'variant', stress: [] })
  })
  it('reads crunches and leg raises as core work', () => {
    expect(patternOf(ex('hanging leg raise', { target: 'abs', bodyPart: 'waist' }))).toBe('core')
  })
})

describe('the generated index', () => {
  const core = Object.entries(INDEX).filter(([, e]) => e.tier === 'core')
  it('gives every core exercise a pattern, and ships nothing excluded', () => {
    for (const [, e] of core) expect(PATTERNS).toContain(e.pattern)
    for (const e of Object.values(INDEX)) expect(e.tier).not.toBe('excluded')
  })
  it('lists every eligible exercise under its pattern, and only real catalogue exercises', () => {
    for (const [p, ids] of Object.entries(BY_PATTERN)) for (const id of ids) {
      expect(INDEX[id].pattern).toBe(p)
      expect(EXIDX[id]).toBeTruthy()
    }
  })
  it('has no stretch or numbered variant in the core list', () => {
    for (const [id] of core) expect(EXIDX[id].n).not.toMatch(/ v\. ?\d|pov|stretch/)
  })
  it('covers each main movement with barbell, dumbbell, body weight and a machine or cable', () => {
    const has = (p, eqs) => core.some(([, e]) => e.pattern === p && eqs.includes(e.eq))
    for (const p of ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'lunge']) {
      if (p !== 'vpull') expect(has(p, ['dumbbell']), p + ' dumbbell').toBe(true)
      expect(has(p, ['body weight', 'band']), p + ' body weight or band').toBe(true)
      expect(has(p, ['cable', 'leverage machine', 'smith machine', 'sled machine']), p + ' machine').toBe(true)
      if (p !== 'vpull') expect(has(p, ['barbell', 'trap bar']), p + ' barbell').toBe(true)
    }
    expect(COMPOUND_PATTERNS.has('squat')).toBe(true)
  })
})
