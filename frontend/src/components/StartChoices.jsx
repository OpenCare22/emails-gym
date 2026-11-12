import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { startFlow, logPastWorkoutSheet } from '../sheets.jsx'
import { effectiveRoutines, effectiveRoutineIds } from '../lib/history.js'
import { exCount, todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { glyphOf } from '../lib/glyphs.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

/* What the round Start button offers (and /workout with nothing in progress): today's plan first
   when the day has one, then Freestyle, the other routines and Log a past workout. Every start goes
   through startFlow, so the weigh-in and the rest of the start work as before. `close` runs first:
   the sheet goes before the workout screen opens. */
export function StartChoices({ close }) {
  const S = useStore(s => s.S)
  const today = todayISO()
  const todayRoutines = effectiveRoutines(S, today)
  // A day whose routines are all empty starts nothing useful: it reads as a rest day here, the
  // way the Start button always treated it.
  const planned = todayRoutines.some(r => r.ex.length) ? todayRoutines : []
  const ids = new Set(planned.map(r => r.id))
  const others = S.routines.filter(r => !ids.has(r.id))
  const go = fn => () => { close?.(); fn() }
  const name = planned.map(r => r.name).join(' + ')
  const freestyle = <Button key="freestyle" data-start-choice="freestyle" variant={planned.length ? 'tinted' : 'primary'} icon="shuffle"
    onClick={go(() => startFlow([]))}>{t('Freestyle: pick exercises as you go')}</Button>

  return <div className="start-choices">
    {planned.length > 0 && <button type="button" className="start-plan" data-start-choice="plan" onClick={go(() => startFlow(effectiveRoutineIds(S, today)))}>
      <span className="lrow-i"><Icon name={glyphOf(planned[0].emoji)} /></span>
      <span className="grow"><span className="tt">{name}</span>
        <span className="ss">{t("Today's plan")} · {exCount(planned.reduce((n, r) => n + r.ex.length, 0))}</span></span>
      <Icon name="play" />
    </button>}
    {freestyle}
    {others.length > 0 && <>
      <h4 className="sec">{planned.length ? t('Or another routine') : t('Your routines')}</h4>
      <div className="list">{others.map(r => <div key={r.id} className="item" role="button" tabIndex={0} data-start-choice={r.id}
        onClick={go(() => startFlow([r.id]))} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(() => startFlow([r.id]))() } }}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <span className="tag acc">{t('Start')}</span>
      </div>)}</div>
    </>}
    <Button variant="ghost" icon="history" data-start-choice="past" onClick={go(() => logPastWorkoutSheet())}>{t('Log a past workout')}</Button>
  </div>
}

export const startSheet = () => useUI.getState().openSheet(close => <>
  <h3>{t('Start a workout')}</h3>
  <StartChoices close={close} />
</>)
