// Friends in the app (PLAN.md Phase 7; the server side is api/social/). The calls, and the pure
// helpers the Friends screen draws with, each tested in social.test.js.
import { api } from './api.js'
import { appBase } from './app-base.js'
import { t } from './i18n.js'

export const SHARE_KEYS = ['workouts', 'streak', 'volume', 'prs', 'steps', 'activeMinutes', 'strength', 'feed']
const LB_KG = 0.45359237

// What each sharing switch shows the group, in plain words.
export const SHARE_COPY = () => ({
  workouts: [t('Workouts'), t('How many workouts you finish each week, month and in total.')],
  streak: [t('Streak'), t('Weeks in a row with a workout.')],
  volume: [t('Volume'), t('The total weight you lift each week and month.')],
  prs: [t('Records'), t('How many personal records you set this month.')],
  steps: [t('Steps'), t('Your steps this week, from Fitbit or Apple Watch.')],
  activeMinutes: [t('Active minutes'), t('Your active minutes this week.')],
  strength: [t('Strength'), t('Your squat, bench and deadlift compared to your body weight.')],
  feed: [t('Activity'), t('A line when you finish a workout, with no weights or exercises.')],
})

// The boards, in the order the picker shows them. `ranges` [value, label]; the first is the default.
export const BOARDS = () => [
  { metric: 'workouts', label: t('Workouts'), ranges: [['week', t('This week')], ['month', t('This month')], ['all', t('All time')]] },
  { metric: 'streak', label: t('Streak'), ranges: [['current', t('Weeks in a row')]] },
  { metric: 'volume', label: t('Volume'), ranges: [['week', t('This week')], ['month', t('This month')]] },
  { metric: 'prs', label: t('Records'), ranges: [['month', t('This month')]] },
  { metric: 'steps', label: t('Steps'), ranges: [['week', t('This week')]] },
  { metric: 'activeMinutes', label: t('Active minutes'), ranges: [['week', t('This week')]] },
  { metric: 'strength', label: t('Strength'), ranges: [['squat', t('Squat')], ['bench', t('Bench')], ['deadlift', t('Deadlift')]] },
]

/** The plain-words definition shown under the board. */
export function boardMeaning(metric, range) {
  const m = {
    workouts: { week: t('Workouts completed this week'), month: t('Workouts completed this month'), all: t('Workouts completed in total') },
    streak: { current: t('Weeks in a row with a workout') },
    volume: { week: t('Total weight lifted this week'), month: t('Total weight lifted this month') },
    prs: { month: t('Personal records set this month') },
    steps: { week: t('Steps this week') },
    activeMinutes: { week: t('Active minutes this week') },
    strength: { squat: t('Best estimated squat in 90 days, per body weight'), bench: t('Best estimated bench press in 90 days, per body weight'), deadlift: t('Best estimated deadlift in 90 days, per body weight') },
  }
  return m[metric]?.[range] || ''
}

/** A row's value as the viewer reads it (volume in their own unit). */
export function formatValue(metric, value, { unit = 'kg' } = {}) {
  if (value == null) return '–'
  if (metric === 'volume') {
    const v = unit === 'lb' ? value / LB_KG : value
    return Math.round(v).toLocaleString() + ' ' + (unit === 'lb' ? t('lb') : t('kg'))
  }
  if (metric === 'strength') return t('{0} × body weight', value.toFixed(2))
  if (metric === 'streak') return t('{0} wk', value)
  return Math.round(value).toLocaleString()
}

/** The link a friend opens to join. */
export const inviteUrl = code => new URL(appBase().replace(/\/$/, '') + '/#/join/' + code, globalThis.location?.origin || 'https://emailsgym.com').href

/** The invite code inside whatever was pasted: a whole link, "#/join/CODE" or the code alone. */
export function codeFromText(text) {
  const s = String(text || '').trim()
  const m = /#\/join\/([A-Za-z0-9_-]{8,40})/.exec(s) || /^([A-Za-z0-9_-]{8,40})$/.exec(s)
  return m ? m[1] : null
}

export const getSocial = () => api('/api/social')
export const getBoard = (groupId, metric, range) => api('/api/social/leaderboard?' + new URLSearchParams({ groupId, metric, range }))
const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const createGroup = name => post('/api/social/groups', { name })
export const renameGroup = (groupId, name) => post('/api/social/rename', { groupId, name })
export const newInvite = (groupId, off = false) => post('/api/social/groups/invite', { groupId, off })
export const peekInvite = code => post('/api/social/peek', { code })
export const joinGroup = code => post('/api/social/join', { code })
export const leaveGroup = groupId => post('/api/social/leave', { groupId })
export const removeMember = (groupId, uid) => post('/api/social/remove', { groupId, uid })
export const setSharing = (groupId, sharing) => post('/api/social/sharing', { groupId, sharing })
export const setNudges = on => post('/api/social/nudges', { on })
export const nudge = (groupId, uid) => post('/api/social/nudge', { groupId, uid })
export const getTrophies = (groupId, uid) => api('/api/social/trophies?' + new URLSearchParams(uid ? { groupId, uid } : { groupId }))
export const getFeed = groupId => api('/api/social/feed?' + new URLSearchParams({ groupId }))
export const giveKudos = (groupId, itemId) => post('/api/social/kudos', { groupId, itemId })

/** "Dana finished Push Day, 2 records" (or "You finished a workout"). */
export function feedLine(item) {
  const who = item.self ? t('You') : item.name
  const what = item.title ? t('{0} finished {1}', who, item.title) : t('{0} finished a workout', who)
  const extra = [item.prs > 0 ? (item.prs === 1 ? t('1 record') : t('{0} records', item.prs)) : null,
    item.minutes > 0 ? t('{0} min', item.minutes) : null].filter(Boolean)
  return extra.length ? what + ', ' + extra.join(', ') : what
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function feedAgo(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  return min < 1 ? t('just now') : min < 60 ? t('{0} min ago', min) : min < 1440 ? t('{0} h ago', Math.round(min / 60)) : t('{0} days ago', Math.round(min / 1440))
}

/** What to tell the sender, by the server's answer or refusal code. */
export function nudgeMessage(result, error) {
  if (error) return ({ 'already-nudged': t('You already nudged them today.'), limit: t('That’s enough nudges for today.'), 'nudges-off': t('They’ve turned nudges off.') })[error.code] || error.message || t('Couldn’t send the nudge.')
  return result?.sent ? t('Nudge sent') : t('They’ll see it next time they open the app.')
}
