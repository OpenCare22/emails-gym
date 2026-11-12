import { useEffect, useRef, useState } from 'react'
import { effectiveRoutineIds } from '../lib/history.js'
import { canMoveFrom, canMoveTo } from '../lib/day-move.js'
import { dayNoteOf } from '../lib/day-notes.js'
import { DAYS, isoOf, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { moveWithUndo } from './MoveDaySheet.jsx'

// How long a finger rests on a day before it is picked up, and how far it may wander meanwhile:
// moving further first is a scroll or a swipe, not a drag.
const HOLD_MS = 350
const SLOP_PX = 8

/* Home's seven days. A tap opens the day (onDay). Press and hold a day with a session that can
   move (lib/day-move.js canMoveFrom), drag it onto another day and let go: it moves there for
   this date only, swapping with a session already there, with an Undo. Pointer events, so mouse,
   pen and touch work alike. */
export default function WeekStrip({ S, start, onDay }) {
  const today = todayISO()
  const [drag, setDrag] = useState(null)   // { from, over }
  const press = useRef(null)               // { from, x, y, timer, live }
  const swallowClick = useRef(false)
  const doneDays = new Set(S.workouts.map(w => w.d))

  // The listeners a press added are kept on the press itself, so whichever render ends it takes
  // off exactly those (each render makes new handler functions).
  const end = () => {
    const p = press.current
    press.current = null
    setDrag(null)
    if (!p) return
    clearTimeout(p.timer)
    window.removeEventListener('pointermove', p.h.move)
    window.removeEventListener('pointerup', p.h.up)
    window.removeEventListener('pointercancel', p.h.cancel)
  }
  const dayAt = (x, y) => document.elementFromPoint?.(x, y)?.closest?.('[data-iso]')?.getAttribute('data-iso') || null
  function onMove(e) {
    const p = press.current
    if (!p) return
    if (!p.live) {
      if (Math.abs(e.clientX - p.x) > SLOP_PX || Math.abs(e.clientY - p.y) > SLOP_PX) end()
      return
    }
    e.preventDefault?.()
    const over = dayAt(e.clientX, e.clientY)
    setDrag(d => (d && d.over === over ? d : { from: p.from, over }))
  }
  function onUp(e) {
    const p = press.current
    if (p?.live) {
      swallowClick.current = true
      const to = dayAt(e.clientX, e.clientY)
      if (to && canMoveTo(S, p.from, to, today)) moveWithUndo(p.from, to)
    }
    end()
  }
  const endRef = useRef(end)
  endRef.current = end
  useEffect(() => () => endRef.current(), [])

  const onDown = iso => e => {
    // A click the last drop never sent (a drop on another day, or iOS after a long press) must not
    // stay armed and swallow this tap.
    swallowClick.current = false
    if (!canMoveFrom(S, iso, today)) return
    end()
    press.current = { from: iso, x: e.clientX, y: e.clientY, live: false, timer: setTimeout(() => {
      if (!press.current) return
      press.current.live = true
      setDrag({ from: iso, over: iso })
      navigator.vibrate?.(10)
    }, HOLD_MS), h: { move: onMove, up: onUp, cancel: end } }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', end)
  }
  const onTap = iso => () => {
    if (swallowClick.current) { swallowClick.current = false; return }
    onDay(iso)
  }

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0, ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    // A day off with a note (#261) reads as excused, not as a plan that went by.
    const dot = done ? ' done' : dayNoteOf(S, iso) ? ' noted' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    const movable = canMoveFrom(S, iso, today)
    const cls = 'wday' + (iso === today ? ' today' : '') + (movable ? ' movable' : '')
      + (drag?.from === iso ? ' dragging' : '')
      + (drag && drag.over === iso && drag.from !== iso ? (canMoveTo(S, drag.from, iso, today) ? ' drop-ok' : ' drop-no') : '')
    days.push(<div key={i} data-iso={iso} className={cls} onPointerDown={onDown(iso)} {...tappable(onTap(iso))}
      aria-description={movable ? t('Press and hold to move this session to another day') : undefined}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  return <div className={'week' + (drag ? ' is-dragging' : '')}>{days}</div>
}
