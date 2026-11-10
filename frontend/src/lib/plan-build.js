// Build my plan (EG Plan Model v1, docs/superpowers/specs/2026-11-10-plan-builder-design.md): from
// the questionnaire's answers, a personal 8-week plan drawn from the whole catalogue, in the shape
// the program library uses (lib/library.js), so lib/library-start.js turns it into routines and a
// programme like any template. Pure and deterministic: the same answers, model version and seed
// always give the same plan; a new seed changes only near-tied exercise picks.
import { INDEX, BY_PATTERN } from './exercise-index-data.js'
import { personOf } from './plan-person.js'
import { estimateMinutes } from './library.js'
import { t } from './i18n-core.js'
import * as R from './plan-model.js'

const EQ_DUMBBELLS = ['dumbbell', 'body weight']
const EQ_NONE = ['body weight']

export function allowedEquipment(equipment) {
  if (Array.isArray(equipment)) return new Set([...equipment, 'body weight'])
  if (equipment === 'dumbbells') return new Set(EQ_DUMBBELLS)
  if (equipment === 'none') return new Set(EQ_NONE)
  return null // a full gym: everything
}

// A small deterministic PRNG (mulberry32) from a string key.
function rand(key) {
  let h = 1779033703 ^ key.length
  for (let i = 0; i < key.length; i++) { h = Math.imul(h ^ key.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  a |= 0; a = (a + 0x6d2b79f5) | 0
  let x = Math.imul(a ^ (a >>> 15), 1 | a)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

const hashOf = v => { const s = JSON.stringify(v); let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) }

function familiarSet(S) {
  const out = new Set()
  for (const w of S?.workouts || []) for (const e of w.entries || []) if (e?.id) out.add(e.id)
  return out
}

/** Score one exercise for a slot; null when it is not allowed. */
function scoreOf(id, slot, person, ctx) {
  const e = INDEX[id]
  if (!e) return null
  if (ctx.allowed && !ctx.allowed.has(e.eq)) return null
  if (e.stress.some(s => person.avoid.includes(s))) return null
  if (slot.role === 'main' && e.skill > R.SKILL_OF_LEVEL[person.level] + 1) return null
  if (ctx.sessionIds.has(id)) return null
  const reasons = []
  let score = R.WEIGHTS[e.tier] ?? 0
  if (e.tier === 'core') reasons.push(t('A standard, well-known exercise'))
  if (e.compound && (person.emphasis === 'gain' || person.emphasis === 'strength' || person.level === 'novice')) { score += R.WEIGHTS.compound; reasons.push(t('Works several big muscles at once')) }
  const want = person.emphasis === 'strength' && slot.role === 'main' ? 3 : person.level === 'novice' ? 1 : person.level === 'intermediate' ? 2 : 3
  if (Math.abs(e.skill - want) <= (person.level === 'novice' ? 1 : 0) || (person.level !== 'novice' && e.skill >= want)) { score += R.WEIGHTS.skillFit; reasons.push(person.level === 'novice' ? t('Easy to learn and to load safely') : t('Suits your experience')) }
  if (!ctx.allowed) score += R.GYM_PREFERENCE[e.eq] ?? 0
  if (ctx.familiar.has(id)) { score += R.WEIGHTS.familiar; reasons.push(t('You have done it before')) }
  if (ctx.favourites.has(id)) { score += R.WEIGHTS.favourite; reasons.push(t('One of your favourites')) }
  if (ctx.weekPatternEq.has(`${slot.pattern}|${e.eq}`)) score += R.WEIGHTS.repeatEquipPattern
  if (ctx.weekIds.has(id)) score += R.WEIGHTS.repeatEquipPattern
  score += rand(`${ctx.seed}|${ctx.slotKey}|${id}`) * R.WEIGHTS.jitter
  return { id, score, reasons, entry: e }
}

function candidates(slot, person, ctx) {
  const ids = BY_PATTERN[slot.pattern] || []
  const tiers = slot.role === 'main' ? [['core'], ['core', 'common'], ['core', 'common', 'variant']] : [['core', 'common'], ['core', 'common', 'variant']]
  for (const allowedTiers of tiers) {
    const scored = ids.filter(id => allowedTiers.includes(INDEX[id].tier)).map(id => scoreOf(id, slot, person, ctx)).filter(Boolean)
    if (scored.length) return scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
  }
  return []
}

function repsFor(slot, entry, person) {
  if (entry.pattern === 'core' || entry.pattern === 'corerot' || entry.pattern === 'carry') return R.CORE_REPS
  const table = R.REPS[person.emphasis] || R.REPS.general
  if (slot.role === 'main') return person.emphasis === 'strength' && person.level === 'novice' ? R.NOVICE_STRENGTH_MAIN : table.main
  return R.ISOLATION.has(entry.pattern) ? table.isolation : table.accessory
}

function restFor(slot, entry, person) {
  let rest = slot.role === 'main' ? (person.emphasis === 'strength' ? R.REST.strengthMain : R.REST.main)
    : R.ISOLATION.has(entry.pattern) || entry.pattern === 'core' || entry.pattern === 'corerot' ? (person.sex === 'female' ? R.REST.femaleIsolation : R.REST.isolation) : R.REST.accessory
  if (person.older && entry.compound) rest += R.REST.extraForOlder
  return rest
}

const isSided = (entry, id) => entry.pattern === 'lunge' || /one arm|single|one leg|unilateral/.test(String(id))

function itemFor(pick, slot, person) {
  const e = pick.entry
  const sets = R.SETS[person.level][slot.role]
  if (e.hold) return { ex: pick.id, mode: 'time', sets, sec: [...R.HOLD_SECONDS[person.level]], rest: restFor(slot, e, person) }
  const [lo, hi] = repsFor(slot, e, person)
  const side = isSided(e, pick.id)
  // Reps are per side for a one-side exercise, as in the library; lib/library-start.js doubles them.
  return { ex: pick.id, mode: 'reps', sets, reps: [lo, hi], rir: 2, rest: restFor(slot, e, person), ...(side ? { side: true } : {}) }
}

const fits = (items, minutes) => minutes >= 90 || estimateMinutes({ items }) <= minutes + R.SESSION_GAP_MIN

/** The sets and RIR of one item in a given week. */
export function weekTarget(item, slot, person, week) {
  const base = item.sets
  const phase = week <= 2 ? 'start' : 'block'
  let rir = R.RIR[phase][person.level][slot.role]
  if (phase === 'block' && person.emphasis === 'strength' && slot.role === 'main') rir = R.RIR.strengthMain
  let sets = base
  if (week <= 2 && (person.level === 'novice' || person.older)) sets = Math.max(1, base - 1)
  if (week === R.WEEKS) { sets = Math.max(1, base - 1); rir = Math.min(5, rir + R.RIR.lighter) }
  return item.mode === 'time' ? { sets, rir } : { sets, rir }
}

/**
 * The plan for these answers. `S` (optional) is the store state, for exercises you have logged
 * and your favourites. Returns null for a health answer of yes (the screen sends them to a
 * professional instead).
 */
export function buildPlan(answers, { seed = 1, S = null } = {}) {
  if (answers?.health === true) return null
  const person = personOf(answers)
  const types = R.SPLITS[person.days][person.level]
  const allowed = allowedEquipment(person.equipment)
  const rationale = []
  const add = (rule, text, source) => rationale.push({ rule, text, ...(source ? { source } : {}) })

  // Focus areas add an accessory slot to the first session that trains that region.
  const slotsByType = types.map(type => R.SESSIONS[type].slots.map(s => ({ ...s })))
  for (const f of person.focus) {
    const pattern = R.FOCUS_SLOTS[f]
    const at = slotsByType.findIndex(slots => slots.some(s => R.MUSCLES[s.pattern].some(m => R.MUSCLES[pattern].includes(m))))
    const slots = slotsByType[at >= 0 ? at : 0]
    // Already in that session: one more set on it rather than the same movement twice.
    const same = slots.find(s => s.pattern === pattern && !s.focus)
    if (same) same.focus = f
    else slots.push({ pattern, role: 'accessory', focus: f })
  }

  // A novice gaining weight or strength spends the time on compounds: few isolation exercises.
  let compoundFirst = false
  if (person.level === 'novice' && (person.emphasis === 'gain' || person.emphasis === 'strength')) {
    for (const slots of slotsByType) {
      let kept = 0
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].role !== 'accessory' || !R.ISOLATION.has(slots[i].pattern) || slots[i].focus) continue
        if (kept++ >= R.NOVICE_COMPOUND_ISOLATION_CAP) slots.splice(i--, 1)
      }
    }
    compoundFirst = true
  }

  const ctx = { seed, allowed, familiar: familiarSet(S), favourites: new Set(S?.favEx || []), weekIds: new Set(), weekPatternEq: new Set() }
  let trimmed = false
  const templates = types.map((type, n) => {
    const sessionIds = new Set()
    const slotsUsed = []
    let items = []
    slotsByType[n].forEach((slot, i) => {
      const [pick] = candidates(slot, person, { ...ctx, sessionIds, slotKey: `${type}|${i}|${slot.pattern}` })
      if (!pick) return
      sessionIds.add(pick.id); ctx.weekIds.add(pick.id); ctx.weekPatternEq.add(`${slot.pattern}|${pick.entry.eq}`)
      const item = itemFor(pick, slot, person)
      if (slot.focus) item.sets = Math.min(R.MAX_SETS, item.sets + 1)
      items.push(item); slotsUsed.push(slot)
    })
    // Fit the time, keeping every muscle the session trains: first drop an extra whose muscles
    // another exercise here already covers, then take fourth sets off, then drop extras, focus last.
    const covered = k => R.MUSCLES[INDEX[items[k].ex].pattern].every(m => items.some((x, i) => i !== k && R.MUSCLES[INDEX[x.ex].pattern].includes(m)))
    const lastWhere = test => { for (let i = slotsUsed.length - 1; i >= 0; i--) if (test(i)) return i; return -1 }
    while (!fits(items, person.minutes)) {
      let drop = lastWhere(i => slotsUsed[i].role === 'accessory' && !slotsUsed[i].focus && covered(i))
      if (drop < 0) {
        const four = lastWhere(i => items[i].sets > 3)
        if (four >= 0) { items[four] = { ...items[four], sets: 3 }; trimmed = true; continue }
      }
      if (drop < 0) drop = lastWhere(i => slotsUsed[i].role === 'accessory' && !slotsUsed[i].focus)
      if (drop < 0) drop = lastWhere(i => slotsUsed[i].role === 'accessory')
      if (drop >= 0 && items.length > 2) { items.splice(drop, 1); slotsUsed.splice(drop, 1); trimmed = true; continue }
      const big = items.reduce((b, it, i) => (it.sets > (items[b]?.sets ?? 0) ? i : b), 0)
      if (items[big].sets <= 2) break
      items[big] = { ...items[big], sets: items[big].sets - 1 }; trimmed = true
    }
    return { type, slots: slotsUsed, items }
  })

  // Weekly volume: bring the big muscle groups up to the level's weekly minimum where time allows,
  // smaller exercises first (research B: enough sets matter more than the split).
  const [minSets] = R.WEEKLY_SETS[person.level]
  for (const muscle of ['chest', 'back', 'legs', 'shoulders']) {
    const weekly = () => templates.reduce((n, tp) => n + tp.items.reduce((k, it) => k + (it.mode !== 'cardio' && R.MUSCLES[INDEX[it.ex].pattern]?.includes(muscle) ? it.sets : 0), 0), 0)
    for (const role of ['accessory', 'main']) for (const tp of templates) tp.items.forEach((it, k) => {
      if (weekly() >= minSets || it.mode === 'cardio' || tp.slots[k].role !== role || it.sets >= R.MAX_SETS) return
      if (!R.MUSCLES[INDEX[it.ex].pattern]?.includes(muscle)) return
      const more = tp.items.map((x, i) => (i === k ? { ...x, sets: x.sets + 1 } : x))
      if (fits(more, person.minutes)) tp.items = more
    })
  }

  templates.forEach(tp => {
    const { slots: slotsUsed } = tp
    let { items } = tp
    if (person.sex === 'female' && !person.older) {
      // One more accessory set where it still fits (women tend to recover faster between sets).
      const i = slotsUsed.findIndex(s => s.role === 'accessory')
      if (i >= 0 && items[i].sets < R.MAX_SETS) {
        const more = items.map((it, k) => (k === i ? { ...it, sets: it.sets + 1 } : it))
        if (fits(more, person.minutes)) items = more
      }
    }
    tp.items = items
  })

  // Cardio for fat loss and for strength and cardio: two easy blocks at the end of the last sessions.
  let cardio = null
  if (person.emphasis === 'recomp' || person.emphasis === 'hybrid' || (person.emphasis === 'general' && (person.bmiBand === 'over' || person.bmiBand === 'obese'))) {
    const min = person.emphasis === 'hybrid' ? R.CARDIO.hybridMin : R.CARDIO.min
    let placed = 0
    for (let n = templates.length - 1; n >= 0 && placed < R.CARDIO.sessions; n--) {
      const withCardio = [...templates[n].items, { ex: R.CARDIO.ex, mode: 'cardio', min, intensity: 'easy' }]
      if (fits(withCardio, person.minutes)) { templates[n].items = withCardio; templates[n].slots.push({ pattern: 'cardio', role: 'cardio' }); placed++ }
    }
    cardio = placed ? 'sessions' : 'steps'
  }

  const days = R.WEEKDAYS[person.days]
  const out = templates.map((tp, n) => ({
    id: `s${n + 1}`, name: R.SESSIONS[tp.type].name(), day: days[n],
    warmUp: t('5 to 8 minutes of easy movement, then two or three lighter sets of the first lift.'),
    items: tp.items,
  }))
  const plan = Array.from({ length: R.WEEKS }, (_, i) => {
    const week = i + 1
    const items = {}, cardioWeeks = {}
    templates.forEach((tp, n) => {
      items[out[n].id] = tp.items.filter(it => it.mode !== 'cardio').map(it => weekTarget(it, tp.slots[tp.items.indexOf(it)], person, week))
      cardioWeeks[out[n].id] = tp.items.filter(it => it.mode === 'cardio').map(it => ({ min: week === R.WEEKS ? Math.round(it.min * 0.75) : it.min }))
    })
    return { week, note: R.weekNote(week), items, cardio: cardioWeeks }
  })
  // The template's own RIR is the full block's; the weeks carry the rest.
  out.forEach((tp, n) => { tp.items = tp.items.map((it, k) => (it.mode === 'reps' ? { ...it, rir: weekTarget(it, templates[n].slots[k], person, 3).rir } : it)) })

  for (const r of person.reasons) add(r.rule, r.text)
  if (compoundFirst) add('compound-first', t('As a newcomer looking to gain, most of your time goes to big compound lifts, with just one smaller exercise per session.'))
  add('split', R.splitReason(person.days, person.level, types), R.SOURCES.acsm)
  if (person.focus.length && !person.reasons.some(r => r.rule === 'sex-emphasis')) add('focus', R.focusReason(person.focus))
  add('reps', R.repsReason(person.emphasis), R.SOURCES.acsm)
  add('rir', R.rirReason(person.level), R.SOURCES.rir)
  add('rest', R.restReason(), R.SOURCES.rest)
  if (cardio) add(cardio === 'sessions' ? 'cardio' : 'cardio-steps', R.cardioReason(cardio), R.SOURCES.who)
  if (trimmed) add('time-cap', R.timeReason(person.minutes))
  if (allowed && allowed.size === 1 && allowed.has('body weight') && (person.emphasis === 'strength' || person.emphasis === 'gain')) add('bodyweight-strength', R.bodyweightReason())
  add('weeks', R.weeksReason())

  const sessionMinutes = plan.flatMap(w => out.map(tp => estimateMinutes({ items: tp.items.map((it, k) => {
    const lift = tp.items.slice(0, k).filter(x => x.mode !== 'cardio').length
    return it.mode === 'cardio' ? { ...it, ...w.cardio[tp.id][k - lift] } : { ...it, ...w.items[tp.id][lift] }
  }) })))
  const equipment = [...new Set(out.flatMap(tp => tp.items.map(it => INDEX[it.ex]?.eq).filter(Boolean)))].sort()
  const goalTitle = { hypertrophy: t('muscle'), recomp: t('muscle and fat loss'), gain: t('weight and muscle'), strength: t('strength'), general: t('general fitness'), hybrid: t('strength and cardio') }[person.emphasis]

  return {
    id: `plan-${seed}-${hashOf(answers)}`, version: String(R.MODEL.version),
    title: t('Your plan: {0}, {1} days', goalTitle, person.days),
    goal: answers.goal, level: [person.level], days: person.days, weeks: R.WEEKS,
    minutes: [Math.min(...sessionMinutes), Math.max(...sessionMinutes)], equipment,
    approach: 'eg_model', notes: R.disclaimer(), source: 'eg-plan-model-1',
    templates: out, plan, rationale: rationale.slice(0, 10),
    model: { ...R.MODEL, seed }, answers, review: { status: 'needs_review' },
  }
}

