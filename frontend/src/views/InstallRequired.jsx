import { useState } from 'react'
import BrandMark from '../components/BrandMark.jsx'
import { t } from '../lib/i18n.js'
import { copyText } from '../lib/clipboard.js'
import { codeFromText } from '../lib/social.js'

// On an iPhone or iPad in Safari, once signed in, the app is only used from the Home Screen. An
// invite link opened here can't follow: the Home Screen app does not share Safari's address, so
// the code is shown to copy and paste in Friends → Join with a link.
export default function InstallRequired() {
  const code = codeFromText(String(globalThis.location?.hash || ''))
  const [copied, setCopied] = useState(false)
  return (
    <main className="install-required">
      <BrandMark size={80} tile />
      <h1>{t('Add Email’s Gym to your Home Screen')}</h1>
      <p>{t('Use Email’s Gym from your Home Screen for notifications and full screen.')}</p>
      <ol>
        <li>{t('In Safari, tap Share.')}</li>
        <li>{t('Tap “Add to Home Screen”, then tap Add.')}</li>
        <li>{t('Open Email’s Gym from your Home Screen and sign in again with Face ID. Your passkey comes with you.')}</li>
      </ol>
      {code && <section className="install-invite">
        <p>{t('You were invited to a group. In the app, open Friends, tap Join with a link and paste this code:')}</p>
        <p><code>{code}</code></p>
        <button type="button" className="btn tinted" onClick={async () => setCopied(await copyText(code))}>{copied ? t('Copied') : t('Copy code')}</button>
      </section>}
      <p className="dim small">{t('An App Store version is in development.')}</p>
    </main>
  )
}
