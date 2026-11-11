import { beforeEach, describe, it, expect } from 'vitest'
import { daysBetween, breakGap, tierOf, easeForReturn, RUNGS, setReturnEasing } from './return-break.js'

import { nextPrescription, sessionsFor, stallCount } from './progression.js'

beforeEach(() => setReturnEasing(true))

const cfg = { id: '0025', sets: 3, reps: 5, weight: 100, inc: 2.5, prog: 'linear' }
const today = '2026-03-01'
const ago = n => new Date(Date.UTC(2026, 2, 1 - n)).toISOString().slice(0, 10)
const workout = (d, c = cfg, extra = {}) => ({ d, routineIds: ['r'], entries: [{ id: c.id, target: { ...c }, sets: Array.from({ length: c.sets }, () => ({ w: c.weight, r: c.reps, sec: c.sec, done: true })), ...extra }] })
const on = days => ({ unit: 'kg', workouts: days.map(n => workout(ago(n))) })

describe('break detection', () => {
  it('uses UTC calendar days across month and daylight-saving boundaries', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween(today, ago(1))).toBe(-1)
  })
  it.each([7, 10, 11, 14])('weekly lift after %i days', days => {
    expect(breakGap(on([days + 14, days + 7, days]), cfg.id, today)).toEqual(days < 11 ? null : { days, usual: 7 })
  })
  it('protects a ten-day rotation', () => expect(breakGap(on([30, 20, 10]), cfg.id, today)).toBe(null))
  it.each([7, 8])('twice a week after %i days', days => {
    expect(breakGap(on([days + 7, days + 4, days]), cfg.id, today)).toEqual(days === 7 ? null : { days, usual: 3.5 })
  })
  it('first session ever', () => expect(breakGap(on([]), cfg.id, today)).toBe(null))
  it('sparse history uses seven days and still requires the ratio', () => {
    expect(breakGap(on([9]), cfg.id, today)).toBe(null)
    expect(breakGap(on([11]), cfg.id, today)).toEqual({ days: 11, usual: 7 })
  })
  it('ignores same-day and future dates', () => expect(breakGap(on([0, -1]), cfg.id, today)).toBe(null))
  it('uses distinct dates and only the last five', () => {
    expect(breakGap(on([100, 24, 20, 17, 13, 10, 10, 0, -1]), cfg.id, today)).toEqual({ days: 10, usual: 3.5 })
  })
  it('reads across routines', () => {
    const st = on([20, 2]); st.workouts[1].routineIds = ['other']
    expect(breakGap(st, cfg.id, today)).toBe(null)
  })
  it('ignores excluded entries, warm-ups and unlogged work', () => {
    const st = on([20, 3, 2, 1])
    st.workouts[1].entries[0].noProg = true
    st.workouts[2].entries[0].sets.forEach(s => { s.warmup = true })
    st.workouts[3].entries[0].sets.forEach(s => { s.done = false })
    expect(breakGap(st, cfg.id, today)).toEqual({ days: 20, usual: 7 })
  })
  it.each([[8, 'short'], [14, 'short'], [15, 'medium'], [28, 'medium'], [29, 'long']])('tier at %i', (days, tier) => expect(tierOf(days)).toBe(tier))
})

const routine = { id: 'r', prog: 'linear' }
const ease = (st, c = cfg, plan = nextPrescription(st, c, routine), date = today) => easeForReturn(st, c, routine, plan, { today: date, person: { sex: 'female', birthYear: 1990 } })
const log = (st, result, date = today, hit = true, c = cfg) => {
  const target = { ...c, ...result.plan }
  st.workouts.push(workout(date, target, { id: c.id, ...(result.back ? { back: result.back } : {}), sets: Array.from({ length: target.sets }, (_, i) => ({ w: target.weight, r: (target.rowReps?.[i] ?? target.reps) - (hit ? 0 : 1), sec: target.sec, done: true })) }))
}

