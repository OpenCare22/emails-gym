// The exercise index (EG Plan Model, docs/superpowers/specs/2026-11-10-plan-builder-design.md): our
// own attributes over the catalogue, which records target, secondary muscles, body part, equipment
// and category but not the movement pattern, whether a lift is a compound, how much skill it takes,
// or whether it is a standard exercise or one of its many odd variants. The plan builder reads
// these to fill a session's slots. Pure rules here; scripts/plan-model/index.mjs runs them over the
// catalogue with the hand-kept core list and overrides (library/exercise-index/) and writes
// exercise-index-data.js. Built from the catalogue's JSON only, never its media.
//
//   Entry = { id, pattern, compound, skill: 1 | 2 | 3, tier: 'core' | 'common' | 'variant' | 'excluded',
//             stress: area[], eq, hold? }  (hold: a timed exercise, logged in seconds)

export const PATTERNS = ['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull', 'hipext', 'kneeflex',
  'kneeext', 'calf', 'curl', 'triext', 'latraise', 'reardelt', 'fly', 'core', 'corerot', 'carry']
export const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull'])
export const STRESS_AREAS = ['knee', 'shoulder', 'lowerback', 'wrist', 'neck']

const EXCLUDED_CATEGORIES = new Set(['stretching', 'mobility', 'yoga', 'pilates', 'rehab', 'combat', 'cardio'])
const MACHINES = new Set(['leverage machine', 'smith machine', 'sled machine', 'cable', 'assisted', 'stationary bike', 'elliptical machine', 'stepmill machine', 'skierg machine', 'upper body ergometer'])
const FREE_COMPLEX = new Set(['barbell', 'ez barbell', 'trap bar', 'olympic barbell', 'kettlebell'])
const has = (name, ...words) => words.some(w => name.includes(w))

// A name that marks a variant of a standard exercise: a numbered version, a camera angle, one side,
// a demonstration detail, or a combination of two movements.
const VARIANT = / v\. ?\d|pov|\((left|right)\)|\bleft\b|\bright\b| with | to | and |\bon (a |an )?(stability|bosu|exercise) ball|bosu|stability ball|suspender|suspension|towel|bed sheet|bottle|chair|wall\b/
// Names nobody would want as a main lift in a plan.
const ODD = /jump|hop|sprint|burpee|clap|plyo|explosive|isometric hold|quarter|partial|pulse|march|walkout|inchworm|crawl|cossack|sissy|nordic|pistol|dragon|human flag|muscle up|handstand|one arm push|archer|typewriter|tempo|pause|deficit|snatch|clean|jerk|kipping/

export function patternOf(ex) {
  const n = String(ex.name || '').toLowerCase()
  const target = ex.target || '', part = ex.bodyPart || ''
  if (ex.category === 'cardio' || part === 'cardio') return null
  if (has(n, 'carry', 'farmer')) return 'carry'
  if (has(n, 'pallof', 'woodchop', 'wood chop', 'russian twist', 'rotation', 'landmine twist')) return 'corerot'
  if (has(n, 'plank', 'dead bug', 'ab wheel', 'rollout', 'hollow')) return 'core'
  if (target === 'abs' && has(n, 'crunch', 'leg raise', 'knee raise', 'sit up', 'sit-up')) return 'core'
  if (has(n, 'calf')) return 'calf'
  if (has(n, 'hip thrust', 'glute bridge', 'hip extension', 'kickback') && target === 'glutes') return 'hipext'
  if (has(n, 'leg curl', 'hamstring curl')) return 'kneeflex'
  if (has(n, 'leg extension')) return 'kneeext'
  if (has(n, 'lunge', 'split squat', 'step up', 'step-up', 'bulgarian')) return 'lunge'
  if (has(n, 'deadlift', 'romanian', 'good morning', 'rdl', 'rack pull')) return 'hinge'
  if (has(n, 'squat', 'leg press', 'hack')) return 'squat'
  if (has(n, 'pulldown', 'pull-down', 'pull up', 'pull-up', 'pullup', 'chin up', 'chin-up', 'chinup')) return 'vpull'
  if (has(n, 'face pull', 'rear delt', 'reverse fly', 'rear fly')) return 'reardelt'
  if (has(n, 'row') && !has(n, 'upright')) return 'hpull'
  if (has(n, 'lateral raise', 'side raise')) return 'latraise'
  if (has(n, 'fly', 'crossover', 'pec deck') && target === 'pectorals') return 'fly'
  if (target === 'pectorals' && has(n, 'press', 'push-up', 'push up', 'pushup', 'dip')) return 'hpush'
  if (has(n, 'overhead press', 'military press', 'shoulder press', 'arnold press', 'push press') || (target === 'delts' && has(n, 'press'))) return 'vpush'
  if (target === 'biceps' && has(n, 'curl')) return 'curl'
  if (target === 'triceps' && has(n, 'extension', 'pushdown', 'push down', 'skull', 'kickback', 'dip', 'close grip', 'press')) return 'triext'
  return null
}

