// Structured intervals for a cardio exercise: warm-up, rounds of hard and easy, cool-down, all in
// minutes, the same shape the program library uses (lib/library.js `intervals`). A cardio entry
// carries them on its target (`target.intervals`), from a program week or set up in the workout
// (components/IntervalCard.jsx). The timer runs on the wall clock (`entry.ivRun`), so a phone that
// was locked catches up, and the finished run is logged on the cardio row with the rounds done
// (`set.iv`). Pure; nothing here touches the store.
import { t } from './i18n-core.js'
import { isWarmupRow } from './workout-model.js'

export const DEFAULT_INTERVALS = { warmup: 5, hard: 1, easy: 2, rounds: 6, cooldown: 5 }
const LIMITS = { warmup: [0, 60], hard: [0.25, 60], easy: [0, 60], rounds: [1, 50], cooldown: [0, 60] }

/** A usable copy of `v`, clamped to sane limits, or null when it is not an interval plan at all. */
export function cleanIntervals(v) {
  if (!v || typeof v !== 'object') return null
  const out = {}
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
    const n = Number(v[k])
    if (!Number.isFinite(n)) { if (k === 'hard' || k === 'rounds') return null; out[k] = 0; continue }
    out[k] = Math.min(hi, Math.max(lo, k === 'rounds' ? Math.round(n) : Math.round(n * 4) / 4))
  }
  // How hard the hard parts are: a number, or the library's own words ("7 to 8").
  const rpe = v.hardRpe
  if (typeof rpe === 'number' && rpe >= 1 && rpe <= 10) out.hardRpe = rpe
  else if (typeof rpe === 'string' && rpe.trim() && rpe.length <= 20) out.hardRpe = rpe.trim()
  return out
}

/** The plan as timed segments, in order: { kind: 'warmup' | 'hard' | 'easy' | 'cooldown', sec, round? }. */
export function segmentsOf(intervals) {
  const i = cleanIntervals(intervals)
  if (!i) return []
  const out = []
  if (i.warmup > 0) out.push({ kind: 'warmup', sec: i.warmup * 60 })
  for (let r = 1; r <= i.rounds; r++) {
    out.push({ kind: 'hard', sec: i.hard * 60, round: r })
    if (i.easy > 0) out.push({ kind: 'easy', sec: i.easy * 60, round: r })
  }
  if (i.cooldown > 0) out.push({ kind: 'cooldown', sec: i.cooldown * 60 })
  return out
}

export const totalSec = segments => segments.reduce((a, s) => a + s.sec, 0)

/** Seconds the run has been going, paused time left out. */
export function elapsedSec(run, now = Date.now()) {
  if (!run || !Number.isFinite(run.at)) return 0
  const end = run.pausedAt > 0 ? run.pausedAt : now
  return Math.max(0, (end - run.at - (run.paused || 0)) / 1000)
}

/**
 * Where `sec` falls: the segment's index, the segment, its seconds left, and whether the whole
 * plan is over (`done`, index then past the last segment).
 */
export function positionAt(segments, sec) {
  let start = 0
  for (let index = 0; index < segments.length; index++) {
    const end = start + segments[index].sec
    if (sec < end) return { index, seg: segments[index], left: end - sec, start, done: false }
    start = end
  }
  return { index: segments.length, seg: null, left: 0, start, done: true }
}

/** Hard segments finished by `sec`. */
export function roundsDone(segments, sec) {
  let start = 0, n = 0
  for (const s of segments) {
    start += s.sec
    if (start > sec + 1e-9) break
    if (s.kind === 'hard') n++
  }
  return n
}

/** The run jumped to the start of the next segment: a new start time with the same pauses. */
export function skipSegment(run, segments, now = Date.now()) {
  const pos = positionAt(segments, elapsedSec(run, now))
  if (pos.done) return run
  return { ...run, at: run.at - pos.left * 1000 }
}

/** What the cardio row logs for a run that ended at `sec`: whole minutes, and the plan with the rounds done. */
export function loggedRun(intervals, sec) {
  const i = cleanIntervals(intervals)
  const segments = segmentsOf(i)
  return { min: Math.max(1, Math.round(sec / 60)), iv: { ...i, done: roundsDone(segments, sec) } }
}

/** m:ss */
export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec - 1e-9))
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
}

const fmtMin = min => (min % 1 ? fmtClock(min * 60) : t('{0} min', min))

/** One line for the plan: "5 min warm-up, 6 × 1 min hard and 2 min easy, 5 min cool-down". */
export function intervalSummary(intervals) {
  const i = cleanIntervals(intervals)
  if (!i) return ''
  const rounds = i.easy > 0
    ? t('{0} × {1} hard and {2} easy', i.rounds, fmtMin(i.hard), fmtMin(i.easy))
    : t('{0} × {1} hard', i.rounds, fmtMin(i.hard))
  return [i.warmup > 0 && t('{0} warm-up', fmtMin(i.warmup)), rounds, i.cooldown > 0 && t('{0} cool-down', fmtMin(i.cooldown))].filter(Boolean).join(', ')
}

/** A logged run in History: "4 of 6 rounds of 1 min hard". */
export function loggedSummary(iv) {
  const i = cleanIntervals(iv)
  if (!i) return ''
  const done = Math.max(0, Math.min(i.rounds, Math.round(Number(iv.done) || 0)))
  return done === i.rounds
    ? t('{0} rounds of {1} hard', i.rounds, fmtMin(i.hard))
    : t('{0} of {1} rounds of {2} hard', done, i.rounds, fmtMin(i.hard))
}

/** The segment's name on the timer: "Warm-up", "Hard 2 of 6", "Easy 2 of 6", "Cool-down". */
export function segmentName(seg, rounds) {
  if (!seg) return t('Done')
  if (seg.kind === 'warmup') return t('Warm-up')
  if (seg.kind === 'cooldown') return t('Cool-down')
  return seg.kind === 'hard' ? t('Hard {0} of {1}', seg.round, rounds) : t('Easy {0} of {1}', seg.round, rounds)
}

/** Writes the run's result on the first open cardio row (or a new one) and ends the run (`s` is a draft of the state). */
export function logIntervalRun(s, idx, sec) {
  const e = s.active?.entries?.[idx]
  const plan = cleanIntervals(e?.target?.intervals)
  if (!e || !plan) return false
  const { min, iv } = loggedRun(plan, sec)
  let row = e.sets.find(x => !x.done && !isWarmupRow(x))
  if (!row) { row = { speed: e.target.speed || 8, done: false }; e.sets.push(row) }
  Object.assign(row, { min, iv, done: true, at: Date.now() })
  delete e.ivRun
  return true
}
