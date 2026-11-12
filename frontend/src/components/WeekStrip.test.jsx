// @vitest-environment happy-dom
// Home's week strip (components/WeekStrip.jsx): press and hold a planned day, drag it onto another
// and let go, and the session moves for that date only (lib/day-move.js), with an Undo. A plain tap
// still opens the day's sheet.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import WeekStrip from './WeekStrip.jsx'
import { MoveDayList } from './MoveDaySheet.jsx'

const routines = [{ id: 'r1', name: 'Pull', emoji: null, ex: [{ id: 'x' }] }, { id: 'r2', name: 'Legs', emoji: null, ex: [{ id: 'y' }] }]
// Wednesday 11 November 2026; the strip starts on Monday 9th.
const NOW = new Date('2026-11-11T10:00:00')
const MON = new Date('2026-11-09T12:00:00')

let host, root, onDay
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(NOW)
  onDay = vi.fn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, routines, dayPlan: {}, workouts: [], active: null, queue: null, scheduleMode: 'week', week: { 4: ['r1'] }, ...over },
}))
const mount = () => act(() => root.render(<WeekStrip S={useStore.getState().S} start={MON} onDay={onDay} />))
const day = iso => host.querySelector(`[data-iso="${iso}"]`)
const fire = (el, type, x = 0, y = 0) => act(() => { el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })) })
const dragTo = (from, to) => {
  const orig = document.elementFromPoint
  document.elementFromPoint = () => to
  fire(from, 'pointerdown', 100, 10)
  act(() => { vi.advanceTimersByTime(400) })
  fire(window, 'pointermove', 50, 10)
  fire(window, 'pointerup', 50, 10)
  document.elementFromPoint = orig
}

describe('WeekStrip drag', () => {
  it('press, hold and drop on today moves the session, with an Undo', () => {
    setS(); mount()
    const toast = vi.spyOn(useUI.getState(), 'toast')
    dragTo(day('2026-11-12'), day('2026-11-11'))
    const S = useStore.getState().S
    expect(S.dayPlan['2026-11-11']).toBe('r1')
    expect(S.dayPlan['2026-11-12']).toBe('rest')
    expect(toast).toHaveBeenCalled()
    const [, opts] = toast.mock.calls.at(-1)
    expect(opts.action).toBe('Undo')
    act(() => opts.onAction())
    expect(useStore.getState().S.dayPlan).toEqual({})
    toast.mockRestore()
  })

  it('a quick tap opens the day sheet and moves nothing', () => {
    setS(); mount()
    const el = day('2026-11-12')
    fire(el, 'pointerdown', 100, 10)
    fire(window, 'pointerup', 100, 10)
    act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onDay).toHaveBeenCalledWith('2026-11-12')
    expect(useStore.getState().S.dayPlan).toEqual({})
  })

  it('a past day does not start a drag', () => {
    setS({ week: { 1: ['r1'] } }); mount()
    dragTo(day('2026-11-09'), day('2026-11-11'))
    expect(useStore.getState().S.dayPlan).toEqual({})
  })

  it('a drop on a done day does nothing', () => {
    setS({ workouts: [{ id: 'w', d: '2026-11-11', entries: [] }] }); mount()
    dragTo(day('2026-11-12'), day('2026-11-11'))
    expect(useStore.getState().S.dayPlan).toEqual({})
  })
})

describe('Move to another day list', () => {
  it('lists the days that can take the session and moves on a tap', () => {
    setS({ week: { 4: ['r1'], 5: ['r1', 'r2'] } })
    const close = vi.fn()
    act(() => root.render(<MoveDayList iso="2026-11-12" close={close} />))
    const rows = [...host.querySelectorAll('[data-move-to]')].map(r => r.getAttribute('data-move-to'))
    expect(rows).toContain('2026-11-11')
    expect(rows).not.toContain('2026-11-12')
    expect(rows).not.toContain('2026-11-13')   // combined day
    expect(rows).not.toContain('2026-11-10')   // past
    act(() => { host.querySelector('[data-move-to="2026-11-11"]').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(useStore.getState().S.dayPlan['2026-11-11']).toBe('r1')
    expect(close).toHaveBeenCalled()
  })
})

describe('the day sheet', () => {
  it('offers "Move to another day" for a movable day and not for a combined one', async () => {
    const { DayOverride } = await import('../sheets.jsx')
    setS({ week: { 4: ['r1'], 5: ['r1', 'r2'] } })
    act(() => root.render(<DayOverride iso="2026-11-12" close={() => {}} />))
    expect(host.querySelector('[data-move-day]')).toBeTruthy()
    act(() => root.render(<DayOverride iso="2026-11-13" close={() => {}} />))
    expect(host.querySelector('[data-move-day]')).toBeNull()
  })
})

describe('after a drag', () => {
  it('the next tap on another day still opens it, even when the drop sent no click', () => {
    setS(); mount()
    dragTo(day('2026-11-12'), day('2026-11-11'))
    // a real tap: press, let go, click
    fire(day('2026-11-14'), 'pointerdown', 200, 10)
    fire(window, 'pointerup', 200, 10)
    act(() => { day('2026-11-14').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onDay).toHaveBeenCalledWith('2026-11-14')
  })

})

// A day that can be dragged must not hand the gesture to page scrolling: touch-action is read
// once at pointerdown, so it is set on the day itself, not switched on mid-drag.
it('a movable day keeps the whole touch gesture for the drag', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync(process.cwd() + '/src/index.css', 'utf8')
  expect(css).toMatch(/\.wday\.movable\{[^}]*touch-action:none/)
})
