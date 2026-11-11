// The note at the top of a workout that eases you back in after a break (lib/return-break.js),
// with the one tap that switches this workout to your usual plan and back.
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function ReturnNote({ days, usual, onToggle }) {
  return <div className="return-note" role="status">
    <Icon name={usual ? 'info' : 'arrowDown'} />
    <span>{usual ? t('Using your usual plan.') : t('Back after {0} days, so today is a little lighter.', days)}</span>
    <Button size="sm" onClick={onToggle}>{usual ? t('Ease in instead') : t('Use my usual plan')}</Button>
  </div>
}
