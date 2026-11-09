import { t, tn, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { weekTraining } from '../lib/week-training.js'
import Icon from './Icon.jsx'

// Home's metric cards and weekly chart (handoff §4A, DESIGN_PLAN step 5). Real data only: steps
// and resting heart rate come from Google Health in PLAN.md Phase 4, so until a source is
// connected each card says so plainly instead of showing a number.

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

/** Steps and resting heart rate, side by side. No wearable is connected before Phase 4. */
export function HomeMetrics() {
  const note = t('Connect Google Health to see it here.')
  return (
    <div className="metric-pair">
      <MetricCard icon="footprints" label={t('Steps')} state="off" note={note} />
      <MetricCard icon="heart" tint="var(--heart-rate)" label={t('Resting HR')} state="off" note={note} />
    </div>
  )
}

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
