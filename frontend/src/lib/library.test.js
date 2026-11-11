import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { convertProgram, validateProgram, estimateMinutes, sessionForWeek, isVisible, reviewed, canApprove } from './library.js';
import { programs } from './library-data.js';
const root = new URL('../../../', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const source = read('library/source-UNREVIEWED.json');
const corrections = read('library/corrections.json');
const map = read('library/exercise-map.json');
const ids = readdirSync(new URL('catalogue/exercises/', root)).map(f => f.replace('.json', ''));
for (const [id, m] of Object.entries(map.exercises)) Object.assign(m, read(`catalogue/exercises/${m.id}.json`), { unilateral: source.exercises.find(e => e.id === id).unilateral });
for (const [key, id] of Object.entries(map.cardio)) if (key !== '_note') map.cardio[key] = read(`catalogue/exercises/${id}.json`);
const convert = (index = 0) => convertProgram(source.programs[index], map, corrections);
const copy = () => structuredClone(programs[0]);
const approval = { reviewer: 'Coach', date: '2026-11-10', version: '1.0.0', status: 'approved' };

describe('library conversion', () => {
  it('maps every goal and level explicitly', () => {
    expect(source.programs.map((s, i) => convert(i).goal)).toEqual(['general', 'general', 'muscle', 'strength', 'hybrid', 'efficient', 'endurance', 'muscle', 'muscle']);
    expect(source.programs.map((s, i) => convert(i).level)).toEqual([['beginner'], ['beginner'], ['intermediate'], ['intermediate'], ['intermediate'], ['any'], ['beginner', 'intermediate'], ['beginner', 'intermediate'], ['any']]);
    expect(() => convertProgram({ ...source.programs[0], goal: 'unknown' }, map, corrections)).toThrow();
  });
  it('uses catalogue equipment, holds and unilateral metadata without mutating inputs', () => {
    const before = JSON.stringify([source, map, corrections]);
    const p = convert();
    expect(p.templates[0].items[4]).toMatchObject({ mode: 'time', sec: [20, 40] });
    expect(p.templates[0].items[4]).not.toHaveProperty('reps');
    expect(p.templates[1].items[3].side).toBe(true);
    expect(p.equipment).toContain('body weight');
    expect(JSON.stringify([source, map, corrections])).toBe(before);
  });
  it('preserves expanded sets and RIR across all seven programs and all weeks', () => {
    source.programs.forEach((s, index) => {
      const p = convert(index);
      s.expanded_weeks.forEach((w, wi) => w.sessions.forEach(session => {
        expect(p.plan[wi].items[session.template_id]).toEqual(session.exercises.map(e => ({ sets: e.sets, rir: e.target_rir })));
      }));
      expect(validateProgram(p, ids)).toEqual({ errors: [], blockers: [] });
      const estimates = p.plan.flatMap(w => Object.keys(w.items).map(id => estimateMinutes(sessionForWeek(p, w, id))));
      expect(p.minutes).toEqual([Math.min(...estimates), Math.max(...estimates)]);
    });
  });
  it('corrects every interval week, including both lighter weeks', () => {
    expect(convert(4).plan[7].cardio['h4-c2'][0]).toMatchObject({ min: 21, intervals: { rounds: 3 } });
    expect(convert(6).plan.map(w => w.cardio['c3-intervals'][0].min)).toEqual([20, 20, 25, 25, 30, 30, 30, 20]);
    expect(convert(6).templates[1].items[0].note).not.toContain('4×');
    const bad = structuredClone(corrections);
    bad.intervals['hybrid-4/h4-c2'].minutes['8'] = 22;
    expect(() => convertProgram(source.programs[4], map, bad)).toThrow('do not add up');
  });
  it('keeps missing mappings and missing corrections as blockers', () => {
    const missing = structuredClone(map);
    delete missing.exercises.goblet_squat;
    expect(validateProgram(convertProgram(source.programs[0], missing, corrections), ids).blockers.join()).toContain('no catalogue mapping');
    expect(validateProgram(convertProgram(source.programs[4], map, {}), ids).blockers.join()).toContain('needs a correction');
  });
  it('rejects expanded exercise order changes', () => {
    const s = structuredClone(source.programs[0]);
    s.expanded_weeks[0].sessions[0].exercises.reverse();
    expect(() => convertProgram(s, map, corrections)).toThrow('order differs');
  });
  it('checks generated data and approvals through the build', () => {
    expect(execFileSync(process.execPath, ['scripts/library/build.mjs', '--check'], { cwd: root, encoding: 'utf8' })).toContain('9 programs, 0 structural errors');
  });
});

describe('validation', () => {
  it.each([
    ['unknown exercise', p => { p.templates[0].items[0].ex = 'unknown'; }],
    ['sets', p => { p.plan[0].items['f2-a'][0].sets = 0; }],
    ['rep range', p => { p.templates[0].items[0].reps = [12, 8]; }],
    ['RIR', p => { p.plan[0].items['f2-a'][0].rir = 6; }],
    ['negative RIR', p => { p.templates[0].items[0].rir = -1; }],
    ['seconds', p => { p.templates[0].items[4].sec = [0, 40]; }],
    ['rest', p => { p.templates[0].items[0].rest = 0; }],
    ['week count', p => { p.plan.pop(); }],
    ['session count', p => { delete p.plan[0].items['f2-a']; }],
    ['empty session', p => { p.templates[0].items = []; }],
    ['duplicate week', p => { p.plan[1].week = 1; }],
    ['weekly item count', p => { p.plan[0].items['f2-a'].pop(); }],
  ])('rejects invalid %s', (_, mutate) => {
    const p = copy(); mutate(p); expect(validateProgram(p, ids).errors.length).toBeGreaterThan(0);
  });
  it('validates weekly cardio duration and segment arithmetic', () => {
    const p = convert(6);
    p.plan[2].cardio['c3-intervals'][0].min = 0;
    const result = validateProgram(p, ids);
    expect(result.errors.join()).toContain('Minutes');
    expect(result.blockers.join()).toContain('do not add up');
  });
  it('blocks only estimates more than ten minutes over the stated time', () => {
    const p = copy();
    p.statedMinutes = p.minutes[1] - 10;
    expect(validateProgram(p, ids).blockers).toEqual([]);
    p.statedMinutes--;
    expect(validateProgram(p, ids).blockers.join()).toContain('P1.6');
  });
});

describe('time estimates', () => {
  it('counts rest between exercises but omits only the final set rest', () => {
    expect(estimateMinutes({ items: [
      { mode: 'reps', sets: 2, rest: 120 }, { mode: 'time', sets: 2, sec: [30, 90], rest: 60 },
    ] })).toBe(20); // 8 min + 260 seconds work + 300 seconds rest = 17m20s
  });
  it('includes cardio without a second warm-up and rounds up to five', () => {
    expect(estimateMinutes({ items: [{ mode: 'cardio', min: 21 }] })).toBe(25);
    expect(estimateMinutes({ items: [{ mode: 'reps', sets: 1, rest: 120 }, { mode: 'cardio', min: 21 }] })).toBe(30);
  });
});

describe('review state', () => {
  it.each(['draft', 'needs_review', 'approved', 'retired'])('shows %s unless retired', status => {
    expect(isVisible(programs[0], { programs: { 'foundation-2': { status } } })).toBe(status !== 'retired');
  });
  it('shows programs without a review entry without an approval badge', () => {
    expect(isVisible(programs[0], {})).toBe(true);
    expect(reviewed(programs[0], {})).toBe(false);
  });
  it('requires identity, date, exact version and an explicit empty blocker list', () => {
    expect(canApprove(programs[0], approval)).toBe(true);
    expect(reviewed(programs[0], approval)).toBe(true);
    for (const patch of [{ reviewer: ' ' }, { date: null }, { date: 'not a date' }, { date: '2026-02-30' }, { version: '2.0.0' }]) expect(canApprove(programs[0], { ...approval, ...patch })).toBe(false);
    expect(canApprove({ ...programs[0], blockers: ['Open issue'] }, approval)).toBe(false);
    expect(canApprove({ ...programs[0], blockers: undefined }, approval)).toBe(false);
  });
});

// The two programs added on 2026-11-11 (docs/decisions.md): the audit's missing 3-day muscle plan
// and the home plan, which must stay within dumbbells, a bench and bodyweight.
describe('added programs', () => {
  const byId = id => programs.find(p => p.id === id);
  it('Build / Three Days is three full-body days for muscle', () => {
    const p = byId('build-3');
    expect(p).toMatchObject({ days: 3, weeks: 8, goal: 'muscle', blockers: [] });
    expect(p.templates.map(t => t.day)).toEqual([1, 3, 5]);
  });
  it('Home / Three Days needs nothing past dumbbells and bodyweight', () => {
    const p = byId('home-3');
    expect(p.equipment).toEqual(['body weight', 'dumbbell']);
    expect(p).toMatchObject({ days: 3, goal: 'muscle', blockers: [] });
  });
  it('both start a set easier and trim a set in week 8', () => {
    for (const id of ['build-3', 'home-3']) {
      const p = byId(id), t = p.templates[0].id;
      const lift = p.templates[0].items.find(i => i.mode === 'reps');
      expect(p.plan[0].items[t][0].rir).toBe(lift.rir + 1);
      expect(p.plan[7].items[t][0]).toEqual({ sets: lift.sets - 1, rir: lift.rir + 1 });
      expect(p.plan[3].items[t][0]).toEqual({ sets: lift.sets, rir: lift.rir });
    }
  });
});
