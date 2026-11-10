import { describe, it, expect, vi } from 'vitest'
import { stepsOn, latestRestingHr, weekAverageSteps, applyWeighIns, fillWorkoutHeartRate, useGoogleHealth } from './google-health.js'

const mocks = vi.hoisted(() => ({ store: null, api: vi.fn() }))
vi.mock('./api.js', () => ({ api: mocks.api }))
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => mocks.store } }))

const data = { steps: { '2026-11-07': 9000, '2026-11-08': 7000, '2026-11-09': 8000, '2026-11-10': 2500 }, restingHr: { '2026-11-09': 60, '2026-11-10': 58 } }

describe('Google Health in the app', () => {
  it('reads today’s steps and the latest resting heart rate', () => {
    expect(stepsOn(data, '2026-11-10')).toBe(2500)
    expect(stepsOn(data, '2026-11-11')).toBeNull()
    expect(latestRestingHr(data)).toEqual({ bpm: 58, d: '2026-11-10' })
    expect(latestRestingHr({})).toBeNull()
  })
  it('averages the week before today, only with enough days', () => {
    expect(weekAverageSteps(data, '2026-11-10')).toBe(8000)
    expect(weekAverageSteps({ steps: { '2026-11-09': 1 } }, '2026-11-10')).toBeNull()
  })
  it('adds Fitbit weigh-ins once, in the profile unit, and never over a day weighed by hand', () => {
    const S = { unit: 'kg', bodyweight: [{ d: '2026-11-08', w: 76, t: 1, ins: [{ id: 'm', at: '07:00', w: 76, t: 1 }] }] }
    const weights = [
      { id: 'w1', at: '2026-11-08T06:00:00Z', d: '2026-11-08', kg: 75.9 },
      { id: 'w2', at: '2026-11-09T06:00:00Z', d: '2026-11-09', kg: 75.4 },
    ]
    expect(applyWeighIns(S, weights)).toBe(1)
    expect(applyWeighIns(S, weights)).toBe(0)
    const day = S.bodyweight.find(b => b.d === '2026-11-09')
    expect(day.w).toBe(75.4)
    expect(day.ins[0]).toMatchObject({ src: 'google', sid: 'w2' })
    expect(S.bodyweight.find(b => b.d === '2026-11-08').w).toBe(76)
    const L = { unit: 'lb', bodyweight: [] }
    applyWeighIns(L, [weights[1]])
    expect(L.bodyweight[0].w).toBe(166.2)
  })
})

describe('Fitbit workout heart rate', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  const workout = (id, start = now - 3600000) => ({ id, start, end: start + 40 * 60000,
    entries: [{ id: 'bench', sets: [{ done: true, r: 10, at: start + 60000 }, { done: true, r: 10, at: start + 180000 }] }] })
  it('fills a 40-minute session and sets, preserving watch readings and requesting padding', async () => {
    const w = workout('a'), watch = { avg: 150, max: 160 }
    w.entries[0].sets[0].hr = watch
    const S = { workouts: [w, { ...workout('watch'), hr: { ...watch, src: 'watch' } }] }
    const calls = []
    const ids = await fillWorkoutHeartRate(S, async (start, end) => {
      calls.push([start, end])
      return Array.from({ length: 241 }, (_, i) => ({ t: w.start + i * 10000, bpm: 120 }))
    }, { now })
    expect(ids).toEqual(['a'])
    expect(calls).toEqual([[w.start - 120000, w.end + 120000]])
    expect(w.hr).toEqual({ avg: 120, max: 120, src: 'gh', n: 241 })
    expect(w.entries[0].sets[0].hr).toEqual(watch)
    expect(w.entries[0].sets[1].hr).toEqual({ avg: 120, max: 120 })
    expect(w.entries[0].sets[0].restHr).toEqual({ avg: 120, max: 120 })
    expect(S.workouts[1].hr.src).toBe('watch')
  })
  it('tries at most five newest sessions, skipping old, unfinished, future and previously tried ones', async () => {
    const S = { workouts: [workout('old', now - 15 * 864e5), { ...workout('active'), end: null }, workout('future', now),
      ...Array.from({ length: 8 }, (_, i) => workout(String(i), now - (i + 1) * 3600000)).reverse()] }
    const ids = await fillWorkoutHeartRate(S, async () => [], { now, tried: ['0'] })
    expect(ids).toEqual(['1', '2', '3', '4', '5'])
    expect(S.workouts.every(w => !w.hr)).toBe(true)
    expect(await fillWorkoutHeartRate(S, async () => [], { now, tried: ['0', ...ids] })).toEqual(['6', '7'])
  })
})

