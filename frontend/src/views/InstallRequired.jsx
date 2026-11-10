import BrandMark from '../components/BrandMark.jsx'
import { t } from '../lib/i18n.js'

export default function InstallRequired() {
  return (
    <main className="install-required">
      <BrandMark size={80} tile />
      <h1>{t('Add Email’s Gym to your Home Screen')}</h1>
      <p>{t('Use Email’s Gym from your Home Screen for notifications and full screen.')}</p>
      <ol>
        <li>{t('In Safari, tap Share.')}</li>
        <li>{t('Tap “Add to Home Screen”, then tap Add.')}</li>
        <li>{t('Open Email’s Gym from your Home Screen.')}</li>
      </ol>
      <p className="dim small">{t('An App Store version is in development.')}</p>
    </main>
  )
}
