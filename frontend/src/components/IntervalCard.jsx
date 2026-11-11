// The interval timer on a cardio exercise (lib/intervals.js): set up warm-up, rounds of hard and
// easy and cool-down, run them with a sound and a buzz at every change, and the cardio row is
// logged with the minutes and the rounds done. The run lives on the entry (`ivRun`) as wall-clock
// times, so leaving the app or locking the phone loses nothing; the cues need the screen awake.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { beep, alertBuzz } from '../lib/sound.js'
import {
  DEFAULT_INTERVALS, cleanIntervals, segmentsOf, totalSec, elapsedSec, positionAt, skipSegment, loggedRun,
  fmtClock, intervalSummary, loggedSummary, segmentName, logIntervalRun,
} from '../lib/intervals.js'
import Icon from './Icon.jsx'
import { Button, Stepper, Switch } from './ui.jsx'

const FIELDS = [
  ['warmup', 'Warm-up', 'min', 0.5], ['hard', 'Hard', 'min', 0.25], ['easy', 'Easy', 'min', 0.25],
  ['rounds', 'Rounds', '', 1], ['cooldown', 'Cool-down', 'min', 0.5],
]

function Editor({ entry, entryIdx, onClose }) {
  const update = useStore(s => s.update)
  const [v, setV] = useState(() => cleanIntervals(entry.target?.intervals) || { ...DEFAULT_INTERVALS })
  const [routineToo, setRoutineToo] = useState(false)
  const save = plan => {
    update(s => {
      const e = s.active?.entries?.[entryIdx]
      if (!e || e.id !== entry.id) return
      if (plan) e.target.intervals = plan
      else delete e.target.intervals
      if (routineToo && e.rid) {
        const cfg = (s.routines || []).find(r => r.id === e.rid)?.ex?.find(c => c?.id === e.id)
        if (cfg) { if (plan) cfg.intervals = plan; else delete cfg.intervals }
      }
    })
    onClose()
  }
  const total = totalSec(segmentsOf(v)) / 60
  return <div className="iv-edit">
    {FIELDS.map(([k, label, unit, step]) => <Stepper key={k} label={t(label)} unit={unit ? t(unit) : undefined} ariaLabel={t(label)}
      value={v[k]} step={step} min={k === 'rounds' ? 1 : k === 'hard' ? 0.25 : 0} max={k === 'rounds' ? 50 : 60} decimal={k !== 'rounds'}
      onChange={n => setV(cur => cleanIntervals({ ...cur, [k]: n }) || cur)} />)}
    <p className="muted small">{t('{0} in all.', fmtClock(total * 60))}</p>
    {entry.rid && <label className="row between iv-routine">
      <span>{t('Use in this routine too')}</span>
      <Switch aria-label={t('Use in this routine too')} checked={routineToo} onChange={setRoutineToo} />
    </label>}
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      <Button size="sm" variant="primary" onClick={() => save(cleanIntervals(v))}>{t('Save intervals')}</Button>
      {entry.target?.intervals && <Button size="sm" onClick={() => save(null)}>{t('No intervals')}</Button>}
      <Button size="sm" variant="ghost" onClick={onClose}>{t('Cancel')}</Button>
    </div>
  </div>
}