it('load writes through the store and remembers empty attempts separately for each profile', async () => {
  const saved = new Map()
  vi.stubGlobal('localStorage', { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) })
  try {
    const start = Date.now() - 3600000
    const S = { workouts: [{ id: 'empty', start, end: start + 2400000 }, { id: 'filled', start: start - 1, end: start + 2400000 }] }
    const update = vi.fn(fn => fn(S))
    mocks.store = { S, user: { id: 'u1' }, update }
    let reads = 0
    mocks.api.mockImplementation(async path => {
      if (path === '/api/google-health') return { connected: true, status: 'ok', lastSync: new Date().toISOString() }
      if (path === '/api/apple-health') return { connected: false }
      reads++
      return { samples: reads === 1 ? [] : [{ t: start + 1000, bpm: 120 }, { t: start + 2000, bpm: 130 }] }
    })
    useGoogleHealth.setState({ info: null, busy: false, error: null })
    await useGoogleHealth.getState().load()
    expect(update).toHaveBeenCalledTimes(1)
    expect(S.workouts[1].hr).toMatchObject({ src: 'gh', avg: 125, max: 130 })
    expect(reads).toBe(2)
    await useGoogleHealth.getState().load()
    expect(reads).toBe(2)
    mocks.store = { ...mocks.store, user: { id: 'u2' } }
    await useGoogleHealth.getState().load()
    expect(reads).toBe(3)
  } finally {
    vi.unstubAllGlobals()
    mocks.api.mockReset()
    useGoogleHealth.setState({ info: null, busy: false, error: null })
  }
})

it('loads Apple-only data even when Google fails, and preserves its weigh-in source', async () => {
  const weights = [{ id: 'apple:w', at: '2026-11-10T08:00:00Z', d: '2026-11-10', kg: 80 }]
  const onWeights = vi.fn()
  mocks.api.mockImplementation(async path => {
    if (path === '/api/google-health') throw new Error('Google unavailable')
    return { connected: true, data: { steps: { '2026-11-10': 1234 }, weight: weights } }
  })
  useGoogleHealth.setState({ busy: false, info: null })
  const info = await useGoogleHealth.getState().load({ sync: 'none' }, onWeights)
  expect(info.connected).toBe(false)
  expect(info.anyConnected).toBe(true)
  expect(info.data.steps).toEqual({ '2026-11-10': 1234 })
  expect(onWeights).toHaveBeenCalledWith([{ ...weights[0], src: 'apple' }])
  mocks.api.mockReset()
  useGoogleHealth.getState().clear()
})

it('does not restore data from an in-flight request after clearing the profile', async () => {
  let done
  mocks.api.mockImplementation(path => path === '/api/google-health' ? new Promise(resolve => { done = resolve }) : Promise.resolve({ connected: false }))
  useGoogleHealth.setState({ busy: false, info: null })
  const pending = useGoogleHealth.getState().load()
  useGoogleHealth.getState().clear()
  done({ connected: true, data: { steps: { '2026-11-10': 100 } } })
  await pending
  expect(useGoogleHealth.getState().info).toBeNull()
  expect(useGoogleHealth.getState().busy).toBe(false)
  mocks.api.mockReset()
})
