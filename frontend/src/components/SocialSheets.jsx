import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import { copyText } from '../lib/clipboard.js'
import { confirmSheet } from '../sheets.jsx'
import {
  SHARE_KEYS, SHARE_COPY, inviteUrl, codeFromText, createGroup, renameGroup, newInvite, leaveGroup,
  removeMember, setSharing, setNudges,
} from '../lib/social.js'
import { Button, Row, Section, Switch } from './ui.jsx'

// The Friends sheets (PLAN.md Phase 7): start a group, join with a pasted link, the sharing
// switches, and a group's settings. Each takes `onDone` to reload the Friends screen.

const toast = msg => useUI.getState().toast(msg)
const fail = e => toast(e?.message || String(e))
const isDismissed = e => e?.name === 'AbortError' || /cancel/i.test(String(e?.message || ''))

/** The share sheet where there is one, else the clipboard. */
export async function shareInvite(groupName, invite) {
  const url = inviteUrl(invite.code)
  const text = t('Join my group {0} on Email’s Gym', groupName)
  if (!MOBILE && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try { await navigator.share({ title: groupName, text, url }); return } catch (e) { if (isDismissed(e)) return }
  }
  toast(await copyText(text + '\n' + url) ? t('Invite link copied. It works for 14 days.') : url)
}

/** The sharing switches: what a group sees of you. */
export function SharingSwitches({ value, onChange }) {
  const copy = SHARE_COPY()
  return <Section title={t('What this group sees')} footer={t('Friends only ever see these numbers, never your workouts or weights.')}>
    {SHARE_KEYS.map(k => <Row key={k} title={copy[k][0]} subtitle={copy[k][1]}>
      <Switch aria-label={copy[k][0]} checked={!!value[k]} onChange={v => onChange({ ...value, [k]: v })} />
    </Row>)}
  </Section>
}

function NameSheet({ close, title, initial = '', action, onDone }) {
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await action(name.trim()); close(); onDone?.() } catch (e) { fail(e) } finally { setBusy(false) }
  }
  return <>
    <h3>{title}</h3>
    <input className="input social-input" aria-label={t('Group name')} placeholder={t('Group name')} maxLength={40} value={name} autoFocus
      onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) go() }} />
    <Button variant="primary" disabled={!name.trim() || busy} onClick={go} style={{ width: '100%', marginTop: 12 }}>{t('Save')}</Button>
  </>
}

export const startGroupSheet = onDone => useUI.getState().openSheet(close =>
  <NameSheet close={close} title={t('Start a group')} action={async name => { const { group } = await createGroup(name); toast(t('Group started. Invite your friends.')); onDone?.(group) }} />)

function JoinLinkSheet({ close, onCode }) {
  const [text, setText] = useState('')
  const code = codeFromText(text)
  return <>
    <h3>{t('Join with a link')}</h3>
    <p className="small dim">{t('Paste the invite link or code a friend sent you.')}</p>
    <input className="input social-input" aria-label={t('Invite link or code')} placeholder={t('Invite link or code')} value={text} autoFocus
      onChange={e => setText(e.target.value)} />
    <Button variant="primary" disabled={!code} onClick={() => { close(); onCode(code) }} style={{ width: '100%', marginTop: 12 }}>{t('Continue')}</Button>
  </>
}
export const joinLinkSheet = onCode => useUI.getState().openSheet(close => <JoinLinkSheet close={close} onCode={onCode} />)

function GroupSettings({ close, group, sharing: initialSharing, nudges: initialNudges, onDone }) {
  const [sharing, setLocal] = useState(initialSharing)
  const [nudges, setLocalNudges] = useState(initialNudges)
  const [invite, setInvite] = useState(group.invite || null)
  const save = async next => { setLocal(next); try { await setSharing(group.id, next); onDone?.() } catch (e) { fail(e); setLocal(sharing) } }
  const nudge = async v => { setLocalNudges(v); try { await setNudges(v) } catch (e) { fail(e); setLocalNudges(!v) } }
  const inviteAgain = async off => { try { const r = await newInvite(group.id, off); setInvite(r.invite); onDone?.() } catch (e) { fail(e) } }
  const leave = () => confirmSheet({
    title: t('Leave {0}?', group.name),
    message: group.owner && group.members.length > 1 ? t('The group passes to the friend who joined first. Your numbers stop showing there.') : t('Your numbers stop showing there.'),
    confirmText: t('Leave'), danger: true,
    onConfirm: async () => { try { await leaveGroup(group.id); close(); onDone?.() } catch (e) { fail(e) } },
  })
  const remove = m => confirmSheet({
    title: t('Remove {0}?', m.name), message: t('They can join again only with a new invite link.'), confirmText: t('Remove'), danger: true,
    onConfirm: async () => { try { await removeMember(group.id, m.uid); close(); onDone?.() } catch (e) { fail(e) } },
  })
  return <>
    <h3>{group.name}</h3>
    <SharingSwitches value={sharing} onChange={save} />
    <Section>
      <Row title={t('Receive nudges')} subtitle={t('Friends can send you a push to get you training. One a day each at most.')}>
        <Switch aria-label={t('Receive nudges')} checked={nudges} onChange={nudge} />
      </Row>
    </Section>
    {group.owner && <Section title={t('Invite link')} footer={invite ? t('Works until {0}.', new Date(invite.expiresAt).toLocaleDateString()) : t('Turned off: nobody new can join.')}>
      {invite && <Row icon="share" title={t('Share invite link')} accessory="chevron" onClick={() => shareInvite(group.name, invite)} />}
      <Row icon="link" title={invite ? t('Make a new link') : t('Turn the link on')} subtitle={invite ? t('The old link stops working.') : null} accessory="chevron" onClick={() => inviteAgain(false)} />
      {invite && <Row icon="xmark" title={t('Turn the link off')} accessory="chevron" onClick={() => inviteAgain(true)} />}
      <Row icon="pencil" title={t('Rename group')} accessory="chevron" onClick={() => useUI.getState().openSheet(c => <NameSheet close={c} title={t('Rename group')} initial={group.name} action={async n => { await renameGroup(group.id, n); close(); onDone?.() }} />)} />
    </Section>}
    <Section title={t('Members')}>
      {group.members.map(m => <Row key={m.uid} title={m.self ? t('You') : m.name} subtitle={m.owner ? t('Started the group') : null}
        accessory={group.owner && !m.self ? 'chevron' : 'none'} onClick={group.owner && !m.self ? () => remove(m) : undefined} />)}
    </Section>
    <Button variant="plain" className="danger" onClick={leave} style={{ width: '100%' }}>{t('Leave group')}</Button>
  </>
}
export const groupSettingsSheet = (group, sharing, nudges, onDone) =>
  useUI.getState().openSheet(close => <GroupSettings close={close} group={group} sharing={sharing} nudges={nudges} onDone={onDone} />)