describe('ease-in ramp', () => {
  it('keeps the exact plan and no stamp while easing is disabled', () => {
    const st = on([40])
    const plan = nextPrescription(st, cfg, routine)
    setReturnEasing(false)
    const out = ease(st, cfg, plan)
    expect(out.plan).toBe(plan)
    expect(out.back).toBe(null)
    setReturnEasing(true)
    expect(ease(st, cfg, plan).back.tier).toBe('long')
  })
  it('has the specified rungs', () => expect(RUNGS).toEqual({ short: [{ drop: 1, factor: 1, help: 0 }], medium: [{ drop: 1, factor: 0.9, help: 1 }], long: [{ drop: 1, factor: 0.8, help: 2 }, { drop: 0, factor: 0.9, help: 1 }] }))
  it('short holds the logged weight and aim, and drops a set', () => {
    expect(ease(on([17, 13, 10]))).toMatchObject({ plan: { kind: 'return', weight: 100, reps: 5, sets: 2 }, back: { days: 10, tier: 'short', step: 1, from: { weight: 100, sets: 3, reps: 5 } } })
  })
  it.each([[100, 90], [102.5, 90]])('medium rounds %i down to %i', (weight, expected) => {
    const st = { unit: 'kg', workouts: [workout(ago(20), { ...cfg, weight })] }
    expect(ease(st).plan).toMatchObject({ weight: expected, sets: 2 })
  })
  it('long ramp returns to full sets, then old weight, then normal progression', () => {
    const st = on([40])
    let out = ease(st)
    expect(out.plan).toMatchObject({ weight: 80, sets: 2 })
    log(st, out)
    out = ease(st, cfg, undefined, '2026-03-04')
    expect(out).toMatchObject({ plan: { weight: 90, sets: 3 }, back: { step: 2 } })
    log(st, out, '2026-03-04')
    out = ease(st, cfg, undefined, '2026-03-07')
    expect(out).toMatchObject({ plan: { kind: 'return', weight: 100, sets: 3 }, back: null })
    log(st, out, '2026-03-07')
    expect(ease(st, cfg, undefined, '2026-03-10')).toMatchObject({ plan: { kind: 'up', weight: 102.5 }, back: null })
  })
  it('short finishes in one session', () => {
    const st = on([17, 13, 10]); const normal = nextPrescription(st, cfg, routine)
    log(st, ease(st))
    expect(ease(st, cfg, undefined, '2026-03-04')).toEqual({ plan: normal, back: null })
  })
  it('missed rung repeats once, then ends without changing saved history', () => {
    const st = on([20]); log(st, ease(st), today, false)
    const repeat = ease(st, cfg, undefined, '2026-03-04')
    expect(repeat).toMatchObject({ plan: { weight: 90, sets: 2 }, back: { step: 1, repeat: true } })
    log(st, repeat, '2026-03-04', false)
    const saved = JSON.stringify(st)
    expect(ease(st, cfg, undefined, '2026-03-07')).toMatchObject({ plan: { kind: 'hold', weight: 90 }, back: null })
    expect(stallCount(sessionsFor(st, cfg.id, cfg).filter(s => !s.back || (s.back.repeat && !s.ok)), 'linear')).toBe(1)
    expect(JSON.stringify(st)).toBe(saved)
    expect(st.workouts.at(-1).entries[0].back).not.toHaveProperty('ended')
  })
  it('a new break mid ramp keeps the original baseline', () => {
    const st = on([47, 43, 40]); log(st, ease(st))
    expect(ease(st, cfg, undefined, '2026-03-21')).toMatchObject({ plan: { weight: 90 }, back: { step: 1, tier: 'medium', from: { weight: 100 } } })
  })
  it('owned dumbbells round down', () => {
    const c = { ...cfg, id: '0289', weight: 20, dbLoad: 'each' }
    const st = { unit: 'kg', dumbbells: { kg: { weights: [10, 12.5, 15, 17.5, 20] } }, workouts: [workout(ago(20), c)] }
    expect(ease(st, c).plan.weight).toBe(17.5)
  })
  it('assistance adds help', () => {
    const c = { ...cfg, id: '0017', weight: 30 }
    expect(ease({ unit: 'kg', workouts: [workout(ago(20), c)] }, c).plan.weight).toBe(32.5)
  })
  it('bodyweight reduces reps', () => {
    const c = { ...cfg, bodyweight: true, weight: 0, reps: 12 }
    expect(ease({ unit: 'kg', workouts: [workout(ago(40), c)] }, c).plan).toMatchObject({ weight: 0, reps: 9, sets: 2 })
  })
  it('timed holds floor to five seconds', () => {
    const c = { ...cfg, mode: 'time', prog: 'time', sec: 60, weight: 0 }
    expect(ease({ unit: 'kg', workouts: [workout(ago(20), c)] }, c, { kind: 'up', sec: 65 }).plan).toMatchObject({ sec: 50, sets: 2 })
  })
  it.each([11, 20])('one set remains one after %i days', days => {
    const c = { ...cfg, sets: 1 }
    expect(ease({ unit: 'kg', workouts: [workout(ago(days), c)] }, c).plan).toMatchObject({ sets: 1, weight: days === 11 ? 100 : 90 })
  })
  it('triple progression drops the last aim', () => {
    const c = { ...cfg, prog: 'triple', sets: 4, reps: 12, rowReps: [12, 12, 12, 8] }
    expect(ease({ unit: 'kg', workouts: [workout(ago(11), c)] }, c).plan.rowReps).toEqual([12, 12, 12])
  })
  it('programme uses this week on every rung and at the full-weight hold', () => {
    const st = on([40]); const programme = { kind: 'programme', weight: 80, sets: 4 }
    const first = ease(st, cfg, programme)
    expect(first.plan).toMatchObject({ weight: 62.5, sets: 3 })
    log(st, first)
    const second = ease(st, cfg, { ...programme, weight: 90, sets: 5 }, '2026-03-04')
    expect(second.plan).toMatchObject({ weight: 80, sets: 5 })
    log(st, second, '2026-03-04')
    expect(ease(st, cfg, { ...programme, weight: 95 }, '2026-03-07')).toMatchObject({ plan: { weight: 95, sets: 4 }, back: null })
    expect(ease(on([20]), cfg, programme).plan).toMatchObject({ weight: 70, sets: 3 })
  })
  it.each([{ kind: 'off' }, { kind: 'first' }, { kind: 'programme', prog: { deload: true } }])('leaves exempt plans unchanged', plan => {
    expect(ease(on([40]), cfg, plan)).toEqual({ plan, back: null })
  })
  it('does not ease cardio', () => {
    const plan = { kind: 'programme', min: 20 }
    expect(ease(on([40]), { ...cfg, mode: 'cardio' }, plan)).toEqual({ plan, back: null })
  })
  it('deload wins short breaks and takes the lighter load on longer breaks', () => {
    const st = on([17, 13, 10]); st.workouts.forEach(w => { w.entries[0].sets[2].r = 3 })
    const plan = nextPrescription(st, cfg, routine)
    expect(plan.kind).toBe('deload')
    expect(ease(st, cfg, plan)).toEqual({ plan, back: null })
    expect(ease(st, cfg, plan, '2026-03-11').plan).toMatchObject({ weight: Math.min(90, plan.weight), sets: 2 })
  })
  it('eased misses do not change the pre-break stall count', () => {
    const st = on([24, 20]); st.workouts.forEach(w => { w.entries[0].sets[2].r = 3 })
    const normal = nextPrescription(st, cfg, routine)
    log(st, ease(st), today, false)
    expect(nextPrescription(st, cfg, routine)).toEqual(normal)
  })
  it('uses this routine baseline but notices work in other routines', () => {
    const st = on([24, 20]); st.workouts[0].entries[0].sets.forEach(s => { s.w = 60 }); st.workouts[1].routineIds = ['other']
    expect(ease(st).back.from.weight).toBe(60)
    st.workouts.push({ ...workout(ago(2)), routineIds: ['other'] })
    expect(ease(st).back).toBe(null)
  })
})

