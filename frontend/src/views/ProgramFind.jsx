import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { activeProfile, profileEquipment } from '../lib/equipment.js'
import { matchPrograms } from '../lib/program-match.js'
import { Button, Row, Section } from '../components/ui.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { usePrograms, ProgramMeta } from './Programs.jsx'
import { reviewed } from '../lib/library.js'

// "Find a program for me": seven multiple-choice questions, one per screen, then the matches from
// lib/program-match.js. The answers live in this screen only; nothing is stored or synced.
function questions(gym) {
  return [
    { key: 'goal', title: t('What is your main goal?'), options: [
      ['muscle', t('Build muscle'), t('Bigger, more defined muscles.')],
      ['strength', t('Get stronger'), t('Lift heavier on the main lifts.')],
      ['general', t('General fitness'), t('Stronger and healthier overall, a habit that lasts.')],
      ['hybrid', t('Strength and cardio'), t('Lifting plus fitter heart and lungs.')],
      ['endurance', t('Cardio fitness'), t('Walk, cycle or row further with less effort.')],
      ['efficient', t('Short sessions'), t('The most from little time.')],
    ] },
    { key: 'level', title: t('How much have you trained?'), options: [
      ['beginner', t('Beginner'), t('Under 6 months of regular training.')],
      ['intermediate', t('Intermediate'), t('6 months to 2 years, comfortable with the main lifts.')],
      ['advanced', t('Advanced'), t('Over 2 years of regular training.')],
    ] },
    { key: 'days', title: t('How many days a week can you train?'), options: [
      [2, t('2 days')], [3, t('3 days')], [4, t('4 days')], [5, t('5 or more')],
    ] },
    { key: 'minutes', title: t('How long can a session be?'), options: [
      [30, t('30 min')], [45, t('45 min')], [60, t('60 min')], [90, t('90 min or more')],
    ] },
    { key: 'equipment', title: t('Where do you train?'), options: [
      ...(gym ? [['own', t('My gym: {0}', gym.name), t('Uses the equipment ticked in your gym profile.')]] : []),
      ['gym', t('Full gym'), t('Machines, cables, barbells and dumbbells.')],
      ['dumbbells', t('Dumbbells only')],
      ['none', t('No equipment')],
    ] },
    { key: 'cardio', title: t('How much cardio do you want?'), options: [
      ['much', t('As much as possible')], ['some', t('Some')], ['little', t('As little as possible')],
    ] },
    { key: 'health', title: t('Do you have an injury or a health condition, or has a doctor told you to limit exercise?'), options: [
      [true, t('Yes')], [false, t('No')],
    ] },
  ]
}

export default function ProgramFind() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const { data, error } = usePrograms()
  const profile = activeProfile(S)
  const gym = profile && profile.id ? profile : null
  const qs = questions(gym)
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const done = step >= qs.length
  const back = () => (step > 0 ? setStep(step - 1) : nav('/programs'))
  const choose = (key, value) => { setAnswers(a => ({ ...a, [key]: value })); setStep(step + 1) }

  const forMatch = { ...answers, ...(answers.equipment === 'own' ? { equipment: profileEquipment(gym) } : {}) }
  const result = done && data ? matchPrograms(forMatch, data) : null

  return <div className="narrow program-library">
    <div className="hdr">
      <button className="iconbtn" data-back="/programs" onClick={back} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}><h1>{t('Find a program')}</h1>
        {!done && <div className="sub" role="status">{t('{0} of {1}', step + 1, qs.length)}</div>}</div>
    </div>
    {!done ? <Section title={qs[step].title}>
      {qs[step].options.map(([value, title, subtitle]) => <Row key={String(value)} title={title} subtitle={subtitle}
        accessory={answers[qs[step].key] === value ? 'check' : 'chevron'} onClick={() => choose(qs[step].key, value)} />)}
    </Section>
      : error ? <p role="alert">{t('Could not load programs. Please try again.')}</p>
      : !result ? <p role="status">{t('Loading…')}</p>
      : result.advice === 'professional' ? <EmptyState icon="info" text={t('Talk to a doctor or physiotherapist before starting a new program. You can still build your own routine.')}>
        <Button variant="primary" onClick={() => nav('/plan')}>{t('Go to Routines')}</Button>
        <Button onClick={() => setStep(0)}>{t('Change answers')}</Button>
      </EmptyState>
      : !result.matches.length ? <EmptyState icon="clipboard" text={t('No program fits these answers yet.')}>
        <Button variant="primary" onClick={() => setStep(0)}>{t('Change answers')}</Button>
        <Button onClick={() => nav('/plan')}>{t('Build your own routine')}</Button>
      </EmptyState>
      : <>
        <p className="small dim">{t('Picked by fixed rules from your answers, best fit first.')}</p>
        {result.matches.map(m => <div className="card" key={m.program.id}>
          <Row title={t(m.program.title)} subtitle={!reviewed(m.program, m.program.review) ? t('Not reviewed by a coach yet') : undefined}
            accessory="chevron" onClick={() => nav('/programs/' + m.program.id)} />
          <ProgramMeta program={m.program} />
          <ul className="program-why">{m.why.map(w => <li key={w}>{w}</li>)}</ul>
          {m.compromises.length > 0 && <ul className="program-why dim">{m.compromises.map(c => <li key={c}>{c}</li>)}</ul>}
        </div>)}
        <Button onClick={() => setStep(0)}>{t('Change answers')}</Button>
      </>}
  </div>
}
