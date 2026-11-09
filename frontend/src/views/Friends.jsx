import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { FRIENDS_API } from '../lib/fork-flags.js'
import { Segmented, Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

// Friends (design/EMAILS_GYM_CLAUDE_CODE_HANDOFF.md §4C). The server has no friends, leaderboards
// or nudges yet (PLAN.md Phase 7), so with FRIENDS_API off this shows the layout and an honest
// empty state, never placeholder people. When Phase 7 lands, `useLeaderboard` reads the server
// and the same rows draw it: the current user once, as "You", with a quiet highlight.
const RANGES = [
  { value: 'week', label: () => t('This week'), metric: () => t('Workouts completed this week') },
  { value: 'streak', label: () => t('Streaks'), metric: () => t('Weeks in a row with a workout') },
  { value: 'all', label: () => t('All time'), metric: () => t('Workouts completed in total') },
]

/** { status: 'off' | 'loading' | 'error' | 'ready', rows } for a range. Phase 7 fills this in. */
export function useLeaderboard(range, api = FRIENDS_API) {
  if (!api) return { status: 'off', rows: [], range }
  return { status: 'loading', rows: [], range }
}

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

export function LeaderboardRow({ row, metricLabel, onNudge }) {
  return (
    <li className={'lb-row' + (row.self ? ' lb-self' : '')}>
      <span className="lb-rank">{row.rank}</span>
      <span className="lb-avatar" aria-hidden="true">{initials(row.name)}</span>
      <span className="lb-who">
        <span className="lb-name">{row.self ? t('You') : row.name}</span>
        {row.self && <span className="lb-sub">{row.name}</span>}
      </span>
      <span className="lb-value" aria-label={metricLabel + ': ' + row.value}>{row.value}</span>
      {!row.self && onNudge && (
        <Button size="sm" className="lb-nudge" disabled={row.nudged} onClick={() => onNudge(row)}>
          {row.nudged ? t('Nudged') : t('Nudge')}
        </Button>
      )}
    </li>
  )
}

export default function Friends({ api = FRIENDS_API }) {
  const user = useStore(s => s.user)
  const toast = useUI(s => s.toast)
  const [range, setRange] = useState('week')
  const board = useLeaderboard(range, api)
  const r = RANGES.find(x => x.value === range)
  const invite = () => toast(user
    ? t('Inviting friends arrives in a later update.')
    : t('Friends need a profile on a server. Sign in first.'))

  return (
    <div className="friends">
      <div className="hdr">
        <div><h1>{t('Friends')}</h1></div>
        <div className="hdr-actions">
          <button type="button" className="iconbtn" onClick={invite} aria-label={t('Invite friends')}><Icon name="plus" /></button>
        </div>
      </div>
      <Segmented options={RANGES.map(x => ({ value: x.value, label: x.label() }))} value={range} onChange={setRange} />
      <p className="dim small friends-metric">{r.metric()}</p>

      {board.status === 'loading' && <div className="friends-state" role="status">{t('Loading…')}</div>}
      {board.status === 'error' && (
        <div className="friends-state" role="alert">{t('Couldn’t load your friends. Check your connection and try again.')}</div>
      )}
      {board.status === 'ready' && board.rows.length > 0 && (
        <ol className="lb-list">{board.rows.map(row => <LeaderboardRow key={row.id} row={row} metricLabel={r.metric()} />)}</ol>
      )}
      {(board.status === 'off' || (board.status === 'ready' && !board.rows.length)) && (
        <div className="friends-empty">
          <Icon name="users" />
          <h2>{t('No friends here yet')}</h2>
          <p className="dim">{t('When friends join, you’ll see who trained most this week, keep each other’s streaks going and send a nudge.')}</p>
          <Button variant="primary" onClick={invite}>{t('Invite friends')}</Button>
        </div>
      )}
    </div>
  )
}
