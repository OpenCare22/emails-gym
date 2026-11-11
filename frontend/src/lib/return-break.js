import { sessionsFor, snapWeight, addStep, weightIncrement } from './progression.js'
import { modeOf, isBw } from './history.js'
import { isAssisted, isLoadedEq } from './exercises.js'
import { ownedWeightsFor } from './dumbbells.js'

// This switch lets tests about other features stay independent of today's date. It lives on
// globalThis so the shared test setup can turn it off without importing this module (and with it
// exercises.js) before a test has stubbed its build env.
const EASING_KEY = '__egReturnEasingOff'
export function setReturnEasing(on) {
  globalThis[EASING_KEY] = !on
}
const returnEasingOn = () => !globalThis[EASING_KEY]

export const BREAK_MIN_DAYS = 8
export const BREAK_RATIO = 1.5
export const DEFAULT_USUAL_GAP = 7

export const daysBetween = (fromIso, toIso) => Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000)

export function breakGap(st, exId, today) {
  const dates = [...new Set(sessionsFor(st, exId, undefined, null).map(s => s.d).filter(d => d < today))].sort().slice(-5)
  if (!dates.length) return null
  const days = daysBetween(dates.at(-1), today)
  const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const usual = gaps.length < 2 ? DEFAULT_USUAL_GAP : gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
  return days >= BREAK_MIN_DAYS && days >= BREAK_RATIO * usual ? { days, usual } : null
}

export const tierOf = days => days <= 14 ? 'short' : days <= 28 ? 'medium' : 'long'

export const RUNGS = {
  short: [{ drop: 1, factor: 1, help: 0 }],
  medium: [{ drop: 1, factor: 0.9, help: 1 }],
  long: [{ drop: 1, factor: 0.8, help: 2 }, { drop: 0, factor: 0.9, help: 1 }],
}

// The baseline is the work logged, not the progression step it earned.
function fromSession(session, mode) {
  return {
    weight: session.weight,
    sets: session.target?.sets || (session.reps || session.held).length,
    ...(mode === 'time' ? { sec: session.goal } : { reps: session.goal }),
    ...(session.target?.rowReps ? { rowReps: [...session.target.rowReps] } : {}),
  }
}

export function easeForReturn(st, cfg, routine, plan, { today, person } = {}) {
  // Sex and age are reserved inputs; v1 uses the same thresholds for everyone.
  const unchanged = { plan, back: null }
  if (!returnEasingOn()) return unchanged
  const mode = modeOf(cfg)
  if (['off', 'first'].includes(plan.kind) || mode === 'cardio' || plan.prog?.deload) return unchanged
  const line = sessionsFor(st, cfg.id, cfg, routine?.id)
  const last = line.at(-1)
  const gap = breakGap(st, cfg.id, today)
  const ongoing = last?.back && !(last.back.repeat && !last.ok)
  if (!gap && !ongoing) return unchanged

  let from, days, tier, step, repeat
  if (ongoing) {
    from = last.back.from
    days = gap?.days ?? last.back.days
    tier = gap ? tierOf(days) : last.back.tier
    step = gap ? 1 : !last.ok && !last.back.repeat ? last.back.step : last.back.step + 1
    repeat = !gap && !last.ok && !last.back.repeat
  } else {
    const baseline = line.filter(s => !s.back).at(-1)
    if (!baseline) return unchanged
    from = fromSession(baseline, mode)
    days = gap.days
    tier = tierOf(days)
    step = 1
  }
  // The programme calendar keeps moving throughout the ramp, including the full-weight hold.
  if (plan.kind === 'programme') from = {
    ...from,
    weight: plan.weight ?? cfg.weight ?? from.weight,
    sets: plan.sets ?? cfg.sets ?? from.sets,
    ...(mode === 'time' ? { sec: plan.sec ?? cfg.sec ?? from.sec } : { reps: plan.reps ?? cfg.reps ?? from.reps }),
    rowReps: plan.rowReps,
  }
  const rung = RUNGS[tier][step - 1]
  if (!rung) {
    if (tier === 'short' || plan.kind === 'deload') return unchanged
    return { plan: { ...plan, ...from, kind: 'return', why: ['Back to your usual weights today.'] }, back: null }
  }
  if (tier === 'short' && plan.kind === 'deload') return unchanged

  const inc = weightIncrement(cfg, st.unit || 'kg')
  const assisted = isAssisted(cfg)
  let weight = from.weight
  let reps = from.reps
  let sec = from.sec
  const sets = Math.max(1, from.sets - rung.drop)
  const rowReps = from.rowReps?.slice(0, sets)
  if (rung.factor !== 1) {
    if (assisted) weight = addStep(from.weight, rung.help * inc, inc)
    else {
      const ideal = from.weight * rung.factor
      const owned = ownedWeightsFor(st, cfg)
      weight = owned ? (owned.filter(w => w <= ideal + 1e-9).at(-1) ?? owned[0])
        : snapWeight(Math.floor(ideal / inc + 1e-9) * inc, inc)
    }
    if (mode === 'reps' && from.weight === 0 && (isBw(cfg) || !isLoadedEq(cfg.id) || assisted)) reps = Math.max(1, Math.floor(from.reps * rung.factor))
    if (mode === 'time') sec = Math.max(5, Math.floor(from.sec * rung.factor / 5) * 5)
  }
  if (plan.kind === 'deload' && plan.weight != null) weight = assisted ? Math.max(plan.weight, weight) : Math.min(plan.weight, weight)
  const unit = st.unit || 'kg'
  const why = tier === 'short' ? ['Back after {0} days: one set fewer today.', days]
    : step === 1 ? ['Back after {0} weeks: one set fewer and {1} {2} today.', Math.round(days / 7), weight, unit]
      : ['Easing back in: full sets at {0} {1}, then your usual weights.', weight, unit]
  return {
    plan: { ...plan, kind: 'return', weight, reps, sec, sets, rowReps, why },
    back: { days, tier, step, from, ...(repeat ? { repeat: true } : {}) },
  }
}
