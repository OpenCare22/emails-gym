// The first-run question (lib/day-log.js needsModeChoice): just log, or the whole app. Asked once,
// of a profile with nothing logged or planned; Settings switches it either way later.
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'

export function setAppMode(mode) {
  useStore.getState().update(s => { s.appMode = mode === 'simple' ? 'simple' : 'full' })
}

export default function ModeChoice() {
  return <div className="narrow mode-choice">
    <h1>{t('How do you want to use the app?')}</h1>
    <p className="sub">{t('You can switch at any time in Settings. Nothing you log is lost.')}</p>
    <button type="button" className="mode-opt" data-mode="simple" onClick={() => setAppMode('simple')}>
      <span className="mode-ic"><Icon name="note" /></span>
      <span className="mode-txt">
        <span className="mode-t">{t('Just log my workouts')}</span>
        <span className="mode-s">{t('Write down each exercise with its weight and reps, at the gym or afterwards, and see what you did last time.')}</span>
      </span>
    </button>
    <button type="button" className="mode-opt" data-mode="full" onClick={() => setAppMode('full')}>
      <span className="mode-ic"><Icon name="dumbbell" /></span>
      <span className="mode-txt">
        <span className="mode-t">{t('The full app')}</span>
        <span className="mode-s">{t('Plans and routines, automatic progression, rest timers, the coach and detailed stats.')}</span>
      </span>
    </button>
  </div>
}
