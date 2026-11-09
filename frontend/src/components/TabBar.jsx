import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { FRIENDS_SCREEN } from '../lib/fork-flags.js'
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
// Starting a workout lives on Home's Today card. A workout you stepped away from comes back from
// the Resume pill above the bar, with its running time.
const PARENT = {
  plan: 'plan', history: 'plan', library: 'plan',
  stats: 'stats', measurements: 'stats', muscles: 'stats', 'structural-balance': 'stats', 'progress-photos': 'stats',
  settings: 'home', checkin: 'home', coach: 'home', admin: 'home',
}

export default function TabBar() {
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

  // A session away from its screen: the pill brings it back (the marker stays where it was, #21).
  const away = !!S.active && cur !== 'workout'
  const running = away && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const resumeLabel = S.active?.editingWorkoutId ? t('Edit workout') : t('Resume')

  return (
    <nav id="tabbar">
      {away && (
        <button type="button" className="tab-resume" data-tour="start" onClick={() => nav('/workout')} aria-label={resumeLabel}>
          <Icon name="play" />
          <span>{resumeLabel}</span>
          {running && <span className="tab-time"><Elapsed start={S.active.start} /></span>}
        </button>
      )}
      <Tab active={on('home')} icon="house" label={t('Home')} dot={trouble} onClick={() => switchTab('/home')} tour="tab-home" />
      <Tab active={on('plan')} icon="dumbbell" label={t('Workouts')} onClick={() => switchTab('/plan')} tour="tab-plan" />
      <Tab active={on('stats')} icon="chart" label={t('Progress')} onClick={() => switchTab('/stats')} tour="tab-stats" />
      {FRIENDS_SCREEN && <Tab active={on('friends')} icon="users" label={t('Friends')} onClick={() => switchTab('/friends')} tour="tab-friends" />}
    </nav>
  )
}
