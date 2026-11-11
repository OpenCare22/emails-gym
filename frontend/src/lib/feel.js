import { rirOf } from './effort.js'
import { isWarmupRow } from './workout-model.js'
import { exerciseOf } from './exercises.js'

export const FEELS = ['easy', 'good', 'hard']

export function feelOf(entry) {
  if (FEELS.includes(entry?.feel)) return entry.feel
  const last = (entry?.sets || []).filter(s => s.done && !isWarmupRow(s)).at(-1)
  // A planned failure set is not a logged rating. Keep old AMRAP progression unchanged.
  if (last?.rir == null && last?.rpe == null) return null
  const rir = rirOf(last)
  return rir == null ? null : rir >= 3 ? 'easy' : rir > 0 ? 'good' : 'hard'
}

export function isLowerBody(idOrCfg) {
  const ex = exerciseOf(idOrCfg?.id || idOrCfg)
  return ['upper legs', 'lower legs', 'hips', 'glutes'].includes(ex?.bp)
    || ['glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves'].includes(ex?.tg?.toLowerCase())
}

export const doubleStepFits = (idOrCfg, weight, jump) =>
  weight > 0 && jump <= weight * (isLowerBody(idOrCfg) ? 0.07 : 0.05) + 1e-9