export default function IntervalCard({ entryIdx, readOnly = false }) {
  const update = useStore(s => s.update)
  const entry = useStore(s => s.S.active?.entries?.[entryIdx])
  const sound = useStore(s => s.S.sound)
  const [editing, setEditing] = useState(false)
  const [, tick] = useState(0)
  const plan = cleanIntervals(entry?.target?.intervals)
  const key = JSON.stringify(plan)
  const segs = useMemo(() => segmentsOf(plan), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const run = entry?.ivRun || null
  const running = !!run && !(run.pausedAt > 0)
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => tick(n => n + 1), 250)
    return () => clearInterval(id)
  }, [running, run?.at])
  const sec = elapsedSec(run)
  const pos = positionAt(segs, sec)
  const total = totalSec(segs)

  // Cues: a short beep in the last three seconds of a segment, a chime and a buzz as the next
  // starts (higher into a hard one). Heard only while the screen is on, like the rest timer's.
  const seen = useRef({ index: null, left: null })
  useEffect(() => {
    const was = seen.current
    const left = Math.ceil(pos.left)
    if (running && was.index != null && pos.index !== was.index) {
      const hard = pos.seg?.kind === 'hard'
      beep(sound, hard ? 1046 : 784, 0.22); beep(sound, hard ? 1318 : 988, 0.22, 0.25)
      alertBuzz(hard ? [250, 100, 250] : [200])
    } else if (running && was.index === pos.index && left !== was.left && left > 0 && left <= 3) beep(sound, 660, 0.1)
    seen.current = { index: pos.index, left }
  })
  // The last segment ran out: the row is logged with the whole plan.
  useEffect(() => {
    if (!run || !pos.done) return
    update(s => { logIntervalRun(s, entryIdx, total) })
    useUI.getState().toast(t('Intervals logged'))
  }, [pos.done, !!run]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return null
  const loggedRow = entry.sets?.find(x => x.done && x.iv)
  if (editing) return <div className="iv-card"><Editor entry={entry} entryIdx={entryIdx} onClose={() => setEditing(false)} /></div>
  if (!plan) {
    if (readOnly || loggedRow) return null
    return <div className="iv-row"><button type="button" className="chip" onClick={() => setEditing(true)}><Icon name="timer" />{t('Set up intervals')}</button></div>
  }
  if (!run) {
    return <div className="iv-card">
      <div className="iv-plan"><Icon name="timer" /><span>{intervalSummary(plan)} · {fmtClock(total)}</span></div>
      {loggedRow ? <>
        <p className="muted small">{t('Logged: {0}', loggedSummary(loggedRow.iv))}</p>
        <Stepper label={t('Rounds done')} ariaLabel={t('Rounds done')} value={loggedRow.iv.done || 0} step={1} min={0} max={plan.rounds} decimal={false}
          onChange={n => update(s => {
            const e = s.active?.entries?.[entryIdx]
            const row = e && e.id === entry.id ? e.sets.find(x => x.done && x.iv) : null
            if (row) row.iv = { ...row.iv, done: Math.max(0, Math.min(plan.rounds, Math.round(n))) }
          })} />
      </>
        : !readOnly && <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Button size="sm" variant="primary" icon="play" onClick={() => update(s => {
            const e = s.active?.entries?.[entryIdx]
            if (e && e.id === entry.id) e.ivRun = { at: Date.now(), paused: 0 }
          })}>{t('Start intervals')}</Button>
          <Button size="sm" onClick={() => setEditing(true)}>{t('Change')}</Button>
        </div>}
    </div>
  }
  const set = fn => update(s => {
    const e = s.active?.entries?.[entryIdx]
    if (e && e.id === entry.id && e.ivRun) e.ivRun = fn(e.ivRun, Date.now())
  })
  const next = segs[pos.index + 1]
  return <div className={'iv-card running iv-' + (pos.seg?.kind || 'done')} role="timer" aria-live="off">
    <div className="iv-now">
      <span className="iv-name">{segmentName(pos.seg, plan.rounds)}</span>
      <span className="iv-left">{fmtClock(pos.left)}</span>
    </div>
    <div className="wprog iv-prog"><i style={{ width: (total ? Math.min(100, sec / total * 100) : 0) + '%' }} /></div>
    <p className="muted small">{next ? t('Next: {0}, {1}', segmentName(next, plan.rounds), fmtClock(next.sec)) : t('Last one')} · {t('{0} to go', fmtClock(total - sec))}</p>
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      {run.pausedAt > 0
        ? <Button size="sm" variant="primary" icon="play" onClick={() => set((r, now) => ({ at: r.at, paused: (r.paused || 0) + (now - r.pausedAt) }))}>{t('Resume')}</Button>
        : <Button size="sm" icon="pause" onClick={() => set((r, now) => ({ ...r, pausedAt: now }))}>{t('Pause')}</Button>}
      <Button size="sm" icon="skipForward" onClick={() => set((r, now) => skipSegment(r, segs, now))}>{t('Skip')}</Button>
      <Button size="sm" icon="check" onClick={() => { update(s => { logIntervalRun(s, entryIdx, elapsedSec(s.active?.entries?.[entryIdx]?.ivRun)) }); useUI.getState().toast(t('Intervals logged')) }}>{t('Finish now')}</Button>
    </div>
  </div>
}
