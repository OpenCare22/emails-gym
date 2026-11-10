// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useUI } from '../store/useUI.js'
import RestRing from './RestRing.jsx'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), chime: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, el
afterEach(() => {
  if (root) act(() => root.unmount())
  el?.remove()
  useUI.getState().stopRest()
})
it('renders store time and progress and uses the existing pause, resume and skip actions', () => {
  el = document.createElement('div'); document.body.append(el); root = createRoot(el)
  useUI.setState({ timer: { left: 84, total: 120, endsAt: Date.now() + 84000 } })
  act(() => root.render(<RestRing />))
  expect(el.querySelector('[role="timer"]').textContent).toBe('1:24')
  expect(el.querySelector('.focus-rest-progress').getAttribute('stroke-dasharray')).toBe('0.7 1')
  act(() => el.querySelector('button').click())
  expect(useUI.getState().timer.paused).toBe(true)
  expect(el.querySelector('button').textContent).toBe('Resume')
  act(() => el.querySelector('button').click())
  expect(useUI.getState().timer.paused).toBeFalsy()
  act(() => el.querySelectorAll('button')[1].click())
  expect(el.querySelector('.focus-rest')).toBeNull()
})
it('hides the card for absent and finished rests', () => {
  el = document.createElement('div'); root = createRoot(el)
  useUI.setState({ timer: null })
  act(() => root.render(<RestRing />))
  expect(el.textContent).toBe('')
  act(() => useUI.setState({ timer: { left: 0, total: 60, ready: true } }))
  expect(el.textContent).toBe('')
})
