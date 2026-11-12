// Simple mode's first screen (docs/superpowers/specs/2026-11-12-simple-mode-design.md): a
// notebook page per day. Add an exercise, type the weight and reps of a set, tap Add. It is saved
// as you go, so logging at the gym and typing it in afterwards are the same thing. The arrows move
// to another day. The writing itself is lib/day-log.js.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import {
  dayLogOf, otherWorkoutsOn, earlierDays, addSet, updateSet, removeSet, removeExercise, lastTimeFor,
  nextSetFor, logModeOf, yourExercises, hasValue,
} from '../lib/day-log.js'
import { EXIDX, allExercises, searchExercises } from '../lib/exercises.js'
import { fmtDate, todayISO, isoOf, exerciseNameText, fmtNum } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import { isFav, toggleFav } from '../lib/favourites.js'
import { exercisePicker, workoutDetailSheet, confirmSheet } from '../sheets.jsx'
import { Button, NumberField, SearchField } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'

const nameOf = id => (EXIDX[id] ? exerciseNameText(EXIDX[id]) : String(id))

// A set as a person writes it down: "80 kg × 8", "45 s", "20 min". No effort or other extras.
function fmtSet(set, mode, unit) {
  if (mode === 'cardio') return fmtNum(set.min || 0) + ' ' + t('min')
  const w = Number(set.w) > 0 ? fmtNum(set.w) + ' ' + unit : null
  if (mode === 'time') return [w, fmtNum(set.sec || 0) + ' ' + t('sec')].filter(Boolean).join(' × ')
  return (w ? w + ' × ' : '') + fmtNum(set.r || 0) + (w ? '' : ' ' + t('reps'))
}

const shiftDay = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

// What a set row asks for, by how the exercise is logged.
function fieldsOf(mode, unit) {
  if (mode === 'cardio') return [{ k: 'min', label: t('min'), decimal: true }]
  if (mode === 'time') return [{ k: 'w', label: unit, decimal: true }, { k: 'sec', label: t('sec'), decimal: false }]
  return [{ k: 'w', label: unit, decimal: true }, { k: 'r', label: t('reps'), decimal: false }]
}

function SetFields({ mode, unit, value, onChange, onEnter }) {
  return <div className="tl-fields">
    {fieldsOf(mode, unit).map((f, i) => <label key={f.k} className="tl-field">
      {i > 0 && <span className="tl-x" aria-hidden="true">×</span>}
      <NumberField value={value[f.k] ?? null} nullable decimal={f.decimal} aria-label={f.label}
        onChange={v => onChange({ ...value, [f.k]: v })}
        onKeyDown={e => { if (e.key === 'Enter') onEnter?.() }} />
      <span className="tl-unit">{f.label}</span>
    </label>)}
  </div>
}

// A logged set: its line, or, tapped, the same fields to change it.
function LoggedSet({ n, id, set, mode, unit, iso }) {
  const update = useStore(s => s.update)
  const [draft, setDraft] = useState(null)
  if (!draft) return <div className="tl-set" {...tappable(() => setDraft({ ...set }))} aria-label={t('Edit set {0}', n)}>
    <span className="tl-n">{n}</span>
    <span className="tl-val">{fmtSet(set, mode, unit)}</span>
    <Icon name="pencil" className="tl-edit" />
  </div>
  const save = () => { update(s => { updateSet(s, iso, id, n - 1, draft) }); setDraft(null) }
  return <div className="tl-set editing">
    <span className="tl-n">{n}</span>
    <SetFields mode={mode} unit={unit} value={draft} onChange={setDraft} onEnter={save} />
    <button className="iconbtn sm" onClick={save} aria-label={t('Save')}><Icon name="check" /></button>
    <button className="iconbtn sm" onClick={() => { update(s => { removeSet(s, iso, id, n - 1) }); setDraft(null) }} aria-label={t('Delete set')}><Icon name="trash" /></button>
  </div>
}

