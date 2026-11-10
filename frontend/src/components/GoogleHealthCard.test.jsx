// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ state: {}, answers: {}, calls: [], toasts: [], navs: [] }))
vi.mock('../store/useStore.js', () => {
  const getState = () => ({ ...mocks.state, update: fn => fn(mocks.state.S) })
  const useStore = sel => sel(getState())
  useStore.getState = getState
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = sel => sel({ toast: x => mocks.toasts.push(x) })
  useUI.getState = () => ({ toast: x => mocks.toasts.push(x) })
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => p => mocks.navs.push(p) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: () => {} }))
vi.mock('../lib/api.js', () => ({
  api: async (path, opts) => { mocks.calls.push([path, opts?.method || 'GET']); const a = mocks.answers[path]; if (a instanceof Error) throw a; return structuredClone(a) },
}))
const { default: GoogleHealthCard } = await import('./GoogleHealthCard.jsx')
const { HomeMetrics } = await import('./HomeMetrics.jsx')
const { useGoogleHealth } = await import('../lib/google-health.js')

const today = new Date().toISOString().slice(0, 10)
const connected = (extra = {}) => ({ available: true, connected: true, status: 'ok', lastSync: new Date().toISOString(),
  data: { steps: { [today]: 6421 }, restingHr: { [today]: 57 }, weight: [{ id: 'w1', at: today + 'T06:00:00Z', d: today, kg: 75.2 }] }, ...extra })
let host, root
beforeEach(() => {
  localStorage.clear(); useGoogleHealth.setState({ info: null, busy: false, error: null })
  mocks.state = { S: { unit: 'kg', bodyweight: [] }, user: { id: 'u1' }, config: { health: { google: true } } }
  mocks.answers = {}; mocks.calls = []; mocks.toasts = []; mocks.navs = []
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async el => { await act(async () => { root.render(el) }); await act(async () => {}) }

it('tells an admin how to set it up when the server has no Google client', async () => {
  mocks.state.config = {}; mocks.state.user = { id: 'u1', admin: true }
  await render(<GoogleHealthCard />)
  expect(host.textContent).toContain('Not set up on this server yet: add the Google client to .env')
  expect(host.querySelector('.btn')).toBeNull()
})

it('offers Connect when it is not connected', async () => {
  mocks.answers['/api/google-health'] = { available: true, connected: false }
  await render(<GoogleHealthCard />)
  expect([...host.querySelectorAll('.btn')].map(b => b.textContent)).toEqual(['Connect'])
  expect(host.textContent).toContain('Steps, resting heart rate, sleep, weight and workouts from your Fitbit.')
})

it('shows today’s numbers when connected, and copies Fitbit weigh-ins into the weight chart', async () => {
  mocks.answers['/api/google-health'] = connected()
  await render(<GoogleHealthCard />)
  expect(host.textContent).toContain('6,421 steps today')
  expect(host.textContent).toContain('resting HR 57')
  expect([...host.querySelectorAll('.btn')].map(b => b.textContent)).toEqual(['Sync now', 'Disconnect'])
  expect(mocks.state.S.bodyweight[0]).toMatchObject({ d: today, w: 75.2 })
  expect(mocks.calls.map(c => c[0])).toEqual(['/api/google-health'])
})

it('asks to reconnect when Google expired the connection, keeping the data', async () => {
  mocks.answers['/api/google-health'] = connected({ status: 'reconnect' })
  await render(<GoogleHealthCard />)
  expect(host.textContent).toContain('Google asks you to reconnect. Your data so far is kept.')
  expect([...host.querySelectorAll('.btn')].map(b => b.textContent)).toEqual(['Reconnect', 'Disconnect'])
})

it('syncs on open when the last sync is old', async () => {
  mocks.answers['/api/google-health'] = connected({ lastSync: '2026-01-01T00:00:00Z' })
  mocks.answers['/api/google-health/sync'] = connected()
  await render(<GoogleHealthCard />)
  expect(mocks.calls).toEqual([['/api/google-health', 'GET'], ['/api/google-health/sync', 'POST']])
})

it('fills Home’s Steps and Resting HR cards, and a tap opens Integrations', async () => {
  mocks.answers['/api/google-health'] = connected()
  await render(<HomeMetrics />)
  const cards = host.querySelectorAll('.metric-card')
  expect(cards[0].querySelector('.metric-value').textContent).toBe('6,421')
  expect(cards[1].querySelector('.metric-value').textContent).toContain('57')
  expect(cards[1].textContent).toContain('Today, from Fitbit')
  await act(async () => host.querySelector('.metric-tap').click())
  expect(mocks.navs).toEqual(['/settings/integrations'])
})

it('keeps Home’s cards honest when nothing is connected', async () => {
  mocks.answers['/api/google-health'] = { available: true, connected: false }
  await render(<HomeMetrics />)
  expect(host.textContent).toContain('Not connected')
  expect(host.textContent).toContain('Connect Google Health to see it here.')
})
