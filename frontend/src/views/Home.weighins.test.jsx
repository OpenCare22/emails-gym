// @vitest-environment happy-dom
// Steps and resting heart rate left Home for Progress, but Home still pulls new Google Health
// weigh-ins in when it opens: it was the only automatic weigh-in import on the web.
import React, { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const load = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/mobile.js', async orig => ({ ...(await orig()), MOBILE: false }))
vi.mock('../lib/google-health.js', async orig => ({ ...(await orig()), useGoogleHealth: () => ({ info: null, load }) }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))
const { useStore } = await import('../store/useStore.js')
const { default: Home } = await import('./Home.jsx')

let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; load.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

it('imports weigh-ins when Home opens for a signed-in user', () => {
  useStore.setState(s => ({ S: { ...s.S, routines: [], workouts: [], active: null }, user: { id: 'u', name: 'Emil' } }))
  act(() => root.render(<Home />))
  expect(load).toHaveBeenCalledWith({ sync: 'auto' }, expect.any(Function))
})
