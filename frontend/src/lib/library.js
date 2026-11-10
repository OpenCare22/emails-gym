/**
 * Program = { id, version, title, goal, level: string[], days, weeks,
 *   minutes: [lo, hi], equipment: string[], approach, notes,
 *   source: 'research-2026-11', templates: Template[], plan: Week[] }.
 * Template = { id, name, day, warmUp, items: Item[] }.
 * Item = { ex, mode: 'reps', sets, reps: [lo, hi], rir, rest, side?, note? }
 *      | { ex, mode: 'time', sets, sec: [lo, hi], rest, side?, note? }
 *      | { ex, mode: 'cardio', min, intensity: 'easy' | 'interval', intervals?, note? }.
 * intervals = { warmup, hard, easy, rounds, cooldown, hardRpe } (minutes).
 * Week = { week, note, items: { [templateId]: [{ sets, rir }] },
 *   cardio: { [templateId]: [{ min, intervals? }] } }.
 * Weekly lifting rows follow the template's non-cardio items in order.
 * Build enriches exerciseMap entries with catalogue equipment/hold and source unilateral.
 * statedMinutes preserves the source time for validation; blockers travel with generated data.
 */
export const GOALS = {
  'general strength and habit formation': 'general',
  'muscle hypertrophy': 'muscle',
  'barbell strength with accessory muscle maintenance': 'strength',
  'strength plus aerobic fitness': 'hybrid',
  'time-efficient muscle and strength': 'efficient',
  'aerobic endurance and consistency': 'endurance',
};
const LEVELS = {
  beginner: ['beginner'], intermediate: ['intermediate'],
  'all levels with exercise familiarity': ['any'],
  'beginner to intermediate': ['beginner', 'intermediate'],
};
export const intervalMinutes = i => i.warmup + i.rounds * (i.hard + i.easy) + i.cooldown;

export function convertProgram(source, exerciseMap, corrections = {}) {
  if (!GOALS[source.goal] || !LEVELS[source.level]) throw new Error(`Unknown goal or level: ${source.id}`);
  const cardio = (c, templateId, week) => {
    const mapping = exerciseMap.cardio[c.modality];
    const item = { ex: typeof mapping === 'string' ? mapping : mapping?.id ?? null,
      mode: 'cardio', min: c.minutes, intensity: c.intensity === 'interval' ? 'interval' : 'easy', note: c.notes };
    const fix = corrections.intervals?.[`${source.id}/${templateId}`];
    if (item.intensity === 'interval' && fix) {
      if (!fix.reason?.trim()) throw new Error(`Correction needs a reason: ${templateId}`);
      const { warmup, hard, easy, cooldown, hardRpe } = fix;
      item.intervals = { warmup, hard, easy, rounds: fix.weeks[week], cooldown, hardRpe };
      item.min = intervalMinutes(item.intervals);
      if (!Number.isFinite(item.min) || Math.abs(item.min - fix.minutes[week]) > 1e-9 || !Number.isFinite(fix.minutes[week])) {
        throw new Error(`Correction minutes do not add up: ${source.id}/${templateId} week ${week}`);
      }
      // Original prose contains obsolete round counts. Keep it in the review sheet only.
      item.note = `Hard effort RPE ${hardRpe}. Controlled efforts, never all-out.`;
    }
    return item;
  };
  const templates = source.templates.map(t => ({ id: t.id, name: t.name, day: t.suggested_day,
    warmUp: t.warm_up, items: [
      ...t.exercises.map(e => {
        const m = exerciseMap.exercises[e.exercise_id];
        const timed = m?.hold || e.exercise_id === 'plank';
        return { ex: m?.id ?? null, mode: timed ? 'time' : 'reps', sets: e.sets,
          ...(timed ? { sec: [...e.reps] } : { reps: [...e.reps], rir: e.target_rir }),
          rest: e.rest_seconds, ...(m?.unilateral ? { side: true } : {}), note: e.notes };
      }), ...t.cardio.map(c => cardio(c, t.id, 1)),
    ] }));
  const plan = source.expanded_weeks.map(w => {
    const items = {}, weeklyCardio = {};
    for (const s of w.sessions) {
      if (Object.hasOwn(items, s.template_id)) throw new Error(`Duplicate session: ${s.template_id}`);
      const t = source.templates.find(t => t.id === s.template_id);
      if (!t || s.exercises.length !== t.exercises.length || s.exercises.some((e, i) => e.exercise_id !== t.exercises[i].exercise_id)) {
        throw new Error(`Expanded exercise order differs: ${s.template_id}`);
      }
      items[s.template_id] = s.exercises.map(e => ({ sets: e.sets, rir: e.target_rir }));
      weeklyCardio[s.template_id] = s.cardio.map(c => {
        const { min, intervals } = cardio(c, s.template_id, w.week);
        return { min, ...(intervals ? { intervals } : {}) };
      });
    }
    return { week: w.week, note: w.note, items, cardio: weeklyCardio };
  });
  const mapped = [...Object.values(exerciseMap.exercises), ...Object.values(exerciseMap.cardio)];
  const used = new Set(templates.flatMap(t => t.items.map(i => i.ex)));
  const p = { id: source.id, version: source.version, title: source.title, goal: GOALS[source.goal],
    level: [...LEVELS[source.level]], days: source.days_per_week, weeks: source.block_weeks,
    minutes: [0, 0], statedMinutes: source.session_minutes,
    equipment: [...new Set(mapped.filter(m => used.has(m?.id)).flatMap(m => m.equipment ? [m.equipment] : []))].sort(),
    approach: source.progression_rule, notes: source.notes, source: 'research-2026-11', templates, plan };
  const estimates = plan.flatMap(w => Object.keys(w.items).map(id => estimateMinutes(sessionForWeek(p, w, id))));
  p.minutes = estimates.length ? [Math.min(...estimates), Math.max(...estimates)] : [0, 0];
  return p;
}

