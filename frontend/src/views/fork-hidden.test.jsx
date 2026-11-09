// @vitest-environment happy-dom
// The hidden features (lib/fork-hidden.js) have no way in: no row in Stats, and their routes send
// you Home. With nothing hidden, the upstream tests in Stats.*.test.jsx and StructuralBalance.test.jsx
// show the same entry points coming back.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import Stats from './Stats.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({
  setPlayOnSilent: vi.fn(), setVibrate: vi.fn(), setAlarmBuzzer: vi.fn(),
  beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(),
}))
vi.mock('../lib/api.js', async importOriginal => ({
  ...await importOriginal(), api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, original

const withWorkout = () => {
  const S = structuredClone(DEF)
  S.sound = false
  S.workouts = [{ id: 'w-1', d: new Date().toISOString(), start: Date.now(), entries: [{ id: '0030', sets: [{ done: true, w: 100, r: 5 }] }] }]
  S.dayPhotos = [{ d: new Date().toISOString().slice(0, 10), id: 'p1' }]
  return S
}

beforeEach(() => {
  original = useStore.getState()
  localStorage.setItem('gym_guest', '1')
  window.scrollTo = vi.fn()
  useStore.setState({ S: withWorkout(), user: null, ready: true, boot: vi.fn() })
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
  window.location.hash = ''
})

describe('hidden features have no way in', () => {
  it('Stats lists neither Progress photos nor Structural balance, even with a workout and a photo', async () => {
    vi.doMock('react-router-dom', async importOriginal => ({ ...await importOriginal(), useNavigate: () => vi.fn() }))
    const { MemoryRouter } = await import('react-router-dom')
    await act(async () => root.render(<MemoryRouter><Stats /></MemoryRouter>))
    const rows = [...host.querySelectorAll('.lrow-t')].map(e => e.textContent)
    expect(rows).toContain('Body measurements')
    expect(rows).not.toContain('Progress photos')
    expect(rows).not.toContain('Structural balance')
  })

  for (const path of ['/structural-balance', '/progress-photos']) {
    it(`${path} sends you Home`, async () => {
      window.location.hash = '#' + path
      await act(async () => root.render(<App />))
      await act(async () => { await new Promise(r => setTimeout(r, 0)) })
      expect(window.location.hash).toBe('#/home')
    })
  }
})
