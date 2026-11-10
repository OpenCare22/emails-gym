// "Find a program for me" (master plan §5): fixed, explainable rules, no AI. Hard filters first,
// then a score made of product weights (not science, versioned so a change is visible), up to
// three matches with the reasons they fit and what they don't. Zero matches is a valid answer: the
// screen says so instead of offering the nearest wrong plan.
//
//   answers = { goal, level, days, minutes, equipment, cardio, health }
//     goal      'muscle' | 'strength' | 'general' | 'hybrid' | 'endurance' | 'efficient'
//     level     'beginner' | 'intermediate' | 'advanced'
//     days      2 | 3 | 4 | 5 (5 means 5 or more)
//     minutes   30 | 45 | 60 | 90 (90 means 90 or more)
//     equipment 'gym' | 'dumbbells' | 'none', or the catalogue equipment list of the user's gym profile
//     cardio    'much' | 'some' | 'little'
//     health    true when an injury, a condition or a doctor's advice limits exercise
//
// Nothing here is stored: the answers live in the screen and go when it closes.
import { isVisible } from './library.js'
import { t } from './i18n-core.js'

export const MATCH_VERSION = 1
export const WEIGHTS = { goal: 40, relatedGoal: 20, days: 25, minutes: 15, level: 15, cardio: 5 }

// Goals close enough that a program for one still serves the other, with a compromise said out
// loud. Anything not listed is a different goal and is excluded.
export const RELATED_GOALS = {
  muscle: ['efficient', 'strength', 'general'],
  strength: ['efficient', 'muscle', 'general'],
  general: ['muscle', 'strength', 'efficient', 'hybrid'],
  hybrid: ['endurance', 'general'],
  endurance: ['hybrid'],
  efficient: ['muscle', 'strength', 'general'],
}

const EQUIPMENT = { dumbbells: ['dumbbell', 'body weight'], none: ['body weight'] }
const LONGEST_TIME = 90
const OVER_TIME = 10

export const goalName = goal => ({
  muscle: t('muscle growth'), strength: t('strength'), general: t('general fitness'),
  hybrid: t('strength and cardio'), endurance: t('cardio fitness'), efficient: t('short sessions'),
})[goal] || goal

const hasCardio = p => p.templates.some(tp => tp.items.some(i => i.mode === 'cardio'))
const levelFits = (p, level) => p.level.includes('any') || p.level.includes(level)

/** Why a program is ruled out for these answers, or [] when it is eligible. */
export function exclusions(p, a) {
  const out = []
  const days = Math.min(5, Number(a.days) || 0)
  if (p.days > days) out.push(t('Needs {0} days a week, you have {1}', p.days, days))
  const allowed = Array.isArray(a.equipment) ? [...a.equipment, 'body weight'] : EQUIPMENT[a.equipment]
  if (allowed) {
    const missing = p.equipment.filter(e => !allowed.includes(e))
    if (missing.length) out.push(t('Needs equipment you don’t have: {0}', missing.join(', ')))
  }
  if (a.minutes < LONGEST_TIME && p.minutes[1] > a.minutes + OVER_TIME) out.push(t('Sessions up to about {0} min, more than your {1}', p.minutes[1], a.minutes))
  if (a.level === 'beginner' && !levelFits(p, 'beginner')) out.push(t('Made for people with more training experience'))
  if (p.goal !== a.goal && !(RELATED_GOALS[a.goal] || []).includes(p.goal)) out.push(t('Built for {0}, not {1}', goalName(p.goal), goalName(a.goal)))
  return out
}

function scoreOf(p, a) {
  const why = [], compromises = []
  let score = 0
  if (p.goal === a.goal) { score += WEIGHTS.goal; why.push(t('Built for {0}', goalName(a.goal))) }
  else { score += WEIGHTS.relatedGoal; compromises.push(t('Built for {0}, which also helps with {1}', goalName(p.goal), goalName(a.goal))) }
  const days = Math.min(5, Number(a.days) || 0)
  if (p.days === days) { score += WEIGHTS.days; why.push(t('{0} days a week, as you asked', p.days)) }
  else compromises.push(t('{0} days a week instead of the {1} you have', p.days, days))
  if (a.minutes >= LONGEST_TIME || p.minutes[1] <= a.minutes) { score += WEIGHTS.minutes; why.push(t('Sessions about {0} to {1} min', p.minutes[0], p.minutes[1])) }
  else compromises.push(t('Longest session about {0} min, a bit over your {1}', p.minutes[1], a.minutes))
  const exact = a.level === 'advanced' ? levelFits(p, 'intermediate') && !p.level.includes('beginner') : levelFits(p, a.level)
  if (exact) { score += WEIGHTS.level; why.push(t('Fits your experience')) }
  else compromises.push(a.level === 'beginner' ? t('Made for more experienced lifters') : t('Gentler than your experience needs'))
  const cardio = hasCardio(p)
  if (a.cardio === 'much' && (p.goal === 'hybrid' || p.goal === 'endurance')) { score += WEIGHTS.cardio; why.push(t('Plenty of cardio')) }
  else if (a.cardio === 'little' && !cardio) { score += WEIGHTS.cardio; why.push(t('No cardio sessions')) }
  else if (a.cardio === 'little' && cardio) compromises.push(t('Includes cardio sessions'))
  else if (a.cardio === 'much' && !cardio) compromises.push(t('No cardio sessions'))
  return { score, why, compromises }
}

/** Up to three programs for these answers, best first. The same answers always give the same result. */
export function matchPrograms(answers, programs) {
  const a = answers || {}
  if (a.health === true) return { version: MATCH_VERSION, matches: [], excluded: [], advice: 'professional' }
  const matches = [], excluded = []
  for (const p of programs || []) {
    if (!isVisible(p, p.review)) continue
    const reasons = exclusions(p, a)
    if (reasons.length) { excluded.push({ program: p, reasons }); continue }
    matches.push({ program: p, ...scoreOf(p, a) })
  }
  matches.sort((x, y) => y.score - x.score || x.program.days - y.program.days || (x.program.id < y.program.id ? -1 : 1))
  return { version: MATCH_VERSION, matches: matches.slice(0, 3), excluded, advice: null }
}
