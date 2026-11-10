// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

vi.mock('./lib/sound.js', () => ({
  setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn(),
  beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(),
}))
vi.mock('./lib/api.js', async importOriginal => ({
  ...await importOriginal(), webauthnOK: () => true, api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(),
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, original
beforeEach(() => {
  original = useStore.getState()
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  window.location.hash = '#/settings'
  window.scrollTo = vi.fn()
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), user: null, ready: true, boot: vi.fn(), config: { invite_only: true, allow_guest: false } })
  useUI.setState({ sheets: [], work: null, timer: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState(original)
  vi.restoreAllMocks()
  localStorage.clear()
})
it('keeps sign-up available, then replaces even a deep link and all app chrome after sign-in', async () => {
  await act(async () => root.render(<App />))
  expect(host.textContent).toContain('Create new profile')
  expect(host.querySelector('.install-required')).toBeNull()
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('Create new profile')).click())
  expect(document.querySelector('input[placeholder="Invite code"]')).not.toBeNull()
  await act(async () => useStore.setState({ user: { id: 'u1', name: 'Emil' } }))
  expect(host.querySelector('h1').textContent).toBe('Add Email’s Gym to your Home Screen')
  expect(host.querySelectorAll('main ol li')).toHaveLength(3)
  expect(host.querySelector('main svg')).not.toBeNull()
  expect(host.textContent).toContain('An App Store version is in development.')
  expect(host.textContent).toContain('notifications and full screen')
  expect(host.querySelector('#tabbar')).toBeNull()
  expect(host.querySelectorAll('button, input')).toHaveLength(0)
})
