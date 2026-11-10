import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { exerciseNameText } from '../lib/format.js'
import { exOr } from '../lib/exercises.js'
import { activeProfile, profileEquipment } from '../lib/equipment.js'
import { buildPlan, alternativesFor, swapItem } from '../lib/plan-build.js'
import { MODEL, disclaimer } from '../lib/plan-model.js'
import { bodyOf, setBody, latestWeightKg, heightFromImperial, imperialFromCm, kgFromLb, ageOf } from '../lib/body-profile.js'
import { LB_KG } from '../lib/units.js'
import { buildLibraryProgram } from '../lib/library-start.js'
import { saveProgramme, startProgramme } from '../lib/programmes.js'
import { confirmSheet } from '../sheets.jsx'
import { Button, NumberField, Row, Section, Segmented } from '../components/ui.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import ProgramSessions from '../components/ProgramSessions.jsx'
import BrandMark from '../components/BrandMark.jsx'

// Build my plan (docs/superpowers/specs/2026-11-10-plan-builder-design.md): the questions one per
// screen, "Building the best plan for you", then the plan from lib/plan-build.js with its reasons.
// Answers stay in this screen; Start saves the plan as routines and a programme, and the body
// details (height, birth year, sex) to the profile.

export const BUILD_STEPS = () => [t('Choosing your split'), t('Picking your exercises'), t('Setting sets, reps and rest')]
const STEP_MS = 700

function questions(gym) {
  const one = (key, title, options) => ({ key, kind: 'one', title, options })
  const many = (key, title, options, hint) => ({ key, kind: 'many', title, options, hint })
  return [
    one('goal', t('What is your main goal?'), [
      ['muscle', t('Build muscle'), t('Bigger, more defined muscles.')],
      ['recomp', t('Build muscle and lose fat'), t('Leaner and stronger at the same time.')],
      ['gain', t('Gain weight and muscle'), t('Put on size, especially if you find it hard to.')],
      ['strength', t('Get stronger'), t('Lift heavier on the main lifts.')],
      ['general', t('General fitness'), t('Stronger and healthier overall.')],
      ['hybrid', t('Strength and cardio'), t('Lifting plus fitter heart and lungs.')],
    ]),
    { key: 'body', kind: 'body', title: t('About you') },
    one('trained', t('How long have you trained regularly?'), [
      ['never', t('Not really, or not yet')], ['under6m', t('Under 6 months')], ['6m2y', t('6 months to 2 years')], ['over2y', t('Over 2 years')],
    ]),
    one('pushups', t('How many push-ups can you do in a row?'), [['0', t('None yet')], ['1-10', t('1 to 10')], ['11-25', t('11 to 25')], ['25+', t('More than 25')]]),
    one('squats', t('How many bodyweight squats in a row?'), [['0-10', t('Up to 10')], ['11-30', t('11 to 30')], ['30+', t('More than 30')]]),
    one('barbell', t('Have you done barbell squats, deadlifts or bench presses?'), [[true, t('Yes')], [false, t('No')]]),
    one('days', t('How many days a week can you train?'), [[2, t('2 days')], [3, t('3 days')], [4, t('4 days')], [5, t('5 or more')]]),
    one('minutes', t('How long can a session be?'), [[30, t('30 min')], [45, t('45 min')], [60, t('60 min')], [90, t('90 min or more')]]),
    one('equipment', t('Where do you train?'), [
      ...(gym ? [['own', t('My gym: {0}', gym.name), t('Uses the equipment ticked in your gym profile.')]] : []),
      ['gym', t('Full gym'), t('Machines, cables, barbells and dumbbells.')], ['dumbbells', t('Dumbbells only')], ['none', t('No equipment')],
    ]),
    many('focus', t('Anything you want extra work on?'), [
      ['chest', t('Chest')], ['back', t('Back')], ['shoulders', t('Shoulders')], ['arms', t('Arms')], ['glutes', t('Glutes')], ['legs', t('Legs')], ['core', t('Core')],
    ], t('Optional. Pick none for a balanced plan.')),
    many('avoid', t('Any areas to go easy on?'), [
      ['knee', t('Knees')], ['shoulder', t('Shoulders')], ['lowerback', t('Lower back')], ['wrist', t('Wrists')], ['neck', t('Neck')],
    ], t('Optional. The plan picks exercises that load these less.')),
    one('health', t('Do you have an injury or a health condition, or has a doctor told you to limit exercise?'), [[true, t('Yes')], [false, t('No')]]),
  ]
}