export function stressOf(ex, pattern) {
  const n = String(ex.name || '').toLowerCase()
  const out = new Set()
  if (['squat', 'lunge', 'kneeext'].includes(pattern) || has(n, 'jump', 'deep squat')) out.add('knee')
  if (pattern === 'hinge' && !has(n, 'hip thrust')) out.add('lowerback')
  if (pattern === 'squat' && (ex.equipment === 'barbell' || has(n, 'good morning'))) out.add('lowerback')
  if (pattern === 'hpull' && has(n, 'bent over', 'pendlay', 't-bar') && !has(n, 'chest supported', 'supported')) out.add('lowerback')
  if (pattern === 'vpush' || has(n, 'dip', 'upright row', 'behind neck', 'behind the neck')) out.add('shoulder')
  if (pattern === 'hpush' && ex.equipment === 'barbell') out.add('shoulder')
  if (has(n, 'behind neck', 'behind the neck', 'neck')) out.add('neck')
  if (has(n, 'push-up', 'push up', 'pushup', 'front squat', 'wrist') || (pattern === 'core' && has(n, 'plank'))) out.add('wrist')
  return [...out]
}

export function skillOf(ex, pattern) {
  // A cable moves freely like a dumbbell; the rest of the machines guide the movement.
  if (ex.equipment === 'cable') return 2
  if (MACHINES.has(ex.equipment)) return 1
  if (FREE_COMPLEX.has(ex.equipment) && COMPOUND_PATTERNS.has(pattern)) return 3
  if (ex.equipment === 'body weight' && (pattern === 'vpull' || /dip|pistol/.test(ex.name))) return 3
  if (ex.equipment === 'body weight') return pattern === 'lunge' ? 2 : 1
  return 2
}

export function classify(ex, { core = {}, overrides = {} } = {}) {
  const n = String(ex.name || '').toLowerCase()
  const o = overrides[ex.id] || {}
  const pattern = o.pattern !== undefined ? o.pattern : core[ex.id] || patternOf(ex)
  let tier
  // The core list wins: it holds the plain holds (a plank) and calisthenics a plan needs.
  if (core[ex.id]) tier = 'core'
  else if (!pattern || EXCLUDED_CATEGORIES.has(ex.category)) tier = 'excluded'
  else if (ex.hold) tier = pattern === 'core' ? 'variant' : 'excluded'
  else if (VARIANT.test(n) || ODD.test(n) || ex.category === 'plyometrics' || ex.category === 'olympic') tier = 'variant'
  else tier = 'common'
  if (o.tier) tier = o.tier
  const compound = o.compound !== undefined ? o.compound
    : COMPOUND_PATTERNS.has(pattern) || (pattern === 'carry')
  return {
    id: ex.id, pattern: pattern || null, compound: !!compound,
    skill: o.skill || skillOf(ex, pattern), tier,
    stress: o.stress || stressOf(ex, pattern), eq: ex.equipment,
    ...(ex.hold ? { hold: true } : {}),
  }
}
