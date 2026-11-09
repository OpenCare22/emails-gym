import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'

// The Workouts tab holds three pages (DESIGN_PLAN step 3): routines (Plan), History and the
// exercise library. This is the switch between them, drawn as the app's segmented control. The
// pages keep their own routes, so links, Back and the tour all work as before. `current` is the
// page's own path (passed in, so the switcher needs nothing from the router but navigate).
const PAGES = [
  { path: '/plan', label: () => t('Routines'), tour: 'ws-plan' },
  { path: '/history', label: () => t('History'), tour: 'ws-history' },
  { path: '/library', label: () => t('Exercises'), tour: 'tab-library' },
]

export default function WorkoutsSwitcher({ current }) {
  const nav = useNavigate()
  const i = Math.max(0, PAGES.findIndex(p => current === p.path))
  return (
    <nav className="seg workouts-switch" style={{ '--n': PAGES.length, '--i': i }} aria-label={t('Workouts')}>
      <span className="seg-sel" aria-hidden="true" />
      {PAGES.map((p, k) => (
        <button key={p.path} type="button" className={k === i ? 'on' : ''} aria-current={k === i ? 'page' : undefined}
          data-tour={p.tour} onClick={() => { if (k !== i) nav(p.path, { replace: true }) }}>
          <span>{p.label()}</span>
        </button>
      ))}
    </nav>
  )
}
