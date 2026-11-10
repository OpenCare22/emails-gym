// Trophies and card backgrounds in the app (PLAN.md Phase 7 item 7; the rules that award them are
// api/social/trophies.js). Names, how to earn each, and which backgrounds a set of trophies unlocks.
import { t } from './i18n.js'

const LIFT = () => ({ squat: t('Squat'), bench: t('Bench press'), deadlift: t('Deadlift') })
const METRIC = () => ({ workouts: t('workouts'), volume: t('volume'), steps: t('steps'), activeMinutes: t('active minutes') })

/** { name, how, tier: 'gold' | 'silver' | 'bronze', icon } for a trophy kind. */
export function trophyInfo(kind) {
  let m
  if ((m = /^week-(\w+)$/.exec(kind))) return { name: t('Week winner: {0}', METRIC()[m[1]] || m[1]), how: t('Top of the group for a week'), tier: 'gold', icon: 'crown' }
  if ((m = /^workouts-(\d+)$/.exec(kind))) {
    const n = +m[1]
    return { name: n === 1 ? t('First workout') : t('{0} workouts', n), how: n === 1 ? t('Finish your first workout') : t('Finish {0} workouts', n), tier: n >= 100 ? 'gold' : n >= 10 ? 'silver' : 'bronze', icon: 'dumbbell' }
  }
  if ((m = /^streak-(\d+)$/.exec(kind))) return { name: t('{0}-week streak', +m[1]), how: t('Train {0} weeks in a row', +m[1]), tier: +m[1] >= 26 ? 'gold' : +m[1] >= 12 ? 'silver' : 'bronze', icon: 'flame' }
  if ((m = /^records-(\d+)$/.exec(kind))) return { name: +m[1] === 1 ? t('First record') : t('{0} records', +m[1]), how: +m[1] === 1 ? t('Set a personal record') : t('Set {0} personal records', +m[1]), tier: +m[1] >= 50 ? 'gold' : +m[1] >= 10 ? 'silver' : 'bronze', icon: 'star' }
  if ((m = /^(squat|bench|deadlift)-([\d.]+)$/.exec(kind))) return { name: t('{0} at {1} × body weight', LIFT()[m[1]], m[2]), how: t('Estimated {0} of {1} × your body weight', LIFT()[m[1]].toLowerCase(), m[2]), tier: 'silver', icon: 'medal' }
  return { name: kind, how: '', tier: 'bronze', icon: 'trophy' }
}

/** Every milestone, in cabinet order, for showing the ones still to earn. */
export const ALL_MILESTONES = [
  'workouts-1', 'workouts-10', 'workouts-50', 'workouts-100', 'workouts-250',
  'streak-4', 'streak-12', 'streak-26', 'streak-52', 'records-1', 'records-10', 'records-50',
  'squat-1', 'squat-1.5', 'squat-2', 'bench-0.75', 'bench-1', 'bench-1.25', 'deadlift-1.25', 'deadlift-1.75', 'deadlift-2.25',
]

// Card backgrounds: original patterns in the Email's Gym colours (index.css .cardbg-<id>).
export const BACKGROUNDS = () => [
  { id: 'plain', name: t('Plain'), how: t('Always yours'), unlocked: () => true },
  { id: 'stripes', name: t('Slab stripes'), how: t('Finish 10 workouts'), unlocked: k => k.has('workouts-10') },
  { id: 'grid', name: t('Gym floor'), how: t('Train 4 weeks in a row'), unlocked: k => k.has('streak-4') },
  { id: 'peaks', name: t('Peaks'), how: t('Set 10 personal records'), unlocked: k => k.has('records-10') },
  { id: 'rings', name: t('Rings'), how: t('Win any week in a group'), unlocked: k => [...k].some(x => x.startsWith('week-')) },
  { id: 'gold', name: t('Gold slab'), how: t('Train 26 weeks in a row'), unlocked: k => k.has('streak-26') },
]

/** The backgrounds these trophies unlock, as { id, name, how, open }. */
export function backgroundsFor(trophies = []) {
  const kinds = new Set(trophies.map(x => x.kind))
  return BACKGROUNDS().map(b => ({ ...b, open: b.unlocked(kinds) }))
}

/** A card background to draw: the chosen one if it's unlocked, else plain. */
export const cardClass = (id, trophies = null) => {
  const b = BACKGROUNDS().find(x => x.id === id)
  if (!b || (trophies && !backgroundsFor(trophies).find(x => x.id === id)?.open)) return 'cardbg-plain'
  return 'cardbg-' + b.id
}

const SEEN = 'gym_trophies_seen_v1'
/** Trophies not shown before on this device; remembers them as shown. */
export function freshTrophies(trophies, store = globalThis.localStorage) {
  let seen = []
  try { seen = JSON.parse(store?.getItem(SEEN)) || [] } catch { /* none yet */ }
  const fresh = trophies.filter(x => !seen.includes(x.id))
  try { store?.setItem(SEEN, JSON.stringify([...new Set([...seen, ...trophies.map(x => x.id)])].slice(-500))) } catch { /* private mode */ }
  // The first time ever, nothing is "new": a cabinet full of old trophies isn't a celebration.
  return seen.length ? fresh : []
}
