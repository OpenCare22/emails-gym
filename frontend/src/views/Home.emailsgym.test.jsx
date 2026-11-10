// @vitest-environment happy-dom
// Email's Gym Home (handoff §4A): the brand, a greeting with the real first name and this week's
// training days, the Today card's round Start, honest "Not connected" metric cards until a
// wearable is connected, and the weekly chart from real workouts only.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import Home from './Home.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

const routines = [{ id: 'r1', name: 'Push Upper', emoji: null, ex: [{ id: '0025' }] }]
let host, root, original
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  original = { S: useStore.getState().S, user: useStore.getState().user }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); useStore.setState(original) })

const setS = (over = {}, user = { id: 'u1', name: 'Emil Mladenov' }) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false,
    week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: [], 6: [] }, ...over },
  user,
}))
const mount = () => act(() => root.render(<Home />))

describe('Email’s Gym Home', () => {
  it('shows the brand, greets by first name and counts this week’s training days', () => {
    setS()
    mount()
    expect(host.querySelector('.home-brand').textContent).toBe('Email’s Gym')
    expect(host.querySelector('.home-hello h1').textContent).toBe('Hi, Emil.')
    expect(host.querySelector('.home-hello .sub').textContent).toMatch(/^0 of 5 training days this week\.$/)
  })

  it('greets a guest without a name', () => {
    setS({}, null)
    mount()
    expect(host.querySelector('.home-hello h1').textContent).toBe('Hi there.')
  })

  it('puts today in its own card with a round Start button', () => {
    setS({ week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] } })
    mount()
    const card = host.querySelector('.today-card')
    expect(card.querySelector('[data-tour="today"]')).not.toBeNull()
    expect(card.querySelector('.today-play').getAttribute('aria-label')).toBe('Start')
  })

  it('says Steps and Resting HR are not connected rather than showing a number', () => {
    setS()
    mount()
    const cards = [...host.querySelectorAll('.metric-card')]
    expect(cards.map(c => c.querySelector('.metric-head').textContent)).toEqual(['Steps', 'Resting HR'])
    for (const c of cards) {
      expect(c.querySelector('.metric-off').textContent).toBe('Not connected')
      expect(c.querySelector('.metric-value')).toBeNull()
    }
  })

  it('draws the weekly chart only from logged workouts, with a text equivalent', () => {
    setS()
    mount()
    expect(host.querySelector('.week-chart')).toBeNull()   // no workouts, no chart
    act(() => root.unmount()); root = createRoot(host)
    setS({ workouts: [{ id: 'w1', d: todayISO(), entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }] }] }] })
    mount()
    const chart = host.querySelector('.week-chart')
    expect(chart.querySelector('h2').textContent).toBe('Weekly training')
    expect(chart.textContent).toContain('2 sets this week')
    expect(chart.querySelector('[role="img"]').getAttribute('aria-label')).toMatch(/^Completed sets this week: /)
    expect(chart.querySelector('.week-bar.today .week-bar-n').textContent).toBe('2')
  })
})
