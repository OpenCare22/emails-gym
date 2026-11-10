// The person, as the EG Plan Model sees them (docs/superpowers/specs/2026-11-10-plan-builder-design.md,
// "The person"): the questionnaire's answers turned into a small profile, each value with the reason
// the plan's rationale will repeat. Pure; nothing here is stored.
//
//   answers = { goal: 'muscle'|'recomp'|'gain'|'strength'|'general'|'hybrid', heightCm, weightKg, age,
//     sex: 'female'|'male'|'none', trained: 'never'|'under6m'|'6m2y'|'over2y',
//     pushups: '0'|'1-10'|'11-25'|'25+', squats: '0-10'|'11-30'|'30+', barbell: boolean,
//     days: 2..5, minutes: 30|45|60|90, equipment: 'gym'|'dumbbells'|'none'|string[],
//     focus: string[], avoid: string[], health: boolean }
import { t } from './i18n-core.js'

export const GOALS = ['muscle', 'recomp', 'gain', 'strength', 'general', 'hybrid']
export const FOCUS_AREAS = ['chest', 'back', 'shoulders', 'arms', 'glutes', 'legs', 'core']
export const AVOID_AREAS = ['knee', 'shoulder', 'lowerback', 'wrist', 'neck']
export const FEMALE_FOCUS = ['glutes', 'legs']

const EMPHASIS = { muscle: 'hypertrophy', recomp: 'recomp', gain: 'gain', strength: 'strength', general: 'general', hybrid: 'hybrid' }
const LEVEL_OF = { never: 'novice', under6m: 'novice', '6m2y': 'intermediate', over2y: 'advanced' }

export function bmiOf(heightCm, weightKg) {
  const h = Number(heightCm) / 100, w = Number(weightKg)
  return h > 0 && w > 0 ? w / (h * h) : null
}

export function bmiBandOf(bmi) {
  if (bmi == null) return null
  return bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : bmi < 30 ? 'over' : 'obese'
}

const strongChecks = a => ['11-25', '25+'].includes(a.pushups) && ['11-30', '30+'].includes(a.squats)

export function personOf(answers = {}) {
  const a = answers
  const reasons = []
  const why = (rule, text) => reasons.push({ rule, text })

  let level = LEVEL_OF[a.trained] || 'novice'
  if (a.trained === 'under6m' && strongChecks(a) && a.barbell) {
    level = 'intermediate'
    why('level-ability', t('You have trained only a few months but your push-ups, squats and barbell experience put you past the beginner stage, so the plan starts at intermediate.'))
  } else if (a.trained === 'never' && strongChecks(a)) {
    why('level-ability', t('You are new to the gym but already strong for your body weight, so the first weeks start a little above a beginner’s.'))
  } else {
    why('level', { novice: t('You are new to regular training, so the plan builds technique and confidence first.'),
      intermediate: t('You have trained regularly for a while, so the plan uses more sets and works closer to your limit.'),
      advanced: t('You have trained for years, so the plan uses higher volume and more targeted work.') }[level])
  }

  const bmi = bmiOf(a.heightCm, a.weightKg)
  const bmiBand = bmiBandOf(bmi)
  const emphasis = EMPHASIS[a.goal] || 'general'
  if (bmi != null && bmi < 20 && emphasis === 'gain') why('body-lean', t('You are lean for your height and want to gain, so the plan leans on big compound lifts that add the most muscle.'))
  if (bmi != null && bmi >= 25 && (emphasis === 'recomp' || emphasis === 'general')) why('body-cardio', t('To help with fat loss, the plan keeps the heavy lifting, which protects your muscle while you lose fat.'))

  const older = Number(a.age) >= 50
  if (older) why('age', t('Past 50, recovery takes a little longer, so the first two weeks use one set fewer and the big lifts get longer rests.'))

  const sex = a.sex === 'female' || a.sex === 'male' ? a.sex : null
  let focus = (Array.isArray(a.focus) ? a.focus : []).filter(f => FOCUS_AREAS.includes(f))
  if (!focus.length && sex === 'female') {
    focus = [...FEMALE_FOCUS]
    why('sex-emphasis', t('With no focus picked, the plan gives glutes and legs a little extra, which most women ask for. Pick your own focus to change it.'))
  }
  if (sex === 'female') why('sex-rest', t('Women tend to recover faster between sets at the same effort, so the smaller exercises use shorter rests.'))

  const avoid = (Array.isArray(a.avoid) ? a.avoid : []).filter(x => AVOID_AREAS.includes(x))
  const days = Math.max(2, Math.min(5, Number(a.days) || 3))
  const minutes = [30, 45, 60, 90].includes(Number(a.minutes)) ? Number(a.minutes) : 60
  const equipment = Array.isArray(a.equipment) ? a.equipment : ['gym', 'dumbbells', 'none'].includes(a.equipment) ? a.equipment : 'gym'

  return { level, bmiBand, older, sex, emphasis, focus, avoid, days, minutes, equipment, reasons }
}