function BodyStep({ value, imperial, onNext }) {
  const [v, setV] = useState(value)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const ok = (imperial ? v.ft > 0 : v.heightCm > 0) && v.weight > 0
  return <><h2 className="plan-q">{t('About you')}</h2><Section footer={t('Used only to shape your plan. Saved to your own profile when you start it, never shown to friends.')}>
    <div className="plan-body">
      {imperial
        ? <label>{t('Height')}<span className="plan-body-pair">
          <NumberField decimal={false} nullable value={v.ft ?? null} aria-label={t('Height, feet')} onChange={x => set('ft', x)} /><span>{t('ft')}</span>
          <NumberField decimal={false} nullable value={v.inch ?? null} aria-label={t('Height, inches')} onChange={x => set('inch', x)} /><span>{t('in')}</span></span></label>
        : <label>{t('Height')}<span className="plan-body-pair"><NumberField nullable value={v.heightCm ?? null} aria-label={t('Height in cm')} onChange={x => set('heightCm', x)} /><span>{t('cm')}</span></span></label>}
      <label>{t('Weight')}<span className="plan-body-pair"><NumberField nullable value={v.weight ?? null} aria-label={imperial ? t('Weight in lb') : t('Weight in kg')} onChange={x => set('weight', x)} /><span>{imperial ? t('lb') : t('kg')}</span></span></label>
      <label>{t('Age')}<span className="plan-body-pair"><NumberField decimal={false} nullable value={v.age ?? null} aria-label={t('Age')} onChange={x => set('age', x)} /><span>{t('years')}</span></span></label>
      <div className="plan-body-sex"><span>{t('Sex')}</span>
        <Segmented value={v.sex || 'none'} onChange={x => set('sex', x)} options={[{ value: 'female', label: t('Female') }, { value: 'male', label: t('Male') }, { value: 'none', label: t('Prefer not to say') }]} />
      </div>
    </div>
  </Section>
    <Button variant="primary" disabled={!ok} onClick={() => onNext(v)} style={{ width: '100%', marginTop: 4 }}>{t('Next')}</Button></>
}

function ManyStep({ q, value, onNext }) {
  const [picked, setPicked] = useState(value || [])
  const toggle = k => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]))
  return <><h2 className="plan-q">{q.title}</h2><Section footer={q.hint}>
    {q.options.map(([k, title]) => <Row key={k} title={title} accessory={picked.includes(k) ? 'check' : 'none'} onClick={() => toggle(k)} />)}
  </Section>
    <Button variant="primary" onClick={() => onNext(picked)} style={{ width: '100%', marginTop: 4 }}>{picked.length ? t('Next') : t('Skip')}</Button></>
}

function weekGroups(plan) {
  const groups = []
  for (const w of plan.plan) {
    const all = Object.values(w.items).flat()
    const sets = all.map(i => i.sets), rir = all.map(i => i.rir).filter(x => x != null)
    const last = groups.at(-1)
    if (last && last.note === w.note) { last.to = w.week; continue }
    groups.push({ from: w.week, to: w.week, note: w.note, sets: [Math.min(...sets), Math.max(...sets)], rir: rir.length ? [Math.min(...rir), Math.max(...rir)] : null })
  }
  return groups
}
const span = ([a, b]) => (a === b ? String(a) : t('{0} to {1}', a, b))

