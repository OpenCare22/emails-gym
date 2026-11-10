import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summaryOf, dayIn } from '../social/summary.js';

const NOW = Date.parse('2026-11-11T07:30:00Z'); // a Wednesday, 07:30 UTC
const set = (w, r, extra = {}) => ({ w, r, done: true, ...extra });
const S = {
  unit: 'kg', weekStart: 1, reminder: { tz: 'Europe/Amsterdam', tone: 'drill' },
  bodyweight: [{ d: '2026-11-01', w: 80 }, { d: '2026-11-09', w: 75 }],
  workouts: [
    { d: '2026-11-10', prs: ['0043'], entries: [{ id: '0043', sets: [set(40, 5, { warmup: true }), set(100, 5), set(100, 5), set(100, 3, { done: false })] }] },
    { d: '2026-11-03', entries: [{ id: '0025', sets: [set(80, 8)] }] },
    { d: '2026-10-28', entries: [{ id: '0032', sets: [set(150, 12), set(140, 5)] }] },
    { d: '2026-12-01', entries: [] },
  ],
};

test('counts workouts, volume and records in the person’s own week and month', () => {
  const s = summaryOf(S, { now: NOW });
  assert.equal(s.today, '2026-11-11');
  assert.equal(s.week, '2026-11-09');
  assert.deepEqual([s.workoutsWeek, s.workoutsMonth, s.workoutsAll], [1, 2, 3]);
  assert.equal(s.volumeWeekKg, 1000, 'warm-ups and unfinished sets left out');
  assert.equal(s.volumeMonthKg, 1640);
  assert.equal(s.prsMonth, 1);
  assert.equal(s.tone, 'drill');
});

test('estimates strength against the latest body weight, sets of 10 reps or fewer only', () => {
  const s = summaryOf(S, { now: NOW });
  assert.equal(s.strength.squat, Math.round(100 * (1 + 5 / 30) / 75 * 100) / 100);
  assert.equal(s.strength.bench, Math.round(80 * (1 + 8 / 30) / 75 * 100) / 100);
  assert.equal(s.strength.deadlift, Math.round(140 * (1 + 5 / 30) / 75 * 100) / 100, 'the 12-rep set is ignored');
});

test('converts a pound profile to kg', () => {
  const lb = { ...S, unit: 'lb', bodyweight: [{ d: '2026-11-09', w: 165 }] };
  const s = summaryOf(lb, { now: NOW });
  assert.equal(s.volumeWeekKg, Math.round(1000 * 0.45359237));
  assert.equal(s.strength.squat, Math.round((100 * (1 + 5 / 30)) / 165 * 100) / 100);
});

test('uses the person’s time zone and Sunday weeks', () => {
  // 23:30 on Saturday 14 Nov in Los Angeles is already Sunday in UTC.
  const late = Date.parse('2026-11-15T07:30:00Z');
  assert.equal(dayIn(late, 'America/Los_Angeles'), '2026-11-14');
  const s = summaryOf({ ...S, weekStart: 0, reminder: { tz: 'America/Los_Angeles' } }, { now: late });
  assert.equal(s.week, '2026-11-08');
  assert.equal(dayIn(late, 'Not/AZone').length, 10);
});

test('adds this week’s steps and active minutes from the health data, null without any', () => {
  const s = summaryOf(S, { now: NOW, health: { steps: { '2026-11-09': 8000, '2026-11-10': 5000, '2026-11-01': 99999 }, activeMinutes: {} } });
  assert.equal(s.stepsWeek, 13000);
  assert.equal(s.activeMinutesWeek, null);
});

test('an empty profile is all zeros and nulls', () => {
  const s = summaryOf({}, { now: NOW });
  assert.deepEqual([s.workoutsAll, s.streakWeeks, s.volumeWeekKg, s.stepsWeek, s.strength.squat, s.tone], [0, 0, 0, null, null, 'friendly']);
});
