import { useMemo } from 'react'
import { homeProgress } from '../lib/home-progress.js'
import { EXIDX, allExercises } from '../lib/exercises.js'
import { fmtNum, todayISO, exerciseNameText } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// Home's "Your progress" card (lib/home-progress.js): the last 4 weeks in three lines. A tap on
// the header opens Progress, where the full charts are.
export default function HomeProgress({ S, onOpen }) {
  const today = todayISO()
  const p = useMemo(() => homeProgress(S, today), [S.workouts, S.exUnit, S.unit, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const nameOf = id => {
    const ex = EXIDX[id] || allExercises(S).find(e => e.id === id)
    return ex ? exerciseNameText(ex) : id
  }
  return <div className="card home-progress" data-home-progress>
    <button type="button" className="home-progress-head" onClick={onOpen}>
      <span className="lrow-i" style={{ background: 'var(--acc)' }}><Icon name="chart" /></span>
      <span className="grow">{t('Your progress')}</span>
      <span className="small dim">{t('Last 4 weeks')}</span>
      <Icon name="chevronRight" className="chev" />
    </button>
    {p.workouts === 0
      ? <div className="muted small">{t('Train this week and your progress shows up here.')}</div>
      : <>
        <div className="home-progress-kpis">
          <span><b>{p.workouts}</b> {tn('workout', 'workouts', p.workouts)}</span>
          <span><b>{p.records}</b> {tn('new record', 'new records', p.records)}</span>
        </div>
        {p.lifts.map(l => <div key={l.id} className="home-progress-lift" data-lift>
          <span className="grow">{nameOf(l.id)}</span>
          <span>{fmtNum(l.best)} {t(l.unit)}</span>
          {l.delta == null ? null
            : l.delta > 0 ? <span className="home-progress-up">{'▲ ' + fmtNum(l.delta)}</span>
              : l.delta < 0 ? <span className="home-progress-down">{'▼ ' + fmtNum(-l.delta)}</span>
                : <span className="dim">=</span>}
        </div>)}
      </>}
  </div>
}
