import { t } from '../lib/i18n.js'
import { exerciseNameText } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'
import { intervalMinutes } from '../lib/library.js'
import { fmtSec } from '../lib/history.js'

// A program's sessions as cards (a library template or a built plan, the lib/library.js shape).
// With `onSwap`, each exercise gets a Swap button: onSwap(templateId, itemIndex).
export default function ProgramSessions({ program: p, onSwap }) {
  const range = values => t('{0} to {1}', ...values)
  const interval = i => t('{0} min: {1} easy, {2} × ({3} hard, {4} easy), {5} easy', intervalMinutes(i), i.warmup, i.rounds, i.hard, i.easy, i.cooldown)
  return p.templates.map(template => <section className="card" key={template.id}>
    <h3>{t(template.name)}</h3><p className="small dim">{t(template.warmUp)}</p>
    {template.items.map((i, n) => <div key={n} className="program-exercise">
      <div className="program-exercise-head">
        <strong>{exerciseNameText(exOr(i.ex))}</strong>
        {onSwap && i.mode !== 'cardio' && <button className="btn plain small" onClick={() => onSwap(template.id, n)}
          aria-label={t('Swap {0}', exerciseNameText(exOr(i.ex)))}>{t('Swap')}</button>}
      </div>
      <div>{i.mode === 'cardio' ? (i.intervals ? interval(i.intervals) : t('{0} min easy', i.min)) : <>
        {i.mode === 'time' ? t('{0} × {1} seconds', i.sets, range(i.sec)) : t('{0} × {1} reps', i.sets, range(i.reps))}
        {i.side && t(' per side')}{i.rir != null && t(', RIR {0}', i.rir)}{t(', rest {0}', fmtSec(i.rest))}
      </>}</div>{i.note && <p className="small dim">{t(i.note)}</p>}
    </div>)}
  </section>)
}
