import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { appBase } from '../lib/app-base.js'
import { useGoogleHealth, applyWeighIns, stepsOn, latestRestingHr } from '../lib/google-health.js'
import { todayISO } from '../lib/format.js'
import { confirmSheet } from '../sheets.jsx'
import { MOBILE } from '../lib/mobile.js'
import { Button, Row, Section } from './ui.jsx'

// Settings → Integrations: Google Health (Fitbit). The connection lives on the server
// (api/health/): Connect is a page navigation to Google's consent screen, which comes back to
// this page with ?health=connected or ?health=failed.

const FAILED = {
  state: 'The connection link expired. Try again.',
  denied: 'You did not allow access, so nothing was connected.',
  not_linked: 'This Google account has no Google Health profile yet. Open the Google Health app, sign in with Google, then try again.',
  no_refresh: 'Google did not give a lasting connection. Remove Email’s Gym from your Google account’s third-party connections and try again.',
}

const ago = iso => {
  if (!iso) return t('never')
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  return min < 1 ? t('just now') : min < 60 ? t('{0} min ago', min) : min < 1440 ? t('{0} h ago', Math.round(min / 60)) : t('{0} days ago', Math.round(min / 1440))
}

export const connectUrl = () => appBase().replace(/\/$/, '') + '/api/google-health/connect'

export default function GoogleHealthCard() {
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const { info, busy, error, load, disconnect } = useGoogleHealth()
  const toast = useUI(s => s.toast)
  const offered = !!config?.health?.google
  const addWeights = w => useStore.getState().update(s => { applyWeighIns(s, w) })

  useEffect(() => {
    if (!user || !offered) return
    // Google sends people back to #/settings/integrations?health=connected (or =failed&code=…).
    const q = new URLSearchParams(String(globalThis.location?.hash || '').split('?')[1] || '')
    const result = q.get('health')
    if (result === 'connected') toast(t('Google Health connected'))
    if (result === 'failed') toast(t(FAILED[q.get('code')] || 'Could not connect Google Health. Try again.'))
    load({ sync: result === 'connected' ? 'none' : 'auto' }, addWeights)
  }, [user, offered]) // eslint-disable-line react-hooks/exhaustive-deps

  // The phone apps read Apple Health and Health Connect themselves (Phase 9); this is the web app's way in.
  if (!user || MOBILE) return null
  const connected = !!info?.connected
  const status = info?.status
  const data = info?.googleData ?? info?.data
  const today = stepsOn(data, todayISO())
  const rhr = latestRestingHr(data)
  const subtitle = !offered
    ? (user.admin ? t('Not set up on this server yet: add the Google client to .env (docs/fork/GOOGLE_HEALTH_SETUP.md).') : t('Not set up on this server yet.'))
    : !connected ? t('Steps, resting heart rate, sleep, weight and workouts from your Fitbit.')
      : status === 'reconnect' ? t('Google asks you to reconnect. Your data so far is kept.')
        : status === 'not_linked' ? t(FAILED.not_linked)
          : status === 'attention' ? t('The last sync failed: {0}', info.lastError?.msg || '')
            : t('Synced {0}', ago(info.lastSync)) + (today != null ? ' · ' + t('{0} steps today', today.toLocaleString()) : '') + (rhr ? ' · ' + t('resting HR {0}', rhr.bpm) : '')

  const askDisconnect = () => confirmSheet({
    title: t('Disconnect Google Health?'),
    message: t('Email’s Gym stops reading your Fitbit data, and the copy on your server is deleted. Weigh-ins already added stay in your weight chart.'),
    confirmText: t('Disconnect'), danger: true,
    onConfirm: async () => { try { await disconnect(); toast(t('Google Health disconnected')) } catch (e) { toast(e?.message || String(e)) } },
  })

  return <Section title={t('Fitbit')} footer={offered && !connected ? t('Signs in with your own Google account. Only you see your data.') : null}>
    <Row icon="heart" iconTint="var(--heart-rate)" title={t('Google Health')} subtitle={subtitle} />
    {offered && <div className="ghealth-actions">
      {!connected || status === 'reconnect'
        ? <Button variant="primary" onClick={() => { window.location.href = connectUrl() }}>{connected ? t('Reconnect') : t('Connect')}</Button>
        : <Button disabled={busy} onClick={async () => { const i = await load({ sync: 'now' }, addWeights); if (i?.status === 'ok') toast(t('Synced')) }}>{busy ? t('Syncing…') : t('Sync now')}</Button>}
      {connected && <Button variant="plain" onClick={askDisconnect}>{t('Disconnect')}</Button>}
    </div>}
    {error && connected && status === 'ok' && <p className="small dim ghealth-error">{error}</p>}
  </Section>
}
