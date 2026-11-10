// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useGoogleHealth } from '../lib/google-health.js'
import { todayISO } from '../lib/format.js'
import Home from './Home.jsx'

vi.mock('../store/useStore.js', async importOriginal => {
  const { DEF } = await importOriginal()
  const { create } = await import('zustand')
  const useStore = create((set, get) => ({ S: structuredClone(DEF), user: null, isGuest: () => true,
    update: mut => { const S = structuredClone(get().S); mut(S); set({ S }) },
  }))
  return { useStore }
})
const mocks = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../store/useUI.js', async importOriginal => {
  const actual = await importOriginal()
  actual.useUI.setState({ toast: mocks.toast })
  return actual
})
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../sheets.jsx', () => ({ starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(),
  dayOverrideSheet: vi.fn(), calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn() }))
let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.toast.mockClear()
  useStore.setState(s => ({ S: { ...s.S, workouts: [], ghDismissed: [], bodyweight: [] } }))
  const d = todayISO()
  useGoogleHealth.setState({ info: { connected: true, data: { exercise: [{ id: 'run', type: 'RUNNING', name: 'Run', d,
    start: d + 'T10:00:00Z', end: d + 'T10:31:00Z', minutes: 31, distanceKm: 5.2, avgHr: 151 }] } } })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<Home />))
})
afterEach(() => { act(() => root.unmount()); host.remove(); useGoogleHealth.setState({ info: null }) })
const click = name => act(() => [...host.querySelectorAll('.fitbit-import button')].find(b => b.textContent === name).click())
it('offers above metrics and imports once only after consent', () => {
  const card = host.querySelector('.fitbit-import')
  expect(card.textContent).toContain('From your Fitbit: Run, 31 min, 5.2 km, avg 151 bpm')
  expect(card.compareDocumentPosition(host.querySelector('.metric-card')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(useStore.getState().S.workouts).toEqual([])
  const button = [...card.querySelectorAll('button')].find(b => b.textContent === 'Import')
  act(() => { button.click(); button.click() })
  expect(useStore.getState().S.workouts).toHaveLength(1)
  expect(useStore.getState().S.workouts[0].src).toEqual({ gh: 'run' })
  expect(mocks.toast).toHaveBeenCalledExactlyOnceWith('Added to your history')
  expect(host.querySelector('.fitbit-import')).toBeNull()
})
it('dismisses without logging and stays dismissed on remount', () => {
  click('Dismiss')
  expect(useStore.getState().S.ghDismissed).toEqual(['run'])
  expect(useStore.getState().S.workouts).toEqual([])
  expect(mocks.toast).not.toHaveBeenCalled()
  act(() => { root.unmount(); root = createRoot(host); root.render(<Home />) })
  expect(host.querySelector('.fitbit-import')).toBeNull()
})
