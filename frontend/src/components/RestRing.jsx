import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function RestRing() {
  const timer = useUI(s => s.timer)
  const { pauseRest, resumeRest, skipRest } = useUI.getState()
  if (!timer || timer.ready) return null
  // The store ticks from absolute endsAt timestamps, including after backgrounding.
  const left = Math.max(0, timer.left ?? timer.total)
  const fraction = Math.max(0, Math.min(1, left / timer.total))
  const clock = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0')
  return <section className="focus-rest" aria-label={t('Rest timer')}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="focus-rest-track" cx="50" cy="50" r="42" />
      <circle className="focus-rest-progress" cx="50" cy="50" r="42" pathLength="1"
        strokeDasharray={`${fraction} 1`} transform="rotate(-90 50 50)" />
    </svg>
    <div className="focus-rest-clock"><strong role="timer">{clock}</strong>
      <span>{timer.kind === 'switch' ? t('Switch sides') : t('Rest')}</span>
    </div>
    <div className="focus-rest-actions">
      <Button icon={timer.paused ? 'play' : 'pause'} aria-pressed={!!timer.paused}
        onClick={timer.paused ? resumeRest : pauseRest}>{timer.paused ? t('Resume') : t('Pause')}</Button>
      <Button onClick={() => skipRest()}>{t('Skip')}</Button>
    </div>
  </section>
}