function ExerciseCard({ S, iso, id, entry, onDrop }) {
  const update = useStore(s => s.update)
  const mode = logModeOf(id, entry?.target)
  const [next, setNext] = useState(() => nextSetFor(S, iso, id))
  const last = lastTimeFor(S, id, iso)
  const sets = entry?.sets || []
  const add = () => {
    if (!hasValue(next, mode)) { useUI.getState().toast(mode === 'reps' ? t('Type the reps first') : t('Type how long first')); return }
    update(s => { addSet(s, iso, id, next) })
    // The next row starts from the one just logged: most sets repeat the last.
    setNext({ ...next })
  }
  const drop = () => {
    if (!sets.length) { onDrop(id); return }
    confirmSheet({ title: t('Remove {0}?', nameOf(id)), message: tn('Its {0} set goes too.', 'Its {0} sets go too.', sets.length), confirmText: t('Remove'), danger: true, onConfirm: () => update(s => { removeExercise(s, iso, id) }) })
  }
  return <div className="card tl-card" data-ex={id}>
    <div className="row between tl-head">
      <h3 className="tl-name">{nameOf(id)}</h3>
      <button className="iconbtn sm" onClick={drop} aria-label={t('Remove {0}', nameOf(id))}><Icon name="xmark" /></button>
    </div>
    {last && <div className="tl-last small">{t('Last time ({0}):', fmtDate(last.d, true))} {last.sets.map(x => fmtSet(x, mode, S.unit)).join(', ')}</div>}
    {sets.map((x, i) => <LoggedSet key={i} n={i + 1} id={id} set={x} mode={mode} unit={S.unit} iso={iso} />)}
    <div className="tl-set tl-new">
      <span className="tl-n">{sets.length + 1}</span>
      <SetFields mode={mode} unit={S.unit} value={next} onChange={setNext} onEnter={add} />
      <Button size="sm" variant="primary" icon="plus" onClick={add}>{t('Add')}</Button>
    </div>
  </div>
}

// Common lifts for someone who has logged nothing yet, found by name so the list survives id changes.
const STARTERS = ['barbell bench press', 'barbell full squat', 'barbell deadlift', 'lever seated fly', 'cable pulldown', 'dumbbell bench press', 'lever leg extension', 'dumbbell biceps curl']

function PickerRow({ S, ex, onPick }) {
  const update = useStore(s => s.update)
  const fav = isFav(S, ex.id)
  const best = S.exWeights?.[ex.id]?.w
  // Two buttons side by side, not a tappable row holding a button (design-review.test.js).
  return <div className="lrow tl-pick">
    <button type="button" className="lrow-m tl-pick-main" onClick={() => onPick(ex.id)}>
      <span className="lrow-t">{exerciseNameText(ex)}</span>
      {best > 0 && <span className="lrow-s">{t('Best')} {fmtNum(best)} {S.unit}</span>}
    </button>
    <button type="button" className={'iconbtn sm tl-star' + (fav ? ' on' : '')} aria-pressed={fav} aria-label={fav ? t('Remove from favourites') : t('Add to favourites')}
      onClick={() => update(s => { toggleFav(s, ex.id) })}><Icon name={fav ? 'starFill' : 'star'} /></button>
  </div>
}

