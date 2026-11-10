import { uid } from './format.js'
import { t } from './i18n-core.js'

export const intervalNote = i => t('{0} min easy, {1} rounds of {2} min hard (RPE {3}) and {4} min easy, {5} min easy', i.warmup, i.rounds, i.hard, i.hardRpe, i.easy, i.cooldown)

// The library numbers days 1 (Monday) to 7 (Sunday); a programme's weekdays are getDay(), 0 Sunday.
export const weekdayOf = day => ((Number(day) % 7) + 7) % 7

// Builds an independent copy. The caller owns persistence and whether to start it. Routine slots
// carry only what a routine holds (sets, reps range, rest, side, a hold's seconds, cardio minutes);
// the week-by-week sets, RIR and cardio minutes live on the programme's weeks.
export function buildLibraryProgram(program, makeId = uid, now = Date.now()) {
  const routines = program.templates.map(template => ({
    id: makeId(), name: template.name,
    ex: template.items.map(i => ({ id: i.ex, mode: i.mode,
      ...(i.mode === 'cardio' ? { sets: 1, min: i.min } : {
        sets: i.sets, rest: i.rest, weight: 0,
        // A one-side exercise's reps are per side in the library (8 to 12 a leg); a routine logs the
        // total of both sides (lib/history.js isPerSide), so they double here.
        ...(i.mode === 'time' ? { sec: i.sec[0] } : { reps: i.reps[1] * (i.side ? 2 : 1), repsMin: i.reps[0] * (i.side ? 2 : 1) }),
        ...(i.side ? { side: true } : {}),
      }),
    })),
  }))
  const days = {}
  program.templates.forEach((template, n) => { (days[weekdayOf(template.day)] ||= []).push(routines[n].id) })
  const weeks = program.plan.map(w => {
    const targets = {}
    program.templates.forEach((template, n) => {
      let lift = 0, cardio = 0
      template.items.forEach(i => {
        const target = i.mode === 'cardio' ? w.cardio[template.id][cardio++] : w.items[template.id][lift++]
        targets[`${routines[n].id}:${i.ex}`] = i.mode === 'cardio'
          ? { min: target.min, ...(target.intervals ? { note: intervalNote(target.intervals) } : {}) }
          // A hold has no reps in reserve: only its sets change week to week.
          : i.mode === 'time' ? { sets: target.sets } : { sets: target.sets, rir: target.rir }
      })
    })
    return { t: targets }
  })
  return { routines, programme: { id: makeId(), name: program.title, at: now, days, weeks,
    src: { lib: program.id, version: program.version } } }
}
