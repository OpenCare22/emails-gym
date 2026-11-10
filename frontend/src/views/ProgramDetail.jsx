import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { exerciseNameText } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'
import { approaches, isVisible, reviewed } from '../lib/library.js'
import { buildLibraryProgram, intervalNote } from '../lib/library-start.js'
import { saveProgramme, startProgramme } from '../lib/programmes.js'
import { confirmSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { usePrograms, ProgramMeta } from './Programs.jsx'
import ProgramSessions from '../components/ProgramSessions.jsx'

export default function ProgramDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, error } = usePrograms()
  const copying = useRef(false)
  const p = data?.find(p => p.id === id && isVisible(p, p.review))
  const copy = start => {
    if (copying.current) return
    const perform = () => {
      if (copying.current) return
      copying.current = true
      const built = buildLibraryProgram(p)
      useStore.getState().update(s => {
        s.routines = [...(s.routines || []), ...built.routines]
        saveProgramme(s, built.programme)
        if (start) startProgramme(s, built.programme.id)
      })
      useUI.getState().toast(start ? t('Started {0}', p.title) : t('Copied {0} to my routines', p.title))
      nav('/plan/prog/' + built.programme.id)
    }
    const S = useStore.getState().S
    if (start && S.programme) confirmSheet({
      title: t('Stop {0} and start {1}?', S.programmes?.[S.programme.id]?.name || t('Programme'), p.title),
      message: t('Your previous plan will be kept and restored when you end the programme.'),
      confirmText: t('Start program'), onConfirm: perform,
    })
    else perform()
  }
  return <div className="narrow program-library">
    <div className="hdr">
      <button className="iconbtn" data-back="/programs" onClick={() => nav('/programs')} aria-label={t('Programs')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}><h1>{p ? t(p.title) : t('Program')}</h1></div>
    </div>
    {error ? <p role="alert">{t('Could not load programs. Please try again.')}</p> : !data ? <p role="status">{t('Loading…')}</p> : !p ? <p>{t('Program not found.')}</p> : <>
      <ProgramMeta program={p} />
      <p>{t(approaches[p.approach])}</p><p>{t(p.notes)}</p>
      <p className="small dim">{reviewed(p, p.review) ? t('Based on published training research and reviewed by a certified coach.') : t('Based on published training research. Not reviewed by a coach yet.')}</p>
      <h2>{t('Sessions')}</h2>
      <ProgramSessions program={p} />
      <h2>{t('Weeks')}</h2>
      {p.plan.map(w => {
        const items = Object.values(w.items).flat()
        const uniform = items.length && items.every(i => i.sets === items[0].sets && i.rir === items[0].rir)
        return <section key={w.week} className="card">
          <h3>{uniform ? t('Week {0}: {1}, RIR {2}', w.week, tn('{0} set per exercise', '{0} sets per exercise', items[0].sets), items[0].rir) : t('Week {0}', w.week)}</h3>
          {p.templates.map(template => <div key={template.id}>
            {!uniform && w.items[template.id].length > 0 && <p>{t(template.name)}: {w.items[template.id].map((i, n) => t('{0}: {1} sets, RIR {2}', exerciseNameText(exOr(template.items.filter(i => i.mode !== 'cardio')[n].ex)), i.sets, i.rir)).join('; ')}</p>}
            {w.cardio[template.id].map((i, n) => <p key={n}>{t(template.name)}: {i.intervals ? t('{0} min: {1}', i.min, intervalNote(i.intervals)) : t('{0} min easy', i.min)}</p>)}
          </div>)}
          {w.note && <p className="small dim">{t(w.note)}</p>}
        </section>
      })}
      {!!p.blockers?.length && <section><h2>{t('Known issues')}</h2><ul>{p.blockers.map(b => <li key={b}>{t(b.replace(/ \(P\d+(?:\.\d+)?\)/g, ''))}</li>)}</ul></section>}
      <div className="program-actions">
        <Button variant="primary" onClick={() => copy(true)}>{t('Start program')}</Button>
        <Button onClick={() => copy(false)}>{t('Copy to my routines')}</Button>
      </div>
    </>}
  </div>
}
