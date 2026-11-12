// @vitest-environment happy-dom
// The round Start button opens a choice (components/StartChoices.jsx) instead of starting today's
// plan straight away, so Freestyle and the other routines are always one tap away.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav, useLocation: () => ({ pathname: '/home', search: '' }) }))
vi.mock('../sheets.jsx', () => ({ startFlow: vi.fn(), logPastWorkoutSheet: vi.fn() }))

const { useStore } = await import('../store/useStore.js')
const { useUI } = await import('../store/useUI.js')
const { startFlow, logPastWorkoutSheet } = await import('../sheets.jsx')
const { StartChoices } = await import('./StartChoices.jsx')
const { default: TabBar } = await import('./TabBar.jsx')

const routines = [
  { id: 'r1', name: 'Push', emoji: null, ex: [{ id: 'a' }, { id: 'b' }] },
  { id: 'r2', name: 'Pull', emoji: null, ex: [{ id: 'c' }] },
]
const everyDay = { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }

let host, root, close
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear(); logPastWorkoutSheet.mockClear()
  close = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.render(null)); act(() => root.unmount()); host.remove(); useUI.getState().closeAll() })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, appMode: 'full', routines, dayPlan: {}, workouts: [], active: null, queue: null, scheduleMode: 'week', week: everyDay, ...over },
  user: { id: 'u', name: 'Emil' },
}))
const labels = () => [...host.querySelectorAll('[data-start-choice]')].map(b => b.getAttribute('data-start-choice'))
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('StartChoices', () => {
  it('a planned day lists the plan, Freestyle, the other routines and Log a past workout', () => {
    setS()
    act(() => root.render(<StartChoices close={close} />))
    expect(labels()).toEqual(['plan', 'freestyle', 'r2', 'past'])
    expect(host.textContent).toContain("Today's plan")
    expect(host.textContent).toContain('2 exercises')
  })

  it('a rest day puts Freestyle first', () => {
    setS({ week: {} })
    act(() => root.render(<StartChoices close={close} />))
    expect(labels()).toEqual(['freestyle', 'r1', 'r2', 'past'])
  })

  it('starts the plan, a routine or Freestyle, closing first', () => {
    setS()
    act(() => root.render(<StartChoices close={close} />))
    click(host.querySelector('[data-start-choice="freestyle"]'))
    expect(startFlow).toHaveBeenLastCalledWith([])
    click(host.querySelector('[data-start-choice="plan"]'))
    expect(startFlow).toHaveBeenLastCalledWith(['r1'])
    click(host.querySelector('[data-start-choice="r2"]'))
    expect(startFlow).toHaveBeenLastCalledWith(['r2'])
    click(host.querySelector('[data-start-choice="past"]'))
    expect(logPastWorkoutSheet).toHaveBeenCalled()
    expect(close).toHaveBeenCalledTimes(4)
  })
})

describe('TabBar Start', () => {
  const startBtn = () => host.querySelector('#tabbar .start')

  it('opens the choice and starts nothing', () => {
    setS()
    const onStart = vi.fn()
    act(() => root.render(<TabBar onStart={onStart} />))
    click(startBtn())
    expect(onStart).not.toHaveBeenCalled()
    expect(startFlow).not.toHaveBeenCalled()
    expect(useUI.getState().sheets.length).toBe(1)
  })

  it('with a session in progress goes back to it', () => {
    setS({ active: { id: 'a', name: 'Push', start: Date.now(), cur: 0, entries: [] } })
    act(() => root.render(<TabBar onStart={vi.fn()} />))
    click(startBtn())
    expect(nav).toHaveBeenCalledWith('/workout')
  })
})
