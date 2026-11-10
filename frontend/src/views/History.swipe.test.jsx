// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import History, { deleteWorkoutWithUndo } from './History.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { mediaStore } from '../lib/media-store.js'

let root, host, widthDesc, windowWidth
const photo = 'a'.repeat(64), video = 'b'.repeat(64), poster = 'c'.repeat(64)
const workout = { id: 'w', name: 'Push', d: '2026-01-02', start: 100, end: 200, entries: [{ id: 'bench', sets: [{ w: 50, r: 5, done: true, media: [{ hash: video, poster: { hash: poster } }] }] }], media: [{ hash: photo }] }
const pe = (type, x, y = 100) => {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(e, { pointerId: { value: 1 }, pointerType: { value: 'touch' }, clientX: { value: x }, clientY: { value: y } })
  return e
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  useUI.getState().closeAll()
  // happy-dom animations use a separate clock; finish the collapse on the test clock.
  vi.spyOn(Element.prototype, 'animate').mockImplementation((_, options) => {
    const animation = { onfinish: null, cancel: () => clearTimeout(timer) }
    const timer = setTimeout(() => animation.onfinish?.(), options?.duration || 0)
    return animation
  })
  windowWidth = window.innerWidth
  useStore.setState({ S: { ...structuredClone(DEF), workouts: [structuredClone(workout)], dayNotes: { '2026-01-01': { text: 'Rest' } } }, user: null })
  Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
  widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { get: () => 360, configurable: true })
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<MemoryRouter><History /></MemoryRouter>))
})
afterEach(() => {
  act(() => { root.unmount(); useUI.getState().dismissToast(); useUI.getState().closeAll() })
  host.remove()
  Object.defineProperty(window, 'innerWidth', { value: windowWidth, configurable: true })
  if (widthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDesc)
  else delete HTMLElement.prototype.clientWidth
  document.documentElement.dir = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function swipe(from, to, y = 100) {
  const row = host.querySelector('.swrow')
  act(() => row.dispatchEvent(pe('pointerdown', from)))
  act(() => row.dispatchEvent(pe('pointermove', to, y)))
  act(() => row.dispatchEvent(pe('pointerup', to, y)))
  act(() => vi.advanceTimersByTime(900))
}
it.each(['ltr', 'rtl'])('swipes toward line start in %s, offers Undo, and restores the row', dir => {
  document.documentElement.dir = dir
  expect(host.querySelectorAll('.swrow')).toHaveLength(1)
  expect(host.querySelector('.day-note-row').closest('.swrow')).toBeNull()
  swipe(dir === 'ltr' ? 340 : 40, dir === 'ltr' ? 30 : 350)
  expect(useStore.getState().S.workouts).toHaveLength(0)
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(useUI.getState().toastAction.label).toBe('Undo')
  for (const hash of [photo, video, poster]) expect(mediaStore.isHeld(hash)).toBe(true)
  act(() => useUI.getState().runToastAction())
  expect(useStore.getState().S.workouts).toEqual([workout])
  expect(host.querySelectorAll('.swrow')).toHaveLength(1)
  for (const hash of [photo, video, poster]) expect(mediaStore.isHeld(hash)).toBe(false)
})
it('does not delete on vertical scrolling or the opposite swipe', () => {
  swipe(200, 210, 300)
  swipe(40, 350)
  expect(useStore.getState().S.workouts).toHaveLength(1)
})
it('still opens workout details on a tap', () => {
  act(() => host.querySelector('.swfront .item').click())
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(useStore.getState().S.workouts).toHaveLength(1)
})
it('expires Undo and releases media when the toast is replaced', () => {
  act(() => deleteWorkoutWithUndo(workout))
  act(() => useUI.getState().toast('Another action'))
  expect(useUI.getState().toastAction).toBeNull()
  for (const hash of [photo, video, poster]) expect(mediaStore.isHeld(hash)).toBe(false)
  expect(useStore.getState().S.workouts).toHaveLength(0)
})
it('reveals a delete button on a short swipe without opening workout details', () => {
  swipe(240, 170)
  expect(useStore.getState().S.workouts).toHaveLength(1)
  const pane = host.querySelector('.swpane.del')
  expect(pane.getAttribute('aria-hidden')).toBeNull()
  expect(pane.querySelector('button').textContent).toBe('Delete workout')
  act(() => pane.querySelector('button').click())
  act(() => vi.advanceTimersByTime(900))
  expect(useStore.getState().S.workouts).toHaveLength(0)
  expect(useUI.getState().toastAction.label).toBe('Undo')
})
it('expires Undo after five seconds and leaves the workout deleted', () => {
  act(() => deleteWorkoutWithUndo(workout))
  act(() => vi.advanceTimersByTime(5000))
  expect(useUI.getState().toastAction).toBeNull()
  for (const hash of [photo, video, poster]) expect(mediaStore.isHeld(hash)).toBe(false)
  act(() => useUI.getState().runToastAction())
  expect(useStore.getState().S.workouts).toHaveLength(0)
})
it('undoes only the latest deletion and preserves intervening edits', () => {
  const second = { ...workout, id: 'second', entries: [], media: [] }
  act(() => useStore.getState().update(s => { s.workouts.push(second) }))
  act(() => deleteWorkoutWithUndo(workout))
  act(() => deleteWorkoutWithUndo(second))
  for (const hash of [photo, video, poster]) expect(mediaStore.isHeld(hash)).toBe(false)
  act(() => useStore.getState().update(s => { s.dayNotes['2026-01-03'] = { text: 'New note' } }))
  act(() => useUI.getState().runToastAction())
  expect(useStore.getState().S.workouts).toEqual([second])
  expect(useStore.getState().S.dayNotes['2026-01-03'].text).toBe('New note')
})
