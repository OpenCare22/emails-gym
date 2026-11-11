import { describe, it, expect } from 'vitest'
import {
  cleanIntervals, segmentsOf, totalSec, elapsedSec, positionAt, roundsDone, skipSegment, loggedRun,
  fmtClock, intervalSummary, loggedSummary, segmentName, DEFAULT_INTERVALS,
} from './intervals.js'
import { intervalMinutes } from './library.js'

// conditioning-3 week 1 after the correction (docs/decisions.md): 6 min warm-up, 2 rounds of
// 2 min hard and 3 easy, 4 min cool-down.
const C3 = { warmup: 6, hard: 2, easy: 3, rounds: 2, cooldown: 4, hardRpe: 8 }

describe('cleanIntervals', () => {
  it('keeps a library plan as it is', () => expect(cleanIntervals(C3)).toEqual(C3))
  it('needs hard minutes and rounds', () => {
    expect(cleanIntervals({ warmup: 5 })).toBe(null)
    expect(cleanIntervals(null)).toBe(null)
    expect(cleanIntervals({ hard: 1, rounds: 3 })).toEqual({ warmup: 0, hard: 1, easy: 0, rounds: 3, cooldown: 0 })
  })
  it('clamps and rounds to quarter minutes and whole rounds', () => {
    expect(cleanIntervals({ hard: 0.1, rounds: 2.6, easy: 1.13, warmup: -3, cooldown: 99 }))
      .toEqual({ warmup: 0, hard: 0.25, easy: 1.25, rounds: 3, cooldown: 60 })
  })
})

describe('segments', () => {
  it('lays out warm-up, each round, cool-down', () => {
    expect(segmentsOf(C3).map(s => s.kind + (s.round || ''))).toEqual(['warmup', 'hard1', 'easy1', 'hard2', 'easy2', 'cooldown'])
  })
  it('adds up to the library minutes', () => {
    expect(totalSec(segmentsOf(C3))).toBe(intervalMinutes(C3) * 60)
    expect(totalSec(segmentsOf(DEFAULT_INTERVALS))).toBe(28 * 60)
  })
  it('skips empty warm-up, easy and cool-down', () => {
    expect(segmentsOf({ hard: 0.5, rounds: 2 }).map(s => s.kind)).toEqual(['hard', 'hard'])
  })
})

describe('the clock', () => {
  const segs = segmentsOf(C3)
  it('finds the segment and its time left', () => {
    expect(positionAt(segs, 0)).toMatchObject({ index: 0, left: 360, done: false })
    expect(positionAt(segs, 361)).toMatchObject({ index: 1, left: 119 })
    expect(positionAt(segs, 360 + 120 + 30).seg).toMatchObject({ kind: 'easy', round: 1 })
    expect(positionAt(segs, 30 * 60)).toMatchObject({ done: true, index: 6 })
  })
  it('counts rounds once their hard segment is over', () => {
    expect(roundsDone(segs, 360 + 119)).toBe(0)
    expect(roundsDone(segs, 360 + 120)).toBe(1)
    expect(roundsDone(segs, 30 * 60)).toBe(2)
  })
  it('leaves paused time out and catches up from the clock', () => {
    expect(elapsedSec({ at: 1000, paused: 0 }, 61000)).toBe(60)
    expect(elapsedSec({ at: 1000, paused: 20000 }, 61000)).toBe(40)
    expect(elapsedSec({ at: 1000, paused: 0, pausedAt: 31000 }, 999999)).toBe(30)
    expect(elapsedSec(null)).toBe(0)
  })
  it('skip jumps to the next segment', () => {
    const run = { at: 0, paused: 0 }
    const next = skipSegment(run, segs, 100 * 1000)
    expect(elapsedSec(next, 100 * 1000)).toBe(360)
    const paused = skipSegment({ at: 0, paused: 0, pausedAt: 100 * 1000 }, segs, 500 * 1000)
    expect(elapsedSec(paused, 500 * 1000)).toBe(360)
  })
})

describe('logging', () => {
  it('logs whole minutes and the rounds done', () => {
    expect(loggedRun(C3, 30 * 60)).toEqual({ min: 30, iv: { ...C3, done: 2 } })
    expect(loggedRun(C3, 360 + 125)).toEqual({ min: 8, iv: { ...C3, done: 1 } })
    expect(loggedRun(C3, 10).min).toBe(1)
  })
  it('reads back in plain words', () => {
    expect(loggedSummary({ ...C3, done: 2 })).toBe('2 rounds of 2 min hard')
    expect(loggedSummary({ ...C3, done: 1 })).toBe('1 of 2 rounds of 2 min hard')
    expect(intervalSummary(C3)).toBe('6 min warm-up, 2 × 2 min hard and 3 min easy, 4 min cool-down')
    expect(intervalSummary({ hard: 0.5, rounds: 8 })).toBe('8 × 0:30 hard')
  })
  it('names segments and formats the clock', () => {
    expect(segmentName({ kind: 'hard', round: 2 }, 6)).toBe('Hard 2 of 6')
    expect(segmentName({ kind: 'warmup' }, 6)).toBe('Warm-up')
    expect(fmtClock(119.2)).toBe('2:00')
    expect(fmtClock(5)).toBe('0:05')
  })
})
