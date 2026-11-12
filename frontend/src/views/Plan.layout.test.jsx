// @vitest-environment happy-dom
// Workouts as one page (docs/superpowers/specs/2026-11-12-full-mode-wayfinding-design.md, layout
// B): your routines with their weekdays on them, one "Train in order" switch, and the ways to a
// new plan. No inner Schedule / Routines or Fixed Week / Rotation switches any more.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, nav: null }
  state.snapshot = () => ({
    S: state.S,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
    config: {}, user: null, coachLocal: { mode: 'off' },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.nav }))
vi.mock('../sheets.jsx', () => ({
  dayAssignSheet: vi.fn(), starterPlanSheet: vi.fn(), menuSheet: vi.fn(), confirmSheet: vi.fn(),
  planHasRoutines: () => true, exportPlanFile: vi.fn(), printWholePlan: vi.fn(), importPlanFile: vi.fn(),
}))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
vi.mock('../lib/coach.js', () => ({ coachAvailable: () => false }))

import Plan from './Plan.jsx'
import { WeekdayPicker } from '../components/WeekdayPicker.jsx'
import { confirmSheet } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'

const routines = [
  { id: 'a', name: 'Push', emoji: null, ex: [{ id: '0025' }] },
  { id: 'b', name: 'Pull', emoji: null, ex: [{ id: '0025' }] },
]
const baseS = over => ({ routines, week: {}, dayPlan: {}, workouts: [], queue: null, rotation: null, scheduleMode: null, weekStart: 1, ...over })

let host, root
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  confirmSheet.mockClear(); mocks.nav = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = over => { mocks.S = baseS(over); act(() => root.render(<Plan key={Math.random()} />)) }
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const row = name => [...host.querySelectorAll('.plan-routine')].find(r => r.querySelector('.tt')?.textContent === name)
const chips = name => [...row(name).querySelectorAll('.plan-days .chip')].map(c => c.textContent)
const orderSwitch = () => host.querySelector('.plan-order-mode [role="switch"]')
const headings = () => [...host.querySelectorAll('h4.sec')].map(h => h.firstChild.textContent)

describe('Workouts page', () => {
  it('has no inner switches', () => {
    mount()
    expect(host.querySelector('.workouts-switch')).toBeNull()
    expect(host.querySelector('.plan-views')).toBeNull()
    expect(host.textContent).not.toContain('Fixed Week')
    expect(host.textContent).not.toContain('Schedule')
  })

  it('routine rows show their weekdays in week order', () => {
    mount({ week: { 1: ['a'], 4: ['a'], 0: ['a'] } })
    expect(chips('Push')).toEqual(['Mo', 'Th', 'Su'])
    mount({ week: { 1: ['a'], 0: ['a'] }, weekStart: 0 })
    expect(chips('Push')).toEqual(['Su', 'Mo'])
  })

  it('a routine on no day says so, and a deleted id in the week is ignored', () => {
    mount({ week: { 2: ['gone'] } })
    expect(row('Push').textContent).toContain('No day, start it any time')
    expect(row('Pull').textContent).toContain('No day, start it any time')
  })

  it('tapping the row opens the routine, tapping the days does not', () => {
    mount({ week: { 1: ['a'] } })
    click(row('Push').querySelector('.plan-days'))
    expect(mocks.nav).not.toHaveBeenCalled()
    click(row('Push'))
    expect(mocks.nav).toHaveBeenCalledWith('/plan/r/a')
  })

  it('the order switch turns rotation on, and leaving a running loop asks first', () => {
    mount()
    expect(orderSwitch().getAttribute('aria-checked')).toBe('false')
    click(orderSwitch())
    expect(mocks.S.scheduleMode).toBe('rotation')
    mount({ queue: { ids: ['a', 'b'], since: Date.now() - 86400000, startsOn: todayISO(), label: '', rotationId: 'r1' }, rotation: { id: 'r1', sequence: ['a', 'b'] } })
    expect(orderSwitch().getAttribute('aria-checked')).toBe('true')
    click(orderSwitch())
    expect(confirmSheet).toHaveBeenCalledTimes(1)
  })

  it('order mode lists the loop and the routines that are not in it', () => {
    mount({ scheduleMode: 'rotation', rotation: { id: 'r1', sequence: ['a'] }, week: { 3: ['b'] } })
    expect(headings()).toContain('The loop')
    expect(headings()).toContain('Not in the order')
    expect([...host.querySelectorAll('.rotation-row .tt')].map(e => e.textContent)).toEqual(['Push'])
    expect(row('Pull')).toBeTruthy()
    expect(chips('Pull')).toEqual(['We'])
    expect(row('Push')).toBeUndefined()
  })

  it('an external queue locks the switch and still offers Use this rotation', () => {
    mount({ queue: { ids: ['a', 'b'], since: Date.now(), startsOn: todayISO(), label: 'US W1' } })
    expect(orderSwitch()).toBeNull()
    expect(host.querySelector('.plan-order-mode').textContent).toContain('Externally managed')
    expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Use this rotation')).toBe(true)
  })

  it('Get a new plan is first with no routines and last with routines', () => {
    mount({ routines: [] })
    const sections = () => [...host.querySelectorAll('.plan-start, .plan-routines-sec')].map(e => e.className.includes('plan-start') ? 'start' : 'routines')
    expect(sections()[0]).toBe('start')
    mount()
    expect(sections()).toEqual(['routines', 'start'])
    expect(host.querySelector('#plan-start-h').textContent).toBe('Get a new plan')
  })

  it('the search icon opens the exercise library', () => {
    mount()
    click(host.querySelector('.hdr [data-tour="tab-library"]'))
    expect(mocks.nav).toHaveBeenCalledWith('/library')
  })

  it('no longer links to the weekly muscle volume', () => {
    mount()
    expect(host.textContent).not.toContain('Weekly muscle volume')
  })
})

describe('WeekdayPicker', () => {
  it('writes the routine onto a weekday and keeps another routine there', () => {
    mocks.S = baseS({ week: { 1: ['b'] } })
    act(() => root.render(<WeekdayPicker routineId="a" close={() => {}} />))
    const day = d => host.querySelector(`[data-weekday="${d}"]`)
    expect([...host.querySelectorAll('[data-weekday]')].map(e => e.getAttribute('data-weekday'))).toEqual(['1', '2', '3', '4', '5', '6', '0'])
    click(day(1))
    expect(mocks.S.week[1]).toEqual(['b', 'a'])
    act(() => root.render(<WeekdayPicker key="2" routineId="a" close={() => {}} />))
    click(day(1))
    expect(mocks.S.week[1]).toEqual(['b'])
    act(() => root.render(<WeekdayPicker key="3" routineId="b" close={() => {}} />))
    click(day(1))
    expect(mocks.S.week[1]).toBeUndefined()
  })
})

describe('order mode keeps every routine reachable', () => {
  it('a routine in the loop opens from its row', () => {
    mount({ scheduleMode: 'rotation', rotation: { id: 'r1', sequence: ['a'] } })
    click(host.querySelector('.rotation-row'))
    expect(mocks.nav).toHaveBeenCalledWith('/plan/r/a')
  })
})
