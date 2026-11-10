// Trophies (PLAN.md Phase 7 item 7). Pure rules; social/index.js stores them and decides who sees them.
//
//   Trophy = { id, kind, at, groupId?, week?, value? }
//   kinds:  week-<metric>        won a group's week (rank 1, ties all win), groupId + week
//           workouts-<n>         1, 10, 50, 100, 250 workouts in all
//           streak-<n>           4, 12, 26, 52 weeks in a row (best run)
//           records-<n>          1, 10, 50 personal records in all
//           <lift>-<ratio>       estimated 1RM at a multiple of body weight
// A milestone trophy belongs to the metric it measures, and is seen only by groups that person
// shares that metric with; a week trophy is seen by its own group.
export const WEEK_METRICS = { workouts: 'workoutsWeek', volume: 'volumeWeekKg', steps: 'stepsWeek', activeMinutes: 'activeMinutesWeek' };
export const MILESTONES = [
  ...[1, 10, 50, 100, 250].map(n => ({ kind: `workouts-${n}`, metric: 'workouts', test: s => s.workoutsAll >= n })),
  ...[4, 12, 26, 52].map(n => ({ kind: `streak-${n}`, metric: 'streak', test: s => s.bestStreakWeeks >= n })),
  ...[1, 10, 50].map(n => ({ kind: `records-${n}`, metric: 'prs', test: s => (s.prsAll || 0) >= n })),
  ...[['squat', [1, 1.5, 2]], ['bench', [0.75, 1, 1.25]], ['deadlift', [1.25, 1.75, 2.25]]].flatMap(([lift, ratios]) =>
    ratios.map(r => ({ kind: `${lift}-${r}`, metric: 'strength', test: s => (s.strength?.[lift] || 0) >= r }))),
];

/** The metric a trophy belongs to (for who may see it). */
export function metricOf(kind) {
  if (kind.startsWith('week-')) return kind.slice(5);
  return MILESTONES.find(m => m.kind === kind)?.metric || null;
}

/** Milestones this summary has reached that aren't held yet. */
export function newMilestones(summary, held, at) {
  const have = new Set(held.map(t => t.kind));
  return MILESTONES.filter(m => !have.has(m.kind) && summary && m.test(summary)).map(m => ({ id: m.kind, kind: m.kind, at }));
}

/**
 * The winners of a finished week in one group: for each metric, the members who share it with
 * the group and have the top value (above zero); ties all win. `snapshot` is { uid: { workoutsWeek, ... } }.
 */
export function weekWinners(snapshot, sharing, { groupId, week, at }) {
  const out = [];
  for (const [metric, field] of Object.entries(WEEK_METRICS)) {
    const rows = Object.entries(snapshot || {}).filter(([uid, v]) => sharing(uid, metric) && Number(v?.[field]) > 0).map(([uid, v]) => [uid, Number(v[field])]);
    if (!rows.length) continue;
    const top = Math.max(...rows.map(r => r[1]));
    for (const [uid, value] of rows) if (value === top) out.push({ uid, trophy: { id: `week-${metric}:${groupId}:${week}`, kind: `week-${metric}`, groupId, week, value, at } });
  }
  return out;
}
