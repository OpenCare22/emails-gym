import { useEffect, useState } from 'react'
import { useGoogleHealth } from '../lib/google-health.js'
import { useStore } from '../store/useStore.js'
import { MOBILE } from '../lib/mobile.js'
import { activitySeries, restingHrChange } from '../lib/activity-series.js'
import { todayISO, fmtNum, fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Segmented } from './ui.jsx'
import LineChart from './LineChart.jsx'

const valueText = (v, unit) => v == null ? t('No data') : fmtNum(Math.round(v * 10) / 10) + ' ' + unit
const dates = p => p.d === p.end || !p.end ? fmtDate(p.d, true, true) : t('{0} to {1}', fmtDate(p.d, true, true), fmtDate(p.end, true, true))

// Same labelled, non-interactive bars as Home's weekly training chart.
function ActivityBars({ points, color, unit, title, goal }) {
  const max = Math.max(1, goal || 0, ...points.map(p => p.y || 0)) * 1.12
  const summary = points.map(p => dates(p) + ': ' + valueText(p.y, unit)).join(', ')
  return <div role="img" aria-label={title + ': ' + summary}>
    <svg viewBox="0 0 340 150" style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {points.map((p, i) => {
        const width = 300 / points.length, height = (p.y || 0) / max * 110
        return <rect key={p.d} x={30 + i * width + 1} y={120 - height} width={Math.max(1, width - 2)} height={height} rx="2" fill={color}><title>{dates(p) + ': ' + valueText(p.y, unit)}</title></rect>
      })}
      <text x="26" y="123" textAnchor="end" fontSize="10" fill="var(--label-2)">0</text>
      <text x="26" y="13" textAnchor="end" fontSize="10" fill="var(--label-2)">{fmtNum(Math.round(max))}</text>
      {goal != null && <line x1="30" x2="330" y1={120 - goal / max * 110} y2={120 - goal / max * 110} stroke="var(--chart-2)" strokeDasharray="5 3" />}
      <text x="30" y="145" fontSize="10" fill="var(--label-2)">{fmtDate(points[0].d, true)}</text>
      <text x="330" y="145" textAnchor="end" fontSize="10" fill="var(--label-2)">{fmtDate(points.at(-1).end, true)}</text>
    </svg>
  </div>
}

export default function ActivityCards({ today = todayISO() }) {
  const { info, load } = useGoogleHealth()
  const user = useStore(s => s.user)
  const offered = !!useStore(s => s.config)?.health?.google
  const [days, setDays] = useState(7)
  useEffect(() => {
    if (user && offered && !MOBILE) load({ sync: 'auto' })
  }, [user, offered, load])
  const data = info?.data || {}
  const metrics = [
    { key: 'steps', title: t('Steps'), unit: t('steps'), color: 'var(--chart-1)' },
    { key: 'activeMinutes', title: t('Active minutes'), unit: t('min'), color: 'var(--chart-3)', goal: 150 / 7 },
    { key: 'restingHr', title: t('Resting heart rate'), unit: t('bpm'), color: 'var(--heart-rate)' },
    { key: 'sleep', title: t('Sleep'), unit: t('hours'), color: 'var(--chart-4)' },
  ].filter(m => Object.values(data[m.key] || {}).some(v => Number.isFinite(v) && v >= 0))
  if (!info?.connected || !metrics.length) return null
  return <section className="stats-sect" id="stats-activity" aria-labelledby="stats-h-activity">
    <h2 className="stats-sect-h" id="stats-h-activity">{t('Activity')}</h2>
    <Segmented className="seg-range" ariaLabelledby="stats-h-activity" value={days} onChange={setDays} options={[
      { value: 7, label: t('Week') }, { value: 30, label: t('Month') }, { value: 365, label: t('Year') },
    ]} />
    {metrics.map(m => {
      const values = m.key === 'sleep' ? Object.fromEntries(Object.entries(data.sleep).map(([d, v]) => [d, Number.isFinite(v) ? v / 60 : null])) : data[m.key]
      const series = activitySeries(values, { today, days, weekly: days > 7 && m.key !== 'sleep' })
      const hr = m.key === 'restingHr', change = restingHrChange(series.readings)
      return <div className="card" key={m.key}>
        <h2>{m.title}</h2>
        {series.average == null ? <p className="dim small">{t('No data in this range')}</p> : <>
          <p>{hr ? t('Latest: {0}', valueText(series.readings.at(-1).y, m.unit)) : t('Average: {0}', valueText(series.average, m.unit))}</p>
          {hr ? <>
            <p className="small dim">{change == null ? t('One reading in this range') : change < 0 ? t('Down {0} bpm since the first reading in this range. Lower is better.', fmtNum(-change)) : change > 0 ? t('Up {0} bpm since the first reading in this range. Lower is better.', fmtNum(change)) : t('No change since the first reading in this range. Lower is better.')}</p>
            <div role="img" aria-label={m.title + ': ' + series.readings.map(p => dates(p) + ': ' + valueText(p.y, m.unit)).join(', ')}>
              <div aria-hidden="true"><LineChart points={series.readings} unit={m.unit} color={m.color} h={160} /></div>
            </div>
          </> : <>
            <p className="small dim">{m.key === 'sleep' ? t('Hours per night') : days === 7 ? t('Daily values') : t('Daily averages by week')}</p>
            <ActivityBars points={series.points} {...m} />
            {m.goal != null && <p className="small dim">{t('Dashed line: WHO target of 150 active minutes a week, about 21.4 a day. Moderate and vigorous activity only.')}</p>}
          </>}
        </>}
      </div>
    })}
  </section>
}
