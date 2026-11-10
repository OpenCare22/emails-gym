import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { isVisible, reviewed } from '../lib/library.js'
import { Button, Row } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

export function usePrograms() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    import('../lib/library-data.js').then(m => { if (alive) setData(m.programs) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])
  return { data, error }
}
export const goalLabel = goal => ({ general: t('General fitness'), muscle: t('Muscle growth'), strength: t('Strength'), hybrid: t('Strength and aerobic fitness'), efficient: t('Time-efficient training'), endurance: t('Aerobic endurance') })[goal] || t(goal)
export const levelLabel = level => ({ beginner: t('Beginner'), intermediate: t('Intermediate'), any: t('All levels') })[level] || t(level)
export const minutesLabel = p => t('{0} to {1} min', ...p.minutes)
export function ProgramMeta({ program: p }) {
  return <p className="small dim">{[goalLabel(p.goal), p.level.map(levelLabel).join(', '), t('{0} days per week', p.days), minutesLabel(p), t('{0} weeks', p.weeks), p.equipment.map(e => t(e)).join(', ')].join(' · ')}</p>
}
export default function Programs() {
  const nav = useNavigate()
  const { data, error } = usePrograms()
  const [goal, setGoal] = useState('')
  const [days, setDays] = useState('')
  const [level, setLevel] = useState('')
  const visible = (data || []).filter(p => isVisible(p, p.review))
  const filtered = visible.filter(p => (!goal || p.goal === goal) && (!days || p.days === days) && (!level || p.level.includes(level) || p.level.includes('any')))
  const chips = (label, values, selected, set, name) => <div role="group" aria-label={label} className="chips wrap">
    <button className={'chip' + (!selected ? ' on' : '')} aria-pressed={!selected} onClick={() => set('')}>{t('All')}</button>
    {values.map(v => <button key={v} className={'chip' + (selected === v ? ' on' : '')} aria-pressed={selected === v} onClick={() => set(v)}>{name(v)}</button>)}
  </div>
  return <div className="narrow program-library">
    <div className="hdr">
      <button className="iconbtn" data-back="/plan" onClick={() => nav('/plan')} aria-label={t('Plan')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}><h1>{t('Programs')}</h1>
        <div className="sub">{t('Ready-made plans you can start or copy and change.')}</div></div>
    </div>
    <Button variant="primary" icon="sparkles" onClick={() => nav('/programs/build')} style={{ width: '100%', margin: '4px 0 8px' }}>{t('Build my plan')}</Button>
    <p className="small dim" style={{ margin: '0 2px 12px' }}>{t('A plan made for you from the whole exercise library, with the reasons for each choice.')}</p>
    <h2 className="sect-t">{t('Templates')}</h2>
    {chips(t('Goal'), [...new Set(visible.map(p => p.goal))], goal, setGoal, goalLabel)}
    {chips(t('Days per week'), [...new Set(visible.map(p => p.days))].sort(), days, setDays, n => t('{0} days', n))}
    {chips(t('Level'), ['beginner', 'intermediate', 'any'], level, setLevel, levelLabel)}
    {error ? <p role="alert">{t('Could not load programs. Please try again.')}</p> : !data ? <p role="status">{t('Loading…')}</p> : !filtered.length ? <p>{t('No programs match these filters.')}</p> : filtered.map(p => <div className="card" key={p.id}>
      <Row title={t(p.title)} subtitle={!reviewed(p, p.review) ? t('Not reviewed by a coach yet') : undefined} accessory="chevron" onClick={() => nav('/programs/' + p.id)} />
      <ProgramMeta program={p} />
    </div>)}
  </div>
}
