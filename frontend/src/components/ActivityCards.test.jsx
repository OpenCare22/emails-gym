// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import ActivityCards from './ActivityCards.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mock = vi.hoisted(() => ({ info: null, load: vi.fn(), user: { id: 'u' }, offered: true }))
vi.mock('../lib/google-health.js', () => ({ useGoogleHealth: () => mock }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ user: mock.user, config: { health: { google: mock.offered } } }) }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
let root, el
beforeEach(() => {
  mock.info = null
  mock.offered = true
  mock.load.mockClear()
  el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
})
afterEach(() => { act(() => root.unmount()); el.remove() })
const render = () => act(() => root.render(<ActivityCards today="2026-11-10" />))

it('loads on direct entry and hides disconnected, empty and unrelated data', () => {
  for (const info of [null, { connected: false, data: { steps: { '2026-11-10': 50 } } }, { connected: true, data: {} }, { connected: true, data: { weight: [{ kg: 80 }] } }]) {
    mock.info = info
    render()
    expect(el.textContent).toBe('')
  }
  expect(mock.load).toHaveBeenCalledWith({ sync: 'auto' })
})
it('shows accessible values, units, the labelled target and HR direction', () => {
  mock.info = { connected: true, data: {
    steps: { '2026-11-10': 0, '2026-11-09': 100 },
    activeMinutes: { '2026-11-10': 30 },
    sleep: { '2026-11-10': 450 },
    restingHr: { '2026-11-04': 60, '2026-11-10': 57 },
  } }
  render()
  expect(el.textContent).toContain('Average: 50 steps')
  expect(el.textContent).toContain('Average: 7.5 hours')
  expect(el.textContent).toContain('Latest: 57 bpm')
  expect(el.textContent).toContain('Down 3 bpm')
  expect(el.textContent).toContain('Lower is better')
  expect(el.textContent).toContain('150 active minutes a week')
  expect(el.querySelectorAll('[role="img"]')).toHaveLength(4)
  expect(el.querySelector('[role="img"]').getAttribute('aria-label')).toContain('No data')
  expect(el.querySelector('[role="img"]').getAttribute('aria-label')).toContain('0 steps')
})
it('changes ranges, uses weekly averages, and retains empty-range feedback', () => {
  mock.info = { connected: true, data: { steps: { '2026-10-20': 8000, '2026-01-01': 2000 } } }
  render()
  expect(el.textContent).toContain('No data in this range')
  const pick = label => act(() => [...el.querySelectorAll('button')].find(b => b.textContent === label).click())
  pick('Month')
  expect(el.textContent).toContain('Average: 8,000 steps')
  expect(el.textContent).toContain('Daily averages by week')
  pick('Year')
  expect(el.textContent).toContain('Average: 5,000 steps')
  expect(el.querySelectorAll('rect').length).toBeGreaterThan(50)
})

it('loads and displays merged Apple-only activity without a Google client', () => {
  mock.offered = false
  mock.info = { connected: false, anyConnected: true, data: {
    steps: { '2026-11-10': 8500 }, restingHr: { '2026-11-10': 55 },
    activeMinutes: { '2026-11-10': 40 }, sleep: { '2026-11-10': 480 },
  } }
  render()
  expect(mock.load).toHaveBeenCalledWith({ sync: 'auto' })
  expect(el.textContent).toContain('Average: 8,500 steps')
  expect(el.textContent).toContain('Latest: 55 bpm')
  expect(el.textContent).toContain('Average: 40 min')
  expect(el.textContent).toContain('Average: 8 hours')
  expect(el.textContent).not.toContain('Fitbit')
})
