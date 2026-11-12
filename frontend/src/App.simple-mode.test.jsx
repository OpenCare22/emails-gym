// @vitest-environment happy-dom
// Simple mode (docs/superpowers/specs/2026-11-12-simple-mode-design.md): a fresh profile is asked
// once, simple mode shows Today and three tabs at most, and a profile with history is never asked.
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
  ...await importOriginal(), api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(),
}))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, original

const mount = async S => {
  useStore.setState({ S, user: null, ready: true, boot: vi.fn() })
  await act(async () => root.render(<App />))
}

beforeEach(() => {
  original = useStore.getState()
  localStorage.setItem('gym_guest', '1')
  window.location.hash = '#/home'
  window.scrollTo = vi.fn()
  useUI.setState({ sheets: [], work: null, timer: null })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState(original)
  localStorage.clear()
})

it('asks a fresh profile, and Just log my workouts opens Today with the simple tabs', async () => {
  await mount(structuredClone(DEF))
  expect(host.querySelector('.mode-choice')).not.toBeNull()
  expect(host.querySelector('#tabbar')).toBeNull()
  await act(async () => host.querySelector('[data-mode="simple"]').click())
  expect(useStore.getState().S.appMode).toBe('simple')
  expect(host.querySelector('.daylog')).not.toBeNull()
  const tabs = [...host.querySelectorAll('#tabbar button')].map(b => b.textContent)
  // A guest has no server, so no Friends tab.
  expect(tabs).toEqual(['Today', 'Progress'])
  expect(host.querySelector('#tabbar .start')).toBeNull()
})

it('The full app keeps Home and the Start button', async () => {
  await mount(structuredClone(DEF))
  await act(async () => host.querySelector('[data-mode="full"]').click())
  expect(useStore.getState().S.appMode).toBe('full')
  expect(host.querySelector('.daylog')).toBeNull()
  expect(host.querySelector('#tabbar .start')).not.toBeNull()
})

it('never asks a profile that already has workouts', async () => {
  const S = structuredClone(DEF)
  S.workouts = [{ id: 'w', d: '2026-11-01', start: Date.parse('2026-11-01T18:00:00'), entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }], routineIds: [] }]
  await mount(S)
  expect(host.querySelector('.mode-choice')).toBeNull()
  expect(host.querySelector('#tabbar .start')).not.toBeNull()
})
