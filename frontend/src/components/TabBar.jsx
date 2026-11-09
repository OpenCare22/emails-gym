import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { FRIENDS_SCREEN } from '../lib/fork-flags.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'
import { retapTab } from '../lib/scroll-top.js'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, dot, tour }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} data-tour={tour} aria-label={dot ? label + ', ' + t('Connection problem') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" aria-hidden="true" />}</span><span>{label}</span>
    </button>
  )
}

// Email's Gym navigation (DESIGN_PLAN step 3): Home · Workouts · Progress · Friends. A screen
// without a tab of its own lights the tab it belongs to:
//   Workouts  /plan (routines, programmes), /history, /library
//   Progress  /stats, /measurements, /muscles (and the hidden photos and structural balance)
//   Home      /home, /settings, /checkin, the Coach
// The round button in the middle starts today's workout, and brings back one you stepped away
// from (Resume, with its running time).
const PARENT = {
  plan: 'plan', history: 'plan', library: 'plan',
  stats: 'stats', measurements: 'stats', muscles: 'stats', 'structural-balance': 'stats', 'progress-photos': 'stats',
  settings: 'home', checkin: 'home', coach: 'home', admin: 'home',
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // With the connection banner switched off, a sync problem shows as a dot on Home, the tab
  // Settings lives under (#369, #330).
  const trouble = useConnectionTrouble()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const parent = PARENT[cur]
  const on = k => cur === k || parent === k

  // Root tabs are peers, not another level to unwind with Back. The tab you are already on takes
  // you to the top of its page instead (lib/scroll-top.js).
  // A tab with several pages of its own (Workouts: Routines, History, Exercises) treats each of
  // them as its top: tapped again there, that page scrolls up (Exercises: to its search field).
  const ROOTS = { '/plan': ['/plan', '/history', '/library'] }
  const switchTab = path => {
    const here = (ROOTS[path] || [path]).find(p => loc.pathname === p)
    if (here && !loc.search) retapTab(here)
    else nav(path, { replace: true })
  }

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (onStart && effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }

  return (
    <nav id="tabbar">
      <Tab active={on('home')} icon="house" label={t('Home')} dot={trouble} onClick={() => switchTab('/home')} tour="tab-home" />
      <Tab active={on('plan')} icon="dumbbell" label={t('Workouts')} onClick={() => switchTab('/plan')} tour="tab-plan" />
      {/* On the workout screen itself there is nothing to resume, so the button reads as the
          tab it is and stays lit (#29); anywhere else it brings you back to the exercise you
          were on (#21). A live session you stepped away from shows its running time, the button
          still named Resume; a past workout being edited has no clock to run. */}
      <button type="button" data-tour="start" className={'start' + (S.active ? ' rec' : '') + (S.active && cur === 'workout' ? ' on' : '')} onClick={startWorkout}
        aria-label={running ? t('Resume') : undefined}>
        <span className="cir"><Icon name="play" /></span>
        {running ? <span className="tab-time"><Elapsed start={S.active.start} /></span>
          : <span>{S.active ? (cur === 'workout' ? t('Workout') : S.active.editingWorkoutId ? t('Edit workout') : t('Resume')) : t('Start')}</span>}
      </button>
      <Tab active={on('stats')} icon="chart" label={t('Progress')} onClick={() => switchTab('/stats')} tour="tab-stats" />
      {FRIENDS_SCREEN && <Tab active={on('friends')} icon="users" label={t('Friends')} onClick={() => switchTab('/friends')} tour="tab-friends" />}
    </nav>
  )
}
