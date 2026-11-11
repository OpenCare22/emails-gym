// "How did that feel?" under an exercise once its planned sets are done (lib/return-session.js
// feelAsked). One optional tap; skipping it changes nothing. The answer tunes the next step
// (progression.js): Hard holds once, two Easy raises in a row earn a bigger one.
import { useId, useState } from 'react'
import { t } from '../lib/i18n.js'
import { Segmented } from './ui.jsx'

const LABEL = { easy: 'Easy', good: 'Good', hard: 'Hard' }
const CHIP = { easy: 'Felt easy', good: 'Felt good', hard: 'Felt hard' }

// `label` names the exercise when the question comes after it, on the next one (FocusView).
export default function FeelRow({ value, onChange, label }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  if (value && !open) {
    return <div className="feel-row">
      <button type="button" className="chip feel-chip" aria-label={t('Change how that felt')} onClick={() => setOpen(true)}>{t(CHIP[value])}</button>
    </div>
  }
  return <div className="feel-row">
    <span id={id} className="muted small">{label ? t('How did {0} feel?', label) : t('How did that feel?')}</span>
    <Segmented className={'seg-inline feel-seg' + (value ? '' : ' feel-none')} ariaLabelledby={id} value={value}
      options={['easy', 'good', 'hard'].map(v => ({ value: v, label: t(LABEL[v]) }))}
      onChange={v => { onChange(v === value ? null : v); setOpen(false) }} />
  </div>
}
