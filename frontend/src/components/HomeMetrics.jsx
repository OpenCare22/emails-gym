import { t, tn, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { weekTraining } from '../lib/week-training.js'
import Icon from './Icon.jsx'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { MOBILE } from '../lib/mobile.js'
import { useGoogleHealth, applyWeighIns, stepsOn, latestRestingHr, weekAverageSteps } from '../lib/google-health.js'

// Home's metric cards and weekly chart (handoff §4A, DESIGN_PLAN step 5). Real data only: steps
// and resting heart rate come from the merged health data (PLAN.md Phase 4); until it is connected each
// card says so plainly instead of showing a number, and a tap opens Settings → Integrations.

/** One metric: a label, then the value with its unit, or the reason there is none. */
export function MetricCard({ icon, tint, label, value, unit, note, state = 'ready' }) {
  return (
    <div className="card metric-card">
      <div className="metric-head"><Icon name={icon} style={tint ? { color: tint } : undefined} /><span>{label}</span></div>
      {state === 'ready'
        ? <div className="metric-value">{value}{unit && <span className="metric-unit"> {unit}</span>}</div>
        : <div className="metric-off">{state === 'loading' ? t('Loading…') : t('Not connected')}</div>}
      {note && <div className="metric-note">{note}</div>}
    </div>
  )
}

/** Steps and resting heart rate from connected health providers (lib/google-health.js), or why there are none. */
export function HomeMetrics() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const offered = !!useStore(s => s.config)?.health?.google
  const { info, load } = useGoogleHealth()
  useEffect(() => {
    if (!user || MOBILE) return
    load({ sync: 'auto' }, w => useStore.getState().update(s => { applyWeighIns(s, w) }))
  }, [user, offered]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayISO()
  const connected = !!(info?.anyConnected ?? info?.connected)
  const steps = connected ? stepsOn(info.data, today) : null
  const avg = connected ? weekAverageSteps(info.data, today) : null
  const rhr = connected ? latestRestingHr(info.data) : null
  const sourceNote = (key, d) => {
    const source = info?.data?.sources?.[key]?.[d]
    return source === 'apple' ? t('from Apple Watch') : source === 'google' ? t('from Fitbit') : null
  }
  const stepSource = sourceNote('steps', today)
  const stepNote = t('Today') + (stepSource ? ', ' + stepSource : '')
  const hrSource = rhr && sourceNote('restingHr', rhr.d)
  const open = () => nav('/settings/integrations')
  const off = !connected ? t('Connect your Fitbit or Apple Watch in Settings to see it here.') : info.status === 'reconnect' ? t('Reconnect Google Health in Settings.') : null
  const when = d => (d === today ? t('Today') : d === isoDaysAgo(today, 1) ? t('Yesterday') : new Date(d + 'T12:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }))
  return (
    <div className="metric-pair">
      <button type="button" className="metric-tap" onClick={open} aria-label={t('Steps') + ': ' + (steps != null ? steps : t('Not connected'))}>
        {steps != null
          ? <MetricCard icon="footprints" label={t('Steps')} value={steps.toLocaleString(dateLocale())} note={avg != null ? t('{0} a day last week', avg.toLocaleString(dateLocale())) : stepNote} />
          : <MetricCard icon="footprints" label={t('Steps')} state={connected ? 'ready' : 'off'} value={connected ? '0' : null} note={off || stepNote} />}
      </button>
      <button type="button" className="metric-tap" onClick={open} aria-label={t('Resting HR') + ': ' + (rhr ? rhr.bpm : t('Not connected'))}>
        {rhr
          ? <MetricCard icon="heart" tint="var(--heart-rate)" label={t('Resting HR')} value={rhr.bpm} unit={t('bpm')} note={when(rhr.d) + (hrSource ? ', ' + hrSource : '')} />
          : <MetricCard icon="heart" tint="var(--heart-rate)" label={t('Resting HR')} state="off" note={off || t('No reading yet')} />}
      </button>
    </div>
  )
}

const isoDaysAgo = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10)

/**
 * This week's training, one bar per day (completed sets), labelled and with a text equivalent
 * for screen readers. Today is outlined; days still to come are left empty, never "missed".
 */
export function TrainingBarChart({ S, today = todayISO() }) {
  const days = weekTraining(S, today, today)
  const max = Math.max(1, ...days.map(d => d.sets))
  const total = days.reduce((n, d) => n + d.sets, 0)
  const name = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short' })
  const summary = days.map(d => name(d.iso) + ' ' + (d.future ? '–' : tn('{0} set', '{0} sets', d.sets))).join(', ')
  return (
    <div className="card week-chart">
      <div className="week-chart-head">
        <h2>{t('Weekly training')}</h2>
        <span className="dim small">{tn('{0} set this week', '{0} sets this week', total)}</span>
      </div>
      <div className="week-bars" role="img" aria-label={t('Completed sets this week') + ': ' + summary}>
        {days.map(d => (
          <div key={d.iso} className={'week-bar' + (d.iso === today ? ' today' : '') + (d.future ? ' future' : '')}>
            <span className="week-bar-n" aria-hidden="true">{d.future || !d.sets ? '' : d.sets}</span>
            <span className="week-bar-track" aria-hidden="true"><span className="week-bar-fill" style={{ height: (d.sets / max) * 100 + '%' }} /></span>
            <span className="week-bar-day" aria-hidden="true">{name(d.iso)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
