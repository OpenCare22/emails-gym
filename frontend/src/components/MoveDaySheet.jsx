import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { canMoveTo, moveSession, undoMove } from '../lib/day-move.js'
import { effectiveRoutines } from '../lib/history.js'
import { fmtDate, isoOf, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'
import Icon from './Icon.jsx'

// Moving a planned session to another date (lib/day-move.js): the drag on Home's week strip and
// the day sheet's "Move to another day" both end here, with an Undo that puts both days back.
export function moveWithUndo(from, to) {
  const st = useStore.getState()
  const name = effectiveRoutines(st.S, from)[0]?.name || t('Workout')
  let before = null
  st.update(s => { before = moveSession(s, from, to).before })
  useUI.getState().toast(t('{0} moved to {1}', name, fmtDate(to, true)), {
    action: t('Undo'), onAction: () => useStore.getState().update(s => { undoMove(s, before) }),
  })
}

// How far ahead the list looks: two weeks covers "this week or next".
const AHEAD = 14

/** The days that can take `iso`'s session, today and the next two weeks; a tap moves it there. */
export function MoveDayList({ iso, close }) {
  const S = useStore(s => s.S)
  const today = todayISO()
  const days = []
  for (let i = 0; i < AHEAD; i++) {
    const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + i)
    const to = isoOf(d)
    if (canMoveTo(S, iso, to, today)) days.push(to)
  }
  const name = effectiveRoutines(S, iso)[0]?.name || ''
  return <>
    <h3>{t('Move {0}', name)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Just this once. The routine keeps its usual day.')}</div>
    <div className="list">{days.map(to => {
      const there = effectiveRoutines(S, to)[0]
      return <div key={to} className="item" data-move-to={to} {...tappable(() => { moveWithUndo(iso, to); close() })}>
        <span className="lrow-i" style={there ? undefined : { background: 'var(--surface-3)' }}><Icon name={there ? glyphOf(there.emoji) : 'moon'} /></span>
        <div className="grow"><div className="tt">{to === today ? t('Today') : fmtDate(to, true)}</div>
          <div className="ss">{there ? t('Swaps with {0}', there.name) : t('Rest day')}</div></div>
      </div>
    })}</div>
    {!days.length && <div className="empty small">{t('No free day in the next two weeks.')}</div>}
  </>
}

export const moveDaySheet = iso => useUI.getState().openSheet(close => <MoveDayList iso={iso} close={close} />)