describe('return edge cases', () => {
  it('preserves the exact prescription object without a break', () => {
    const st = on([4]); const plan = nextPrescription(st, cfg, routine)
    expect(ease(st, cfg, plan).plan).toBe(plan)
  })
  it('restores triple rows in full after a medium ramp', () => {
    const c = { ...cfg, sets: 4, rowReps: [12, 12, 12, 8], reps: 12, prog: 'triple' }
    const st = { unit: 'kg', workouts: [workout(ago(20), c)] }
    const first = ease(st, c)
    log(st, first, today, true, c)
    expect(ease(st, c, undefined, '2026-03-04')).toMatchObject({ plan: { weight: 100, sets: 4, rowReps: c.rowReps }, back: null })
  })
  it('a successful repeated rung resumes the ramp', () => {
    const st = on([40]); log(st, ease(st), today, false)
    log(st, ease(st, cfg, undefined, '2026-03-04'), '2026-03-04')
    expect(ease(st, cfg, undefined, '2026-03-07')).toMatchObject({ plan: { weight: 90 }, back: { step: 2 } })
  })
  it('a deload due takes priority at the full-weight hold', () => {
    const st = on([20]); log(st, ease(st))
    const plan = { kind: 'deload', weight: 85 }
    expect(ease(st, cfg, plan, '2026-03-04')).toEqual({ plan, back: null })
  })
  it('assisted deload takes the greater help', () => {
    const c = { ...cfg, id: '0017', weight: 30 }
    const st = { unit: 'kg', workouts: [workout(ago(20), c)] }
    expect(ease(st, c, { kind: 'deload', weight: 35 }).plan.weight).toBe(35)
  })
  it('uses an owned machine stack', () => {
    const st = on([20]); st.stackWeights = { [cfg.id]: { unit: 'kg', weights: [70, 85, 100] } }
    expect(ease(st).plan.weight).toBe(85)
  })
})
