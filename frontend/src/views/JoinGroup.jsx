import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { peekInvite, joinGroup, setSharing, SHARE_KEYS } from '../lib/social.js'
import { SharingSwitches } from '../components/SocialSheets.jsx'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

// #/join/<code> (PLAN.md Phase 7): what an invite link opens once signed in. Says which group it is,
// asks what to share (Workouts and Streak ticked, the rest off), then joins.

export const JOIN_DEFAULT = () => Object.fromEntries(SHARE_KEYS.map(k => [k, k === 'workouts' || k === 'streak']))

export default function JoinGroup() {
  const { code } = useParams()
  const nav = useNavigate()
  const [group, setGroup] = useState(null)
  const [error, setError] = useState(null)
  const [sharing, setLocal] = useState(JOIN_DEFAULT)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let gone = false
    peekInvite(code).then(g => { if (!gone) setGroup(g) }).catch(e => { if (!gone) setError(e?.message || String(e)) })
    return () => { gone = true }
  }, [code])

  const join = async () => {
    setBusy(true)
    try {
      const { group: g } = await joinGroup(code)
      await setSharing(g.id, sharing)
      useUI.getState().toast(t('You joined {0}', g.name))
      nav('/friends', { replace: true })
    } catch (e) { setError(e?.message || String(e)); setBusy(false) }
  }

  return <div className="narrow join-group">
    <div className="hdr">
      <button className="iconbtn" data-back="/friends" onClick={() => nav('/friends')} aria-label={t('Friends')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, margin: '0 12px', minWidth: 0 }}><h1>{group ? t('Join {0}?', group.name) : t('Join a group')}</h1>
        {group && <div className="sub">{t('Started by {0} · {1} people', group.owner, group.members)}</div>}</div>
    </div>
    {!group && !error && <div className="friends-state" role="status">{t('Loading…')}</div>}
    {error && <div className="friends-empty" role="alert">
      <Icon name="link" />
      <h2>{t('This invite doesn’t work')}</h2>
      <p className="dim">{error}</p>
      <Button onClick={() => nav('/friends')}>{t('Go to Friends')}</Button>
    </div>}
    {group && !error && <>
      <SharingSwitches value={sharing} onChange={setLocal} />
      <Button variant="primary" disabled={busy} onClick={join} style={{ width: '100%' }}>{busy ? t('Joining…') : t('Join group')}</Button>
      <p className="small dim join-note">{t('You can change what you share, or leave, at any time in the group settings.')}</p>
    </>}
  </div>
}
