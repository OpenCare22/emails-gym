// @vitest-environment happy-dom
// Plan's header and menu: the Coach has its own button in the header when it is available, and
// share, print, import, starter plans and programmes sit behind the ⋯ menu.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Plan from './Plan.jsx'
import { dayAssignSheet, menuSheet } from '../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, coach: false, nav: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('../lib/coach.js', () => ({ coachAvailable: () => mocks.coach }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), dayAssignSheet: vi.fn(), menuSheet: vi.fn(), confirmSheet: vi.fn(),
  planHasRoutines: s => (s.routines || []).some(r => r.ex.length), exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))

let host, root
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem('gym_plan_view')
  mocks.coach = false
  mocks.nav = vi.fn()
  mocks.S = {
    unit: 'kg', workouts: [], exWeights: {}, week: { 1: ['r1'] }, dayPlan: {},
    routines: [{ id: 'r1', name: 'Push', emoji: null, ex: [] }, { id: 'r2', name: 'Pull', emoji: null, ex: [] }],
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Plan />))
const day = name => host.querySelector(`.plan-day[aria-label="${name}"]`)

// The weekday rows are gone (each routine carries its days now, Plan.layout.test.jsx).
describe('Plan — the menu', () => {
  const openMenu = () => {
    act(() => host.querySelector('button[aria-label="Plan options"]').click())
    return menuSheet.mock.calls.at(-1)[0]
  }

  const coachButton = () => [...host.querySelectorAll('.hdr button')].find(b => b.textContent === 'Coach')

  it('has its own Coach button in the header when the Coach is available, not a menu entry', () => {
    mocks.coach = true
    mount()
    expect(host.textContent).not.toContain('Plan design and reviews')
    expect(openMenu().items.filter(Boolean).map(i => i.label)).not.toContain('Coach')
    act(() => coachButton().click())
    expect(mocks.nav).toHaveBeenCalledWith('/coach')
  })

  it('leaves the Coach out where it is not available', () => {
    mount()
    expect(coachButton()).toBeUndefined()
    expect(openMenu().items.filter(Boolean).map(i => i.label)).not.toContain('Coach')
  })

  it('greys out share and print while there is nothing to share, and says why', () => {
    mount()
    const menu = openMenu()
    const item = label => menu.items.find(i => i && i.label === label)
    expect(item('Export plan file').disabled).toBe(true)
    expect(item('Print / Save as PDF').disabled).toBe(true)
    expect(item('Import a plan file').disabled).toBeFalsy()
    expect(menu.subtitle).toContain('Add an exercise to a routine first')
  })
})
