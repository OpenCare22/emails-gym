// Home's "Your progress" card (docs/superpowers/specs/2026-11-12-full-mode-wayfinding-design.md):
// the last 28 days at a glance. How many workouts, how many records, and the three exercises you
// train most with the heaviest weight lifted on each and how far it moved against the 28 days
// before. Only sets logged with a weight count (a reps set, done, weight above zero, not a
// warm-up): a plank's seconds or a push-up's reps have no kilos to compare.
import { isWarmupRow } from './workout-model.js'
import { exUnitOf, shownWeight } from './ex-unit.js'

const WINDOW = 28
const RANK_WINDOW = 56
const TOP = 3

const daysBefore = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The heaviest weighted work set of one entry, or 0.
function heaviest(entry) {
  let best = 0
  for (const s of entry?.sets || []) {
    if (!s || !s.done || isWarmupRow(s) || s.sec != null || s.min != null) continue
    const w = Number(s.w)
    if (Number.isFinite(w) && w > best) best = w
  }
  return best
}

/** { workouts, records, lifts: [{ id, best, prev, delta, unit }] } for the 28 days ending `today`. */
export function homeProgress(S, today) {
  const from = daysBefore(today, WINDOW - 1)
  const prevFrom = daysBefore(today, 2 * WINDOW - 1)
  const rankFrom = daysBefore(today, RANK_WINDOW - 1)
  const workouts = (S?.workouts || []).filter(w => w && typeof w.d === 'string' && w.d <= today)
  const recent = workouts.filter(w => w.d >= from)

  // Per exercise: in how many workouts (56 days), the last day, and the two windows' heaviest.
  const by = {}
  for (const w of workouts) {
    if (w.d < rankFrom) continue
    for (const e of w.entries || []) {
      const kg = heaviest(e)
      if (!kg || !e.id) continue
      const x = by[e.id] || (by[e.id] = { id: e.id, count: 0, last: '', best: 0, prev: 0 })
      x.count++
      if (w.d > x.last) x.last = w.d
      if (w.d >= from) x.best = Math.max(x.best, kg)
      else if (w.d >= prevFrom) x.prev = Math.max(x.prev, kg)
    }
  }
  const lifts = Object.values(by)
    .filter(x => x.best > 0)
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
    .slice(0, TOP)
    .map(x => {
      const best = shownWeight(S, x.id, x.best)
      const prev = x.prev > 0 ? shownWeight(S, x.id, x.prev) : null
      return { id: x.id, best, prev, delta: prev == null ? null : Math.round((best - prev) * 100) / 100, unit: exUnitOf(S, x.id) }
    })

  return {
    workouts: recent.length,
    records: recent.reduce((n, w) => n + (Array.isArray(w.prs) ? w.prs.length : 0), 0),
    lifts,
  }
}
