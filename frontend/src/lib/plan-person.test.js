import { describe, it, expect } from 'vitest'
import { personOf, bmiOf } from './plan-person.js'
import { FRIEND_A, FRIEND_B } from './__fixtures__/plan-friends.js'

const rules = p => p.reasons.map(r => r.rule)

describe('the person', () => {
  it('reads Friend A as an intermediate recomposition', () => {
    expect(personOf(FRIEND_A)).toMatchObject({ level: 'intermediate', bmiBand: 'normal', emphasis: 'recomp', focus: [], days: 4, minutes: 60 })
  })
  it('reads Friend B as a novice gaining, lean for his height', () => {
    const p = personOf(FRIEND_B)
    expect(bmiOf(187, 68)).toBeCloseTo(19.45, 2)
    expect(p).toMatchObject({ level: 'novice', bmiBand: 'normal', emphasis: 'gain' })
    expect(rules(p)).toContain('body-lean')
  })
  it('notices a strong newcomer without promoting a lifter with no history', () => {
    const strongNew = personOf({ ...FRIEND_B, pushups: '25+', squats: '30+' })
    expect(strongNew.level).toBe('novice')
    expect(rules(strongNew)).toContain('level-ability')
    expect(personOf({ ...FRIEND_B, trained: 'under6m', pushups: '25+', squats: '30+', barbell: true }).level).toBe('intermediate')
  })
  it('gives a woman glutes and legs by default, unless she picks her own focus', () => {
    const f = personOf({ ...FRIEND_A, sex: 'female' })
    expect(f.focus).toEqual(['glutes', 'legs'])
    expect(rules(f)).toEqual(expect.arrayContaining(['sex-emphasis', 'sex-rest']))
    expect(personOf({ ...FRIEND_A, sex: 'female', focus: ['arms'] }).focus).toEqual(['arms'])
    expect(personOf({ ...FRIEND_A, sex: 'none' }).focus).toEqual([])
  })
  it('treats 50 and over as needing a gentler start', () => {
    expect(personOf({ ...FRIEND_A, age: 55 }).older).toBe(true)
    expect(personOf(FRIEND_A).older).toBe(false)
  })
  it('works without height or weight', () => {
    const p = personOf({ ...FRIEND_A, heightCm: null, weightKg: undefined })
    expect(p.bmiBand).toBeNull()
  })
  it('keeps answers inside what the model supports', () => {
    const p = personOf({ ...FRIEND_A, days: 9, minutes: 17, equipment: 'spaceship', focus: ['chest', 'nose'], avoid: ['knee', 'elbow'] })
    expect(p).toMatchObject({ days: 5, minutes: 60, equipment: 'gym', focus: ['chest'], avoid: ['knee'] })
  })
})