function SimplePicker({ close, onPick }) {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const all = allExercises(S)
  const pick = id => { close(); onPick(id) }
  const yours = yourExercises(S).map(id => EXIDX[id]).filter(Boolean)
  const starters = yours.length ? [] : STARTERS.map(n => all.find(e => e.n === n)).filter(Boolean)
  const hits = q.trim() ? searchExercises(all, q).slice(0, 40) : null
  return <>
    <h3>{t('Add exercise')}</h3>
    <SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t('Search exercises')} aria-label={t('Search exercises')} autoFocus />
    <div style={{ height: 10 }} />
    {hits ? (hits.length
      ? <div className="list">{hits.map(ex => <PickerRow key={ex.id} S={S} ex={ex} onPick={pick} />)}</div>
      : <div className="muted small">{t('No exercise matches “{0}”.', q.trim())}</div>)
      : <>
        <h4 className="sec">{yours.length ? t('Your exercises') : t('Popular')}</h4>
        <div className="list">{(yours.length ? yours : starters).map(ex => <PickerRow key={ex.id} S={S} ex={ex} onPick={pick} />)}</div>
        <div className="muted small tl-hint">{t('Tap the star to keep an exercise at the top.')}</div>
      </>}
    <div style={{ height: 12 }} />
    <Button variant="ghost" trailingIcon="chevronRight" onClick={() => { close(); exercisePicker(ex => { useUI.getState().closeAll(); if (ex?.id != null) onPick(ex.id) }, { title: t('All exercises') }) }}>{t('Browse all, or create your own')}</Button>
  </>
}

export default function Today() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const raw = params.get('d')
  const iso = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today
  const go = d => setParams(d === today ? {} : { d }, { replace: true })
  // Exercises added but not logged yet: only on this screen until their first set.
  const [pending, setPending] = useState({})
  const log = dayLogOf(S, iso)
  const logged = (log?.entries || []).map(e => e.id)
  const ids = [...logged, ...(pending[iso] || []).filter(id => !logged.includes(id))]
  const others = otherWorkoutsOn(S, iso)
  const earlier = earlierDays(S, iso)
  const addEx = () => useUI.getState().openSheet(close => <SimplePicker close={close} onPick={id => setPending(p => ({ ...p, [iso]: [...new Set([...(p[iso] || []), id])] }))} />)
  const dropPending = id => setPending(p => ({ ...p, [iso]: (p[iso] || []).filter(x => x !== id) }))
  const title = iso === today ? t('Today') : iso === shiftDay(today, -1) ? t('Yesterday') : fmtDate(iso, true)

  return <div className="daylog">
    <div className="hdr">
      <div><h1>{title}</h1><div className="sub">{iso === today ? fmtDate(iso, true) : t('Filling in a past day')}</div></div>
      <div className="hdr-actions">
        <button className="iconbtn" onClick={() => go(shiftDay(iso, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
        <button className="iconbtn" onClick={() => go(shiftDay(iso, 1))} disabled={iso >= today} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
        <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
      </div>
    </div>

    {others.map(w => <div key={w.id || w.start} className="card tl-other" {...tappable(() => workoutDetailSheet(w))}>
      <div className="small dim">{t('Also logged this day')}</div>
      <div className="tl-name">{w.name}</div>
      <div className="small dim">{(w.entries || []).map(e => nameOf(e.id)).join(', ')}</div>
    </div>)}

    {ids.map(id => <ExerciseCard key={iso + ':' + id} S={S} iso={iso} id={id} entry={log?.entries.find(e => e.id === id)} onDrop={dropPending} />)}

    {!ids.length && !others.length && <div className="tl-empty muted">{iso === today
      ? t('Nothing logged yet today. Add the first exercise you are doing, or did.')
      : t('Nothing logged on this day.')}</div>}

    <Button variant="primary" icon="plus" className="tl-add" onClick={addEx}>{t('Add exercise')}</Button>

    {earlier.length > 0 && <>
      <div className="row between stats-list-h">
        <h4 className="sec" style={{ margin: 0 }}>{t('Earlier')}</h4>
        <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('See all')}</Button>
      </div>
      <div className="list">{earlier.map(({ d, workouts }) => <div key={d} className="lrow tap" {...tappable(() => go(d))}>
        <span className="lrow-m"><span className="lrow-t">{fmtDate(d, true)}</span>
          <span className="lrow-s">{[...new Set(workouts.flatMap(w => (w.entries || []).map(e => nameOf(e.id))))].join(', ')}</span></span>
        <Icon name="chevronRight" className="lrow-c" />
      </div>)}</div>
    </>}
  </div>
}
