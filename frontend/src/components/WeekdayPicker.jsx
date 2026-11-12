import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYN, weekOrder, weekStartOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

/* The days one routine is trained on (Workouts, a routine row's day chips). Each tap adds the
   routine to that weekday or takes it off, writing S.week the way the day sheet does
   (dayAssignSheet): another routine already on the day stays, and the two make a combined day. */
export function WeekdayPicker({ routineId, close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const r = S.routines.find(x => x.id === routineId)
  const on = d => [].concat(S.week[d] || []).includes(routineId)
  const others = d => [].concat(S.week[d] || []).filter(id => id !== routineId)
    .map(id => S.routines.find(x => x.id === id)?.name).filter(Boolean)
  const toggle = d => update(s => {
    const ids = [].concat(s.week[d] || [])
    const next = ids.includes(routineId) ? ids.filter(id => id !== routineId) : [...ids, routineId]
    if (next.length) s.week[d] = next; else delete s.week[d]
  })
  return <>
    <h3>{r ? t('Days for {0}', r.name) : t('Days')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Pick the days you train it. Another routine on the same day makes a combined session.')}</div>
    <div className="list">{weekOrder(weekStartOf(S)).map(d => {
      const with_ = others(d)
      return <div key={d} className="item menu-item" data-weekday={d} aria-pressed={on(d)} {...tappable(() => toggle(d))}>
        <div className="grow"><div className="tt">{t(DAYN[d])}</div>{with_.length > 0 && <div className="ss">{t('With {0}', with_.join(', '))}</div>}</div>
        <span className={'menu-on' + (on(d) ? ' is-on' : '')}><Icon name="check" /></span>
      </div>
    })}</div>
    <div style={{ height: 12 }} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}

export const weekdayPickerSheet = routineId => useUI.getState().openSheet(close => <WeekdayPicker routineId={routineId} close={close} />)
