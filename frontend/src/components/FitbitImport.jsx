import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { useGoogleHealth, importableExercises, workoutFromExercise, dismissExercise } from '../lib/google-health.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function FitbitImport() {
  const S = useStore(s => s.S)
  const info = useGoogleHealth(s => s.info)
  const exercises = info?.data?.exercise || []
  const offered = importableExercises(S, exercises, { today: todayISO() })
  const importExercise = e => {
    let added = false
    useStore.getState().update(state => {
      if (!importableExercises(state, [e], { today: todayISO() }).length) return
      state.workouts.push(workoutFromExercise(e, state))
      state.workouts.sort((a, b) => a.d.localeCompare(b.d) || a.start - b.start)
      added = true
    })
    if (added) useUI.getState().toast(t('Added to your history'))
  }
  return offered.map(e => <div className="card fitbit-import" key={e.id}>
    <div>{t('From your Fitbit: {0}, {1} min', e.name || t('Workout'), fmtNum(e.minutes))}
      {e.distanceKm > 0 && t(', {0} km', fmtNum(e.distanceKm))}
      {e.avgHr > 0 && t(', avg {0} bpm', fmtNum(e.avgHr))}
    </div>
    <div className="row" style={{ gap: 8, marginTop: 12 }}>
      <Button variant="primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => importExercise(e)}>{t('Import')}</Button>
      <Button style={{ minHeight: 44, minWidth: 44 }} onClick={() => useStore.getState().update(state => dismissExercise(state, e.id))}>{t('Dismiss')}</Button>
    </div>
  </div>)
}
