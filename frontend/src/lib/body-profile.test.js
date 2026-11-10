import { describe, it, expect } from 'vitest'
import { bodyOf, setBody, latestWeightKg, heightFromImperial, imperialFromCm, kgFromLb, ageOf } from './body-profile.js'
import { stampChange, mergeStates } from './sync-merge.js'

describe('body details', () => {
  it('saves only sensible values', () => {
    const S = {}
    setBody(S, { heightCm: 176.04, birthYear: 2000, sex: 'male' }, new Date('2026-11-10'))
    expect(S.body).toEqual({ heightCm: 176, birthYear: 2000, sex: 'male' })
    setBody(S, { heightCm: 400, birthYear: 2020, sex: 'robot' }, new Date('2026-11-10'))
    expect(S.body).toEqual({ heightCm: 176, birthYear: 2000, sex: 'male' })
    expect(bodyOf({})).toBeNull()
    expect(setBody({}, {})).toBeNull()
  })
  it('converts feet, inches and pounds exactly', () => {
    expect(heightFromImperial(5, 10)).toBe(177.8)
    expect(imperialFromCm(177.8)).toEqual({ ft: 5, inch: 10 })
    expect(kgFromLb(165)).toBe(74.84)
  })
  it('reads the latest weigh-in in kg, whatever the profile unit', () => {
    expect(latestWeightKg({ unit: 'kg', bodyweight: [{ d: '2026-11-01', w: 76 }, { d: '2026-11-09', w: 75 }] })).toBe(75)
    expect(latestWeightKg({ unit: 'lb', bodyweight: [{ d: '2026-11-09', w: 165 }] })).toBe(74.84)
    expect(latestWeightKg({ bodyweight: [] })).toBeNull()
  })
  it('knows the age from the birth year', () => {
    expect(ageOf({ birthYear: 2000 }, new Date('2026-11-10'))).toBe(26)
    expect(ageOf(null)).toBeNull()
  })
  it('syncs as one setting: the newer edit wins', () => {
    const before = { unit: 'kg', body: null }
    const mine = { ...before, body: { heightCm: 176, sex: 'male' } }
    mine._ts = stampChange(before, mine, 1000)
    const theirs = { ...before, body: { heightCm: 180 } }
    theirs._ts = stampChange(before, theirs, 2000)
    expect(mergeStates(mine, theirs).body).toEqual({ heightCm: 180 })
    expect(mergeStates(theirs, mine).body).toEqual({ heightCm: 180 })
  })
})
