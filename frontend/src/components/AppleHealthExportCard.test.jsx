// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ info: {}, user: { id: 'alice' }, api: vi.fn(), copy: vi.fn(), load: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: Object.assign(s => s({ user: mocks.user }), { getState: () => ({ update: vi.fn() }) }) }))
vi.mock('../lib/api.js', () => ({ api: (...args) => mocks.api(...args) }))
vi.mock('../lib/clipboard.js', () => ({ copyText: (...args) => mocks.copy(...args) }))
vi.mock('../lib/google-health.js', () => ({ useGoogleHealth: { getState: () => ({ load: mocks.load }) }, applyWeighIns: vi.fn() }))
vi.mock('../lib/demo.js', () => ({ DEMO: false }))
// The confirm sheet answers yes at once here; the sheet itself is tested in sheets.
vi.mock('../sheets.jsx', () => ({ confirmSheet: o => o.onConfirm() }))
import AppleHealthExportCard from './AppleHealthExportCard.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
beforeEach(() => {
  mocks.info = { connected: false }; mocks.user = { id: 'alice' }
  mocks.api.mockReset(); mocks.copy.mockReset().mockResolvedValue(true); mocks.load.mockReset().mockResolvedValue({})
  mocks.api.mockImplementation(async path => {
    if (path.endsWith('/token')) { mocks.info = { connected: true, createdAt: new Date().toISOString() }; return { token: 'secret-key' } }
    if (path.endsWith('/disconnect')) { mocks.info = { connected: false }; return { ok: true } }
    return mocks.info
  })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = () => act(async () => { root.render(<AppleHealthExportCard />) })
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent === label)
const click = label => act(async () => { button(label).click() })

it('shows setup without a key, creates it once, and copies the URL and complete header', async () => {
  await mount()
  expect(button('Create key')).toBeDefined()
  expect(host.textContent).toContain('Premium')
  expect(host.textContent).toContain('Since Last Sync')
  expect(host.textContent).toContain('Last received: never')
  await click('Copy URL')
  expect(mocks.copy.mock.calls[0][0]).toMatch(/\/api\/apple-health\/ingest$/)
  await click('Create key')
  expect(host.textContent).toContain('Bearer secret-key')
  await click('Copy header')
  expect(mocks.copy).toHaveBeenLastCalledWith('Bearer secret-key')
  await act(async () => { root.unmount() }); root = createRoot(host); await mount()
  expect(host.textContent).not.toContain('secret-key')
  expect(button('New key')).toBeDefined()
})
it('shows receiving and unknown metrics, and disconnects', async () => {
  mocks.info = { connected: true, lastReceived: new Date().toISOString(), unknownMetrics: ['new_metric'] }
  await mount()
  expect(host.textContent).toContain('Unrecognised metrics: new_metric')
  expect(host.textContent).not.toContain('iPhone only sends')
  await click('Disconnect')
  expect(button('Create key')).toBeDefined()
  expect(mocks.load).toHaveBeenCalled()
})
it('warns after two days without an export, including a key that never received data', async () => {
  mocks.info = { connected: true, createdAt: new Date(Date.now() - 3 * 864e5).toISOString() }
  await mount()
  expect(host.textContent).toContain('Nothing has arrived for 2 days. iPhone only sends while it is unlocked')
})
it('shows errors and does not offer key creation before settings load', async () => {
  mocks.api.mockRejectedValue(new Error('offline'))
  await mount()
  expect(host.querySelector('[role="alert"]').textContent).toContain('Could not load')
  expect(button('Create key').disabled).toBe(true)
})
