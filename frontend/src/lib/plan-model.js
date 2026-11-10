// EG Plan Model v1: the rule tables, in one file for the coach to read and change
// (docs/superpowers/specs/2026-11-10-plan-builder-design.md, "The plan rules"). Numbers come from
// the research Emil supplied (docs/emails-gym-planning/research, B and D) and are product defaults,
// not validated physiological constants. Each rule carries the sentence the plan's rationale shows.
// plan-build.js applies them; nothing here runs on its own.
import { t } from './i18n-core.js'

export const MODEL = { name: 'EG Plan Model', version: 1 }

export const SOURCES = {
  acsm: 'ACSM position stand on resistance training, 2026 (Currier et al.)',
  pelland: 'Resistance training volume and frequency, 2026 (Pelland et al.)',
  rir: 'Proximity to failure, 2024 (Robinson et al.)',
  rest: 'Rest intervals, 2024 (Singer et al.)',
  who: 'WHO physical activity guidelines, 2020',
}

// Ordered pattern slots per session type. main = a compound that leads; accessory = after it.
const M = (pattern) => ({ pattern, role: 'main' })
const A = (pattern) => ({ pattern, role: 'accessory' })
export const SESSIONS = {
  full_a: { name: () => t('Full body A'), slots: [M('squat'), M('hpush'), M('hpull'), A('hipext'), A('latraise'), A('core')] },
  full_b: { name: () => t('Full body B'), slots: [M('hinge'), M('vpush'), M('vpull'), A('hpush'), A('lunge'), A('curl')] },
  full_c: { name: () => t('Full body C'), slots: [M('squat'), M('hpush'), M('hpull'), A('kneeflex'), A('reardelt'), A('corerot')] },
  upper_a: { name: () => t('Upper A'), slots: [M('hpush'), M('hpull'), M('vpush'), M('vpull'), A('latraise'), A('curl'), A('triext')] },
  upper_b: { name: () => t('Upper B'), slots: [M('vpull'), M('hpush'), M('hpull'), M('vpush'), A('fly'), A('reardelt'), A('triext'), A('curl')] },
  lower_a: { name: () => t('Lower A'), slots: [M('squat'), M('hinge'), A('lunge'), A('kneeflex'), A('calf'), A('core')] },
  lower_b: { name: () => t('Lower B'), slots: [M('hinge'), M('squat'), A('hipext'), A('kneeext'), A('calf'), A('corerot')] },
  push: { name: () => t('Push'), slots: [M('hpush'), M('vpush'), A('hpush'), A('latraise'), A('fly'), A('triext')] },
  pull: { name: () => t('Pull'), slots: [M('vpull'), M('hpull'), A('hpull'), A('reardelt'), A('curl'), A('curl')] },
  legs: { name: () => t('Legs'), slots: [M('squat'), M('hinge'), A('lunge'), A('kneeflex'), A('kneeext'), A('calf')] },
}

// Split by days, then by level. Every muscle at least twice a week (research B).
export const SPLITS = {
  2: { novice: ['full_a', 'full_b'], intermediate: ['full_a', 'full_b'], advanced: ['full_a', 'full_b'] },
  3: { novice: ['full_a', 'full_b', 'full_c'], intermediate: ['upper_a', 'lower_a', 'full_b'], advanced: ['upper_a', 'lower_a', 'full_b'] },
  4: { novice: ['upper_a', 'lower_a', 'upper_b', 'lower_b'], intermediate: ['upper_a', 'lower_a', 'upper_b', 'lower_b'], advanced: ['upper_a', 'lower_a', 'upper_b', 'lower_b'] },
  5: { novice: ['upper_a', 'lower_a', 'full_a', 'upper_b', 'lower_b'], intermediate: ['upper_a', 'lower_a', 'push', 'pull', 'legs'], advanced: ['upper_a', 'lower_a', 'push', 'pull', 'legs'] },
}
// Library day numbers (1 Monday to 7 Sunday) for each count of days, with rest between when possible.
export const WEEKDAYS = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6] }

export const splitReason = (days, level, types) => {
  if (types.every(x => x.startsWith('full'))) return t('{0} full-body days: every muscle gets trained {1} times a week with a few sets each time, which suits {2} and builds the main lifts fastest.', days, days, level === 'novice' ? t('someone new to training') : t('your schedule'))
  if (types.includes('push')) return t('Upper, lower, push, pull and legs: five days lets each session focus on fewer muscles with more sets, while everything is still trained twice a week.')
  return t('An upper and lower split: each muscle is trained twice a week, and each session has room for both heavy lifts and smaller exercises.')
}

// Weekly hard sets per muscle group by level (diminishing returns past these, Pelland 2026).
export const WEEKLY_SETS = { novice: [6, 10], intermediate: [10, 16], advanced: [12, 20] }
// Sets per exercise in a full week, before week-by-week changes.
export const SETS = { novice: { main: 3, accessory: 2 }, intermediate: { main: 3, accessory: 3 }, advanced: { main: 4, accessory: 3 } }
export const MAX_SETS = 4

export const ISOLATION = new Set(['curl', 'triext', 'latraise', 'reardelt', 'fly', 'calf', 'kneeext', 'kneeflex', 'hipext'])
// Rep ranges by emphasis: [main lifts, compound accessories, isolation].
export const REPS = {
  strength: { main: [3, 6], accessory: [6, 10], isolation: [8, 12] },
  hypertrophy: { main: [6, 10], accessory: [8, 12], isolation: [10, 15] },
  recomp: { main: [6, 10], accessory: [8, 12], isolation: [10, 15] },
  gain: { main: [6, 10], accessory: [8, 12], isolation: [10, 15] },
  general: { main: [8, 12], accessory: [8, 12], isolation: [10, 15] },
  hybrid: { main: [5, 8], accessory: [8, 12], isolation: [10, 15] },
}
export const NOVICE_STRENGTH_MAIN = [5, 8]
export const HOLD_SECONDS = { novice: [20, 40], intermediate: [30, 60], advanced: [30, 60] }
export const CORE_REPS = [10, 15]