export default function PlanBuild() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const imperial = S.unit === 'lb'
  const profile = activeProfile(S)
  const gym = profile && profile.id ? profile : null
  const qs = useMemo(() => questions(gym), [gym])
  const saved = bodyOf(S)
  const prefill = useMemo(() => {
    const kg = latestWeightKg(S)
    const cm = saved?.heightCm
    return {
      ...(imperial ? (cm ? imperialFromCm(cm) : {}) : { heightCm: cm ?? null }),
      weight: kg == null ? null : imperial ? Math.round(kg / LB_KG * 10) / 10 : kg,
      age: ageOf(saved), sex: saved?.sex || 'none',
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [answers, setAnswers] = useState({ body: prefill })
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('questions') // questions | building | plan | professional
  const [ticks, setTicks] = useState(0)
  const [seed, setSeed] = useState(1)
  const [plan, setPlan] = useState(null)
  const starting = useRef(false)

  const modelAnswers = a => {
    const b = a.body || {}
    const heightCm = imperial ? heightFromImperial(b.ft, b.inch) : b.heightCm
    const weightKg = imperial ? kgFromLb(b.weight) : b.weight
    return { goal: a.goal, heightCm, weightKg, age: b.age, sex: b.sex, trained: a.trained, pushups: a.pushups, squats: a.squats, barbell: a.barbell,
      days: a.days, minutes: a.minutes, equipment: a.equipment === 'own' ? profileEquipment(gym) : a.equipment, focus: a.focus || [], avoid: a.avoid || [], health: a.health }
  }

  useEffect(() => {
    if (phase !== 'building') return
    const steps = BUILD_STEPS().length
    if (ticks < steps) { const id = setTimeout(() => setTicks(n => n + 1), STEP_MS); return () => clearTimeout(id) }
    const id = setTimeout(() => setPhase('plan'), STEP_MS / 2)
    return () => clearTimeout(id)
  }, [phase, ticks])

  const finish = a => {
    if (a.health === true) { setPhase('professional'); return }
    setPlan(buildPlan(modelAnswers(a), { seed, S }))
    setTicks(0); setPhase('building')
  }
  const answer = (key, value) => {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    if (step + 1 >= qs.length) finish(next)
    else setStep(step + 1)
  }
  const back = () => {
    if (phase === 'plan' || phase === 'professional') { setPhase('questions'); return }
    if (step > 0) setStep(step - 1)
    else nav('/programs')
  }
  const shuffle = () => { const s = seed + 1; setSeed(s); setPlan(buildPlan(modelAnswers(answers), { seed: s, S })) }
  const swap = (templateId, index) => {
    const alts = alternativesFor(plan, templateId, index, { S })
    useUI.getState().openSheet(close => <>
      <h3>{t('Swap {0}', exerciseNameText(exOr(plan.templates.find(x => x.id === templateId).items[index].ex)))}</h3>
      {alts.length ? alts.map(a => <Row key={a.ex} title={exerciseNameText(exOr(a.ex))} subtitle={a.reasons.join(' · ')} accessory="chevron"
        onClick={() => { setPlan(p => swapItem(p, templateId, index, a.ex)); close() }} />)
        : <p className="small dim">{t('No other exercise fits this slot with your equipment and answers.')}</p>}
    </>)
  }
  const keep = start => {
    if (starting.current) return
    const perform = () => {
      if (starting.current) return
      starting.current = true
      const built = buildLibraryProgram(plan)
      const { health, ...kept } = modelAnswers(answers)
      built.programme.src = { ...built.programme.src, model: MODEL.name, modelVersion: MODEL.version, seed, answers: kept }
      useStore.getState().update(s => {
        s.routines = [...(s.routines || []), ...built.routines]
        saveProgramme(s, built.programme)
        if (start) startProgramme(s, built.programme.id)
        const b = answers.body || {}
        setBody(s, { heightCm: kept.heightCm, birthYear: b.age ? new Date().getFullYear() - b.age : undefined, sex: b.sex })
      })
      useUI.getState().toast(start ? t('Started {0}', plan.title) : t('Saved {0} to your routines', plan.title))
      nav('/plan/prog/' + built.programme.id)
    }
    const cur = useStore.getState().S
    if (start && cur.programme) confirmSheet({
      title: t('Stop {0} and start your plan?', cur.programmes?.[cur.programme.id]?.name || t('Programme')),
      message: t('Your previous plan will be kept and restored when you end the programme.'),
      confirmText: t('Start plan'), onConfirm: perform,
    })
    else perform()
  }

  const q = qs[step]
  return <div className="narrow program-library plan-build">
    <div className="hdr">
      <button className="iconbtn" data-back="/programs" onClick={back} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}><h1>{phase === 'plan' && plan ? plan.title : t('Build my plan')}</h1>
        {phase === 'questions' && <div className="sub" role="status">{t('{0} of {1}', step + 1, qs.length)}</div>}</div>
    </div>

    {phase === 'questions' && (q.kind === 'body'
      ? <BodyStep key="body" value={answers.body} imperial={imperial} onNext={v => answer('body', v)} />
      : q.kind === 'many' ? <ManyStep key={q.key} q={q} value={answers[q.key]} onNext={v => answer(q.key, v)} />
        : <><h2 className="plan-q">{q.title}</h2><Section>
          {q.options.map(([value, title, subtitle]) => <Row key={String(value)} title={title} subtitle={subtitle}
            accessory={answers[q.key] === value ? 'check' : 'chevron'} onClick={() => answer(q.key, value)} />)}
        </Section></>)}

    {phase === 'professional' && <EmptyState icon="info" text={t('Talk to a doctor or physiotherapist before starting a new program. You can still build your own routine.')}>
      <Button variant="primary" onClick={() => nav('/plan')}>{t('Go to Routines')}</Button>
      <Button onClick={() => { setPhase('questions'); setStep(0) }}>{t('Change answers')}</Button>
    </EmptyState>}

    {phase === 'building' && <div className="plan-building" role="status" aria-live="polite">
      <BrandMark size={56} tile />
      <h2>{t('Building the best plan for you')}</h2>
      <div className="plan-building-bar" aria-hidden="true"><span style={{ width: `${Math.round(100 * ticks / BUILD_STEPS().length)}%` }} /></div>
      <ul>{BUILD_STEPS().map((label, i) => <li key={label} className={i < ticks ? 'done' : i === ticks ? 'now' : ''}>
        <Icon name={i < ticks ? 'check' : 'clock'} /><span>{label}</span></li>)}</ul>
    </div>}

    {phase === 'plan' && plan && <>
      <p className="small dim">{t('Not reviewed by a coach yet')} · {t('{0} to {1} min a session', ...plan.minutes)}</p>
      <Section title={t('Why this plan')}>
        <ul className="program-why plan-why">{plan.rationale.map(r => <li key={r.rule}>{r.text}{r.source && <span className="small dim"> ({r.source})</span>}</li>)}</ul>
      </Section>
      <div className="program-actions">
        <Button variant="primary" onClick={() => keep(true)}>{t('Start plan')}</Button>
        <Button onClick={() => keep(false)}>{t('Save to my routines')}</Button>
        <Button icon="shuffle" onClick={shuffle}>{t('Shuffle exercises')}</Button>
      </div>
      <h2>{t('Sessions')}</h2>
      <ProgramSessions program={plan} onSwap={swap} />
      <h2>{t('Weeks')}</h2>
      {weekGroups(plan).map(g => <section key={g.from} className="card">
        <h3>{g.from === g.to ? t('Week {0}', g.from) : t('Weeks {0} to {1}', g.from, g.to)}</h3>
        <p>{t('{0} sets per exercise', span(g.sets))}{g.rir && t(', RIR {0}', span(g.rir))}</p>
        <p className="small dim">{g.note}</p>
      </section>)}
      <p className="small dim">{disclaimer()}</p>
      <Button onClick={() => { setPhase('questions'); setStep(0) }}>{t('Change answers')}</Button>
    </>}
  </div>
}
