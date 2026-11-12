// @vitest-environment happy-dom
// Home after the wayfinding pass (docs/superpowers/specs/2026-11-12-full-mode-wayfinding-design.md):
// a "Your progress" card where steps and resting heart rate were, no "Choose a different workout"
// link (the Start sheet replaces it), and a Welcome card that lets you just start lifting.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startFlow } from '../sheets.jsx'
import { todayISO } from '../lib/format.js'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

const ago = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const set = w => ({ w, r: 5, done: true })
const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false, week: {}, ...over },
  user: null,
}))
const mount = () => act(() => root.render(<Home />))
const text = () => host.textContent
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.includes(label))
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('Home progress card', () => {
  it('shows workouts, records and the most-trained lifts with their change', () => {
    setS({ workouts: [
      { id: 'a', d: ago(35), entries: [{ id: '0025', sets: [set(80)] }], prs: [] },
      { id: 'b', d: ago(2), entries: [{ id: '0025', sets: [set(85)] }], prs: ['0025'] },
    ] })
    mount()
    const card = host.querySelector('[data-home-progress]')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Your progress')
    expect(card.textContent).toContain('Last 4 weeks')
    expect(card.textContent).toContain('85')
    expect(card.textContent).toContain('▲ 5')
    expect(card.textContent).toMatch(/1\s*new record/)
  })

  it('opens Progress', () => {
    setS({ workouts: [{ id: 'b', d: ago(2), entries: [{ id: '0025', sets: [set(85)] }], prs: [] }] })
    mount()
    click(host.querySelector('[data-home-progress] button'))
    expect(nav).toHaveBeenCalledWith('/stats')
  })

  it('with no workout in 28 days says how to get it going', () => {
    setS({ workouts: [{ id: 'a', d: ago(40), entries: [{ id: '0025', sets: [set(80)] }], prs: [] }] })
    mount()
    const card = host.querySelector('[data-home-progress]')
    expect(card.textContent).toContain('Train this week and your progress shows up here.')
    expect(card.querySelectorAll('[data-lift]').length).toBe(0)
  })

  it('is not there before the first workout', () => {
    setS(); mount()
    expect(host.querySelector('[data-home-progress]')).toBeNull()
  })

  it('Home no longer shows steps or resting heart rate', () => {
    setS(); mount()
    expect(text()).not.toContain('Steps')
    expect(text()).not.toContain('Resting HR')
  })

  it('has no "Choose a different workout" link', () => {
    setS({ week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] } }); mount()
    expect(button('Choose a different workout')).toBeFalsy()
  })
})

describe('Home welcome card', () => {
  it('leads with starting a workout', () => {
    setS({ routines: [] }); mount()
    expect(text()).toContain('You can just start lifting. A plan can come later.')
    click(button('Start a workout'))
    expect(startFlow).toHaveBeenCalledWith([])
    click(button('Get a plan'))
    expect(nav).toHaveBeenCalledWith('/plan')
  })

  it('goes once there is a routine', () => {
    setS(); mount()
    expect(button('Start a workout')).toBeFalsy()
  })
})
