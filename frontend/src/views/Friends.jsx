import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { FRIENDS_API } from '../lib/fork-flags.js'
import { BOARDS, boardMeaning, formatValue, getSocial, getBoard, nudge, nudgeMessage } from '../lib/social.js'
import { useUI } from '../store/useUI.js'
import { Segmented, Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { startGroupSheet, joinLinkSheet, groupSettingsSheet, shareInvite } from '../components/SocialSheets.jsx'
import SocialFeed from '../components/SocialFeed.jsx'

// Friends (design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md §4C, PLAN.md Phase 7): a group's leaderboard
// for one metric, from what each friend chose to share (api/social/). Honest empty states, never
// placeholder people; your own row once, as "You", with a quiet highlight.

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

export function LeaderboardRow({ row, metricLabel, valueText = String(row.value), onNudge }) {
  return (
    <li className={'lb-row' + (row.self ? ' lb-self' : '')}>
      <span className="lb-rank">{row.rank === 1 ? <Icon name="crown" aria-label={t('First')} /> : row.rank ?? '–'}</span>
      <span className="lb-avatar" aria-hidden="true">{initials(row.name)}</span>
      <span className="lb-who">
        <span className="lb-name">{row.self ? t('You') : row.name}</span>
        {row.self && <span className="lb-sub">{row.shared === false ? t('Only you see this') : row.name}</span>}
        {row.second != null && <span className="lb-sub">{t('Best {0}', row.second)}</span>}
      </span>
      <span className="lb-value" aria-label={metricLabel + ': ' + valueText}>{valueText}</span>
      {!row.self && onNudge && (
        <Button size="sm" className="lb-nudge" disabled={row.nudged} onClick={() => onNudge(row)}>
          {row.nudged ? t('Nudged') : t('Nudge')}
        </Button>
      )}
    </li>
  )
}

function Empty({ icon = 'users', title, text, children }) {
  return <div className="friends-empty">
    <Icon name={icon} />
    <h2>{title}</h2>
    {text && <p className="dim">{text}</p>}
    {children}
  </div>
}

export default function Friends({ api = FRIENDS_API }) {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const unit = useStore(s => s.S?.unit)
  const [social, setSocial] = useState(null) // /api/social
  const [state, setState] = useState(user && api ? 'loading' : 'off')
  const [groupId, setGroupId] = useState(null)
  const [metric, setMetric] = useState('workouts')
  const [range, setRange] = useState('week')
  const [board, setBoard] = useState(null)
  const [tab, setTab] = useState('board')

  const load = useCallback(async (pick) => {
    if (!user || !api) return
    try {
      const s = await getSocial()
      setSocial(s)
      setGroupId(id => pick || (s.groups.some(g => g.id === id) ? id : s.groups[0]?.id || null))
      setState('ready')
    } catch { setState('error') }
  }, [user, api])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!groupId) { setBoard(null); return }
    let gone = false
    setBoard(b => (b && b.groupId === groupId ? { ...b, loading: true } : null))
    getBoard(groupId, metric, range)
      .then(b => { if (!gone) setBoard({ ...b, groupId }) })
      .catch(() => { if (!gone) setBoard({ groupId, error: true, rows: [] }) })
    return () => { gone = true }
  }, [groupId, metric, range, social])

  const group = social?.groups.find(g => g.id === groupId) || null
  const boards = BOARDS()
  const def = boards.find(b => b.metric === metric) || boards[0]
  const pickMetric = m => { const b = boards.find(x => x.metric === m); setMetric(m); setRange(b.ranges[0][0]) }
  const settings = () => group && groupSettingsSheet(group, social.sharing[group.id], social.nudges, () => load())
  const invite = () => group?.invite ? shareInvite(group.name, group.invite) : settings()
  const meaning = boardMeaning(metric, range)
  const sendNudge = async row => {
    let result, error
    try { result = await nudge(groupId, row.uid) } catch (e) { error = e }
    useUI.getState().toast(nudgeMessage(result, error))
    if (!error || error.code === 'already-nudged') setBoard(b => ({ ...b, rows: b.rows.map(r => (r.uid === row.uid ? { ...r, nudged: true } : r)) }))
  }
  const nobodyShares = board && !board.error && board.rows.every(r => r.self) && (group?.members.length || 0) > 1

  return (
    <div className="friends">
      <div className="hdr">
        <div><h1>{t('Friends')}</h1></div>
        {group && <div className="hdr-actions">
          {group.owner && <button type="button" className="iconbtn" onClick={invite} aria-label={t('Invite friends')}><Icon name="plus" /></button>}
          <button type="button" className="iconbtn" onClick={settings} aria-label={t('Group settings')}><Icon name="gear" /></button>
        </div>}
      </div>

      {state === 'off' && <Empty title={t('No friends here yet')}
        text={user ? t('Friends arrive in a later update.') : t('Friends need a profile on a server. Sign in first.')} />}
      {state === 'loading' && <div className="friends-state" role="status">{t('Loading…')}</div>}
      {state === 'error' && <div className="friends-state" role="alert">
        {t('Couldn’t load your friends. Check your connection and try again.')}
        <Button onClick={() => { setState('loading'); load() }} style={{ marginTop: 12 }}>{t('Try again')}</Button>
      </div>}

      {state === 'ready' && !social.groups.length && <Empty title={t('No friends here yet')}
        text={t('Start a group and send your friends the link, or join one with a link a friend sent you. You choose what each group sees.')}>
        <Button variant="primary" onClick={() => startGroupSheet(g => load(g?.id))}>{t('Start a group')}</Button>
        <Button onClick={() => joinLinkSheet(code => nav('/join/' + code))}>{t('Join with a link')}</Button>
      </Empty>}

      {state === 'ready' && group && <>
        {social.groups.length > 1 && <div className="chips friends-groups" role="group" aria-label={t('Groups')}>
          {social.groups.map(g => <button key={g.id} className={'chip' + (g.id === groupId ? ' on' : '')} aria-pressed={g.id === groupId} onClick={() => setGroupId(g.id)}>{g.name}</button>)}
        </div>}
        {social.groups.length === 1 && <p className="dim small friends-group">{group.name}</p>}

        {group.members.length > 1 && <Segmented className="friends-tabs" value={tab} onChange={setTab} options={[{ value: 'board', label: t('Leaderboard') }, { value: 'feed', label: t('Feed') }]} />}
        {tab === 'feed' && group.members.length > 1 ? <SocialFeed groupId={group.id} /> : <>
        <div className="chips friends-metrics" role="group" aria-label={t('Leaderboard')}>
          {boards.map(b => <button key={b.metric} className={'chip' + (b.metric === metric ? ' on' : '')} aria-pressed={b.metric === metric} onClick={() => pickMetric(b.metric)}>{b.label}</button>)}
        </div>
        {def.ranges.length > 1 && <Segmented options={def.ranges.map(([value, label]) => ({ value, label }))} value={range} onChange={setRange} />}
        <p className="dim small friends-metric">{meaning}</p>

        {group.members.length === 1 && <Empty title={t('Just you so far')} text={t('Send your friends the invite link. It works for 14 days.')}>
          {group.owner && <Button variant="primary" onClick={invite}>{t('Invite friends')}</Button>}
        </Empty>}
        {!board && group.members.length > 1 && <div className="friends-state" role="status">{t('Loading…')}</div>}
        {board?.error && <div className="friends-state" role="alert">{t('Couldn’t load this leaderboard.')}</div>}
        {board && !board.error && group.members.length > 1 && <>
          <ol className="lb-list">{board.rows.map(row => <LeaderboardRow key={row.uid} row={row} metricLabel={meaning}
            valueText={formatValue(metric, row.value, { unit })} onNudge={sendNudge} />)}</ol>
          {nobodyShares && <p className="dim small friends-note">{t('Nobody in this group shares this yet.')}</p>}
          {board.rows.find(r => r.self)?.shared === false && <p className="dim small friends-note">
            <Button variant="plain" onClick={settings}>{t('Share this with the group')}</Button>
          </p>}
        </>}
        </>}
      </>}
    </div>
  )
}
