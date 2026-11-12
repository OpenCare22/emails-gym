// @vitest-environment happy-dom
// The setting is only worth anything if the screens actually follow it: the toggle has to
// write the field, and the Plan list has to draw the week in that order.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import Plan from './Plan.jsx'
import { WeekdayPicker } from '../components/WeekdayPicker.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => (selector ? selector(snap()) : snap())
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
  dayAssignSheet: vi.fn(), dayAddRoutineSheet: vi.fn(), planToolsSheet: vi.fn(),
}))

globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {}, week: {}, dayPlan: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const segButton = label => [...host.querySelectorAll('.seg button')].find(b => b.textContent === label)
const dayRows = () => [...host.querySelectorAll('.item .tt')].map(e => e.textContent)

describe('Settings — week starts on', () => {
  const mount = () => act(() => root.render(<Settings page="plan" />))

  it('offers Monday and Sunday and writes the getDay() index', () => {
    mount()
    expect(segButton('Monday').getAttribute('aria-pressed')).toBe('true')
    act(() => { segButton('Sunday').click() })
    expect(mocks.S.weekStart).toBe(0)
    mount()
    expect(segButton('Sunday').getAttribute('aria-pressed')).toBe('true')
    act(() => { segButton('Monday').click() })
    expect(mocks.S.weekStart).toBe(1)
  })

  it('shows a profile written before the setting existed as Monday', () => {
    delete mocks.S.weekStart
    mount()
    expect(segButton('Monday').getAttribute('aria-pressed')).toBe('true')
    expect(segButton('Sunday').getAttribute('aria-pressed')).toBe('false')
  })
})

// Workouts has no weekday grid any more: each routine carries its days (Plan.jsx), picked in a
// sheet that runs through the week the way the setting says (components/WeekdayPicker.jsx).
describe('Workouts — the weekdays follow the setting', () => {
  const picker = id => act(() => root.render(<WeekdayPicker routineId={id} close={() => {}} />))
  const pickerDays = () => [...host.querySelectorAll('[data-weekday] .tt')].map(e => e.textContent)

  it('runs Monday to Sunday by default', () => {
    mocks.S.routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [] }]
    picker('r1')
    expect(pickerDays()).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  })

  it('runs Sunday to Saturday for a Sunday profile', () => {
    mocks.S.routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [] }]
    mocks.S.weekStart = 0
    picker('r1')
    expect(pickerDays()).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
  })

  it('keeps a routine attached to its day, an old single-id week included', () => {
    mocks.S.routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [] }]
    mocks.S.week = { 0: 'r1' }        // Sunday, written before a day could hold several
    mocks.S.weekStart = 0
    act(() => root.render(<Plan />))
    expect([...host.querySelectorAll('.plan-routine .plan-days .chip')].map(c => c.textContent)).toEqual(['Su'])
  })
})

describe('Workouts — a combined day (combine routines)', () => {
  beforeEach(() => {
    mocks.S.routines = [
      { id: 'r1', name: 'Push', emoji: null, ex: [{ id: 'a' }, { id: 'b' }] },
      { id: 'r2', name: 'Core', emoji: null, ex: [{ id: 'c' }] },
    ]
  })

  it('shows the day on both routines, and the picker says who shares it', () => {
    mocks.S.week = { 1: ['r1', 'r2'] }
    act(() => root.render(<Plan />))
    const chips = [...host.querySelectorAll('.plan-routine')].map(r => [...r.querySelectorAll('.plan-days .chip')].map(c => c.textContent))
    expect(chips).toEqual([['Mo'], ['Mo']])
    act(() => root.render(<WeekdayPicker routineId="r1" close={() => {}} />))
    expect(host.querySelector('[data-weekday="1"]').textContent).toContain('With Core')
  })
})