export function sessionForWeek(p, week, id) {
  const t = p.templates.find(t => t.id === id);
  let lift = 0, cardio = 0;
  return { ...t, items: (t?.items || []).map(i => ({ ...i,
    ...(i.mode === 'cardio' ? week.cardio?.[id]?.[cardio++] : week.items?.[id]?.[lift++]),
  })) };
}

export function estimateMinutes(session) {
  const lifting = session.items.filter(i => i.mode !== 'cardio');
  let seconds = lifting.length ? 8 * 60 : 0;
  lifting.forEach((i, index) => {
    seconds += i.sets * (i.mode === 'time' ? i.sec[1] : 40);
    seconds += (i.sets - (index === lifting.length - 1 ? 1 : 0)) * i.rest;
  });
  seconds += session.items.filter(i => i.mode === 'cardio').reduce((sum, i) => sum + i.min * 60, 0);
  return Math.ceil(seconds / 300) * 5;
}

export function validateProgram(p, catalogueIds) {
  const errors = [], blockers = [];
  const ids = new Set(catalogueIds);
  const error = (where, text) => errors.push(`${where}: ${text}`);
  const block = (where, text) => blockers.push(`${where}: ${text}`);
  const positive = n => Number.isFinite(n) && n > 0;
  const session = (s, where) => {
    if (!s.items.length) error(where, 'Session has nothing in it');
    for (const i of s.items) {
      if (!i.ex) block(where, 'Exercise has no catalogue mapping');
      else if (!ids.has(i.ex)) error(where, `Unknown exercise ${i.ex}`);
      if (i.mode === 'cardio') {
        if (!positive(i.min)) error(where, 'Minutes must be positive');
        if (i.intensity === 'interval') {
          if (!i.intervals) block(where, 'Interval cardio needs a correction (P0.1)');
          else {
            const v = i.intervals;
            if (['warmup', 'hard', 'easy', 'cooldown'].some(k => !positive(v[k])) || !Number.isInteger(v.rounds) || v.rounds < 1) error(where, 'Invalid interval segments');
            if (!Number.isFinite(intervalMinutes(v)) || Math.abs(intervalMinutes(v) - i.min) > 1e-9) block(where, 'Interval segments do not add up to minutes');
          }
        }
      } else {
        if (!['reps', 'time'].includes(i.mode)) error(where, 'Unknown item mode');
        if (!Number.isInteger(i.sets) || i.sets < 1) error(where, 'Sets must be at least 1');
        const range = i.mode === 'time' ? i.sec : i.reps;
        if (!Array.isArray(range) || range.length !== 2 || !range.every(positive) || range[0] > range[1]) error(where, 'Invalid reps or seconds range');
        if ((i.mode === 'reps' || i.rir !== undefined) && (!Number.isFinite(i.rir) || i.rir < 0 || i.rir > 5)) error(where, 'RIR must be between 0 and 5');
        if (!positive(i.rest)) error(where, 'Rest seconds must be positive');
      }
    }
    if (s.items.every(i => i.mode !== 'time' || Array.isArray(i.sec)) && estimateMinutes(s) > p.statedMinutes + 10) block(where, `Estimated ${estimateMinutes(s)} minutes exceeds stated ${p.statedMinutes} by more than 10 (P1.6)`);
  };
  if (p.plan.length !== p.weeks) error(p.id, 'Week count does not match weeks');
  if (new Set(p.templates.map(t => t.id)).size !== p.templates.length) error(p.id, 'Duplicate template');
  p.templates.forEach(t => session(t, t.name));
  const seen = new Set();
  for (const w of p.plan) {
    if (!Number.isInteger(w.week) || w.week < 1 || w.week > p.weeks || seen.has(w.week)) error(p.id, 'Invalid or duplicate week');
    seen.add(w.week);
    const keys = Object.keys(w.items);
    if (keys.length !== p.days) error(`Week ${w.week}`, 'Sessions per week do not match days');
    if (Object.keys(w.cardio).length !== keys.length || Object.keys(w.cardio).some(id => !keys.includes(id))) error(`Week ${w.week}`, 'Cardio session keys differ');
    for (const id of keys) {
      const t = p.templates.find(t => t.id === id);
      const where = `Week ${w.week}, ${t?.name || id}`;
      if (!t) { error(where, 'Unknown template'); continue; }
      if (w.items[id].length !== t.items.filter(i => i.mode !== 'cardio').length || w.cardio[id]?.length !== t.items.filter(i => i.mode === 'cardio').length) error(where, 'Weekly item count differs from template');
      session(sessionForWeek(p, w, id), where);
    }
  }
  return { errors: [...new Set(errors)], blockers: [...new Set(blockers)] };
}

const entryFor = (p, review) => review?.programs?.[p.id] ?? review?.[p.id] ?? review;
export const isVisible = (p, review) => entryFor(p, review)?.status !== 'retired';
export const reviewed = (p, review) => entryFor(p, review)?.status === 'approved' && canApprove(p, entryFor(p, review));
export function canApprove(program, reviewEntry) {
  return !!(reviewEntry?.reviewer?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(reviewEntry?.date)
    && !Number.isNaN(Date.parse(reviewEntry.date))
    && new Date(reviewEntry.date).toISOString().slice(0, 10) === reviewEntry.date && reviewEntry.version === program.version
    && Array.isArray(program.blockers) && program.blockers.length === 0);
}

export const approaches = {
  double_progression: 'Build repetitions within the range before adding load when performance allows.',
  strength_submax: 'Submaximal strength practice with accessory work. See the program notes for progression.',
  hybrid_dual: 'Strength practice and aerobic training with separate progression.',
  cardio_duration: 'Planned weekly aerobic duration changes. Tolerance still determines whether to progress.',
};