/** Up to five other exercises for one item of a plan, best first, each with the reasons it scored. */
export function alternativesFor(plan, templateId, itemIndex, { S = null } = {}) {
  const tp = plan?.templates?.find(x => x.id === templateId)
  const item = tp?.items?.[itemIndex]
  const current = INDEX[item?.ex]
  if (!current) return []
  const person = personOf(plan.answers)
  const slot = { pattern: current.pattern, role: itemIndex < 2 && current.compound ? 'main' : 'accessory' }
  const sessionIds = new Set(tp.items.map(it => it.ex))
  const ctx = { seed: plan.model?.seed || 1, allowed: allowedEquipment(person.equipment), familiar: familiarSet(S), favourites: new Set(S?.favEx || []), weekIds: new Set(), weekPatternEq: new Set(), sessionIds, slotKey: `alt|${templateId}|${itemIndex}` }
  return candidates(slot, person, ctx).slice(0, 5).map(c => ({ ex: c.id, score: Math.round(c.score), reasons: c.reasons.length ? c.reasons : [t('Trains the same movement')] }))
}

/** The plan with one item's exercise replaced (sets, reps and rest kept). */
export function swapItem(plan, templateId, itemIndex, ex) {
  return { ...plan, templates: plan.templates.map(tp => (tp.id !== templateId ? tp : {
    ...tp, items: tp.items.map((it, k) => (k === itemIndex ? { ...it, ex, ...(INDEX[ex]?.hold && it.mode === 'reps' ? {} : {}) } : it)),
  })) }
}
