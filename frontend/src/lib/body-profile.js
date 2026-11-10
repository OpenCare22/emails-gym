// Body details for Build my plan, and later for nutrition (docs/superpowers/specs/2026-11-10-plan-builder-design.md,
// "Data and privacy"): S.body = { heightCm, birthYear, sex }, one plain setting synced to the person's own
// account only. Weight is not here: it lives in the weigh-ins (S.bodyweight), in the profile's unit.
import { LB_KG } from './units.js'

const SEXES = ['female', 'male', 'none']
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN)

export const heightFromImperial = (ft, inch = 0) => Math.round(((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 2.54 * 10) / 10
export const imperialFromCm = cm => { const total = Math.round((Number(cm) || 0) / 2.54); return { ft: Math.floor(total / 12), inch: total % 12 } }
export const kgFromLb = lb => Math.round((Number(lb) || 0) * LB_KG * 100) / 100

/** The body details, or null when none were given. */
export function bodyOf(S) {
  const b = S?.body
  if (!b || typeof b !== 'object') return null
  return { heightCm: b.heightCm ?? null, birthYear: b.birthYear ?? null, sex: b.sex ?? null }
}

/** Saves what is valid on a store draft; anything out of range is left out. */
export function setBody(S, { heightCm, birthYear, sex } = {}, now = new Date()) {
  const out = { ...(bodyOf(S) || {}) }
  const h = num(heightCm)
  if (h >= 120 && h <= 230) out.heightCm = Math.round(h * 10) / 10
  const y = num(birthYear)
  if (Number.isInteger(y) && y >= 1920 && y <= now.getFullYear() - 13) out.birthYear = y
  if (SEXES.includes(sex)) out.sex = sex
  S.body = Object.keys(out).length ? out : null
  return S.body
}

export const ageOf = (body, now = new Date()) => (body?.birthYear ? now.getFullYear() - body.birthYear : null)

/** The latest weigh-in in kg, or null. */
export function latestWeightKg(S) {
  const days = Array.isArray(S?.bodyweight) ? S.bodyweight.filter(e => e && Number(e.w) > 0) : []
  if (!days.length) return null
  const last = days.reduce((a, b) => (a.d >= b.d ? a : b))
  return S.unit === 'lb' ? kgFromLb(last.w) : Number(last.w)
}
