import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { FRIENDS_SCREEN } from '../lib/fork-flags.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'
import { retapTab } from '../lib/scroll-top.js'
import { isSimple } from '../lib/day-log.js'
import { startSheet } from './StartChoices.jsx'

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
//   Workouts  /plan (routines, programmes), /library
//   Progress  /stats, /history, /measurements, /muscles (and the hidden photos and structural balance)
//   Home      /home, /settings, /checkin, the Coach
// The round button in the middle starts today's workout, and brings back one you stepped away
// from (Resume, with its running time).
const PARENT = {
  plan: 'plan', library: 'plan',
  stats: 'stats', history: 'stats', measurements: 'stats', muscles: 'stats', 'structural-balance': 'stats', 'progress-photos': 'stats',
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
  // The exercise library sits under Workouts (its search icon): tapped again there, Workouts
  // scrolls it up (to its search field) rather than leaving it.
  const ROOTS = { '/plan': ['/plan', '/library'] }
  const switchTab = path => {
    const here = (ROOTS[path] || [path]).find(p => loc.pathname === p)
    if (here && !loc.search) retapTab(here)
    else nav(path, { replace: true })
  }

  // Simple mode (lib/day-log.js): Today, Progress and, signed in to a server, Friends. No Start
  // button: Today is where a workout is written. History and Settings sit under Today.
  if (isSimple(S)) {
    const lit = k => (k === 'home' ? ['home', 'history', 'settings'].includes(cur) : k === 'stats' ? ['stats', 'muscles', 'measurements'].includes(cur) : cur === k)
    return (
      <nav id="tabbar" className="simple">
        <Tab active={lit('home')} icon="note" label={t('Today')} dot={trouble} onClick={() => switchTab('/home')} />
        <Tab active={lit('stats')} icon="chart" label={t('Progress')} onClick={() => switchTab('/stats')} />
        {FRIENDS_SCREEN && !!user && <Tab active={lit('friends')} icon="users" label={t('Friends')} onClick={() => switchTab('/friends')} />}
      </nav>
    )
  }

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  // With nothing in progress the button offers a choice (components/StartChoices.jsx): today's
  // plan first, then Freestyle and the other routines. Home's Today row still starts the plan in
  // one tap. A session in progress, or a saved workout being edited, is where the button goes back to.
  const startWorkout = () => {
    if (!S.active) { startSheet(); return }
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
