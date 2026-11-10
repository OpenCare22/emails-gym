import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { appBase } from '../lib/app-base.js'
import { copyText } from '../lib/clipboard.js'
import { t } from '../lib/i18n.js'
import { DEMO } from '../lib/demo.js'
import { useGoogleHealth, applyWeighIns } from '../lib/google-health.js'
import { Button, Row, Section } from './ui.jsx'
import { confirmSheet } from '../sheets.jsx'

export default function AppleHealthExportCard() {
  const user = useStore(s => s.user)
  const [info, setInfo] = useState(null)
  const [token, setToken] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)
  useEffect(() => {
    let gone = false
    setToken(null); setInfo(null); setError(null)
    if (user && !DEMO) api('/api/apple-health').then(v => { if (!gone) setInfo(v) }).catch(() => { if (!gone) setError(t('Could not load Apple Watch settings.')) })
    return () => { gone = true }
  }, [user?.id])
  const url = new URL(appBase() + 'api/apple-health/ingest', window.location.origin).href
  const refresh = () => useGoogleHealth.getState().load({ sync: 'none' }, weights => useStore.getState().update(s => { applyWeighIns(s, weights) }))
  const action = async kind => {
    setBusy(true); setError(null); setCopied(null); setToken(null)
    try {
      const result = await api('/api/apple-health/' + kind, { method: 'POST' })
      if (kind === 'token') setToken(result.token)
      setInfo(await api('/api/apple-health'))
      await refresh()
    } catch { setError(t('Could not update Apple Watch settings. Try again.')) }
    finally { setBusy(false) }
  }
  const copy = async (value, label) => {
    try { if (!await copyText(value)) throw new Error(); setCopied(label) }
    catch { setError(t('Could not copy. Select the text and copy it.')) }
  }
  const stale = info?.connected && Date.now() - Date.parse(info.lastReceived || info.createdAt) > 2 * 864e5
  return <Section>
    <Row icon="watch" iconTint="var(--heart-rate)" title={t('Apple Watch')} />
    <div className="apple-export" data-card="apple-health-export">
      <p>{t('Send your Apple Health data with Health Auto Export on your iPhone.')}</p>
      {!user || DEMO ? <p>{t('Sign in to create an export key.')}</p> : <>
        <ol>
          <li>{t('Install Health Auto Export and choose its Premium tier.')}</li>
          <li>{t('Open Automations and create a new REST API automation. Use this URL:')}
            <code>{url}</code><Button onClick={() => copy(url, t('URL copied'))}>{t('Copy URL')}</Button>
          </li>
          <li>{t('Add the header Authorization with the value Bearer followed by your key.')}
            <p>{t('The key is shown only once. A new key replaces the old one.')}</p>
            <Button disabled={busy || !info} onClick={() => action('token')}>{info?.connected ? t('New key') : t('Create key')}</Button>
            {token && <div><code>{'Bearer ' + token}</code><Button onClick={() => copy('Bearer ' + token, t('Header copied'))}>{t('Copy header')}</Button></div>}
          </li>
          <li>{t('Choose Health Metrics: step count, resting heart rate, heart rate, sleep analysis, body mass and apple exercise time. Also choose Workouts with export version 2.')}</li>
          <li>{t('Turn Summarize Data on. Set Date range to Since Last Sync and sync every 1 hour.')}</li>
        </ol>
        <p>{t('Last received: {0}', info?.lastReceived ? new Date(info.lastReceived).toLocaleString() : t('never'))}</p>
        {stale && <p>{t('Nothing has arrived for 2 days. iPhone only sends while it is unlocked: open Health Auto Export once to catch up.')}</p>}
        {!!info?.unknownMetrics?.length && <p>{t('Unrecognised metrics: {0}', info.unknownMetrics.join(', '))}</p>}
        {info?.connected && <><p>{t('Disconnect removes the key and Apple data from the server. Weigh-ins already in your chart stay there.')}</p><Button disabled={busy} onClick={() => confirmSheet({ title: t('Disconnect Apple Watch?'), message: t('Health Auto Export stops reaching your server, and your Apple data there is deleted. Weigh-ins already in your chart stay.'), confirmText: t('Disconnect'), danger: true, onConfirm: () => action('disconnect') })}>{t('Disconnect')}</Button></>}
      </>}
      {copied && <p role="status">{copied}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  </Section>
}