export const repsReason = emphasis => ({
  strength: t('Heavy sets of 3 to 6 on the main lifts train strength most directly; lighter accessory work keeps the rest of you strong and healthy.'),
  hypertrophy: t('6 to 10 reps on the big lifts and 10 to 15 on smaller exercises: all of these build muscle when taken close to your limit.'),
  recomp: t('Moderate reps close to your limit keep and build muscle while you lose fat.'),
  gain: t('6 to 10 reps on big compound lifts add the most muscle and weight for the time you spend.'),
  general: t('8 to 12 reps throughout: enough load to get stronger, enough reps to practise good form.'),
  hybrid: t('Lower reps on the main lifts keep strength up while the cardio builds your fitness.'),
})[emphasis]

// Reps in reserve (RIR) by phase. Weeks 1 to 2 are the baseline, 3 to 7 the full block, 8 lighter.
export const RIR = {
  start: { novice: { main: 3, accessory: 4 }, intermediate: { main: 3, accessory: 2 }, advanced: { main: 2, accessory: 2 } },
  block: { novice: { main: 2, accessory: 2 }, intermediate: { main: 2, accessory: 1 }, advanced: { main: 2, accessory: 1 } },
  strengthMain: 2,
  lighter: 1, // added in week 8
}
export const rirReason = level => (level === 'novice'
  ? t('The first two weeks stop 3 to 4 reps short of your limit while you learn the lifts; from week 3 you work about 2 reps short.')
  : t('After two easier weeks you work 1 to 2 reps short of your limit, close enough to build muscle without grinding every set.'))

// Rest in seconds (research B: 2 to 4 min for demanding lifts, 60 to 120 s for stable isolation work).
export const REST = { main: 150, strengthMain: 180, accessory: 120, isolation: 75, femaleIsolation: 60, extraForOlder: 30 }
export const restReason = () => t('Longer rests on the big lifts (about 2 to 3 minutes) protect the quality of the next set; smaller exercises need about a minute.')

// The 8 weeks: which sets change. Novices and over-50s start one set lower in weeks 1 to 2.
export const WEEKS = 8
export const weekNote = w => (w <= 2 ? t('Baseline week: learn the lifts, find your weights.') : w === 8 ? t('Lighter week: one set fewer and easier, to recover before the next block.') : t('Full week: add a rep or a little weight when every set reaches the top of the range.'))
export const weeksReason = () => t('Eight weeks: two easier weeks to find your weights, five full weeks where the app moves your weights up as you hit the top of the rep range, and a lighter last week.')

// Cardio for fat loss and for strength-and-cardio (research B, WHO 2020).
export const CARDIO = { ex: '3004', min: 20, hybridMin: 25, sessions: 2 }
export const cardioReason = kind => (kind === 'sessions'
  ? t('Two easy 20 to 25 minute cardio blocks a week help with fat loss and heart health without hurting recovery.')
  : t('There is no time left in the sessions for cardio, so aim for 8,000 to 10,000 steps a day instead.'))

// Scoring an exercise for a slot (product weights, not science).
export const WEIGHTS = { core: 30, common: 10, variant: 0, compound: 15, skillFit: 10, familiar: 10, favourite: 10, repeatEquipPattern: -20, repeatInSession: -40, jitter: 4 }
// Equipment preference when everything is available: free weights and machines over bands and body weight.
export const GYM_PREFERENCE = { barbell: 5, dumbbell: 5, cable: 5, 'leverage machine': 5, 'sled machine': 5, 'smith machine': 2, 'trap bar': 3, 'ez barbell': 3, 'body weight': -5, weighted: -5, kettlebell: -5, band: -15, 'resistance band': -15 }
export const SKILL_OF_LEVEL = { novice: 1, intermediate: 2, advanced: 3 }

// What each focus area adds: one accessory slot of this pattern per week, placed in the first
// session that trains that region.
// A novice gaining weight or strength keeps at most this many isolation exercises per session.
export const NOVICE_COMPOUND_ISOLATION_CAP = 1

export const FOCUS_SLOTS = { chest: 'fly', back: 'hpull', shoulders: 'latraise', arms: 'curl', glutes: 'hipext', legs: 'lunge', core: 'core' }
export const focusReason = focus => t('Extra work for {0}, as you asked.', focus.join(', '))

// Muscle groups each pattern trains, for weekly volume and for "each muscle twice a week".
export const MUSCLES = {
  squat: ['legs'], hinge: ['legs', 'back'], lunge: ['legs'], hpush: ['chest'], vpush: ['shoulders'], hpull: ['back'], vpull: ['back'],
  hipext: ['legs'], kneeflex: ['legs'], kneeext: ['legs'], calf: ['legs'], curl: ['arms'], triext: ['arms'], latraise: ['shoulders'],
  reardelt: ['shoulders'], fly: ['chest'], core: ['core'], corerot: ['core'], carry: ['core'],
}
export const SESSION_GAP_MIN = 5 // the time estimate may run this far over before slots are cut
export const timeReason = minutes => t('To fit {0} minutes, the plan keeps the most useful exercises and drops the extras.', minutes)
export const bodyweightReason = () => t('With no equipment, the plan uses body-weight versions of the main lifts; strength grows by adding reps and harder variations rather than weight.')
export const disclaimer = () => t('Built from published training research by the EG Plan Model. Not medical advice.')
