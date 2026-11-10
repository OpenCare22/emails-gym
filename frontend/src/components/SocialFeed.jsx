import { useEffect, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { getFeed, giveKudos, feedLine, feedAgo } from '../lib/social.js'
import Icon from './Icon.jsx'

// The Friends feed (PLAN.md Phase 7 item 5): finished workouts of friends who share their activity
// with this group, newest first, with a one-tap kudos. Never weights or exercises.
export default function SocialFeed({ groupId }) {
  const [feed, setFeed] = useState(null)
  useEffect(() => {
    let gone = false
    setFeed(null)
    getFeed(groupId).then(f => { if (!gone) setFeed(f) }).catch(() => { if (!gone) setFeed({ error: true, items: [] }) })
    return () => { gone = true }
  }, [groupId])

  const kudos = async item => {
    const before = feed
    const flip = { count: item.kudos.count + (item.kudos.mine ? -1 : 1), mine: !item.kudos.mine }
    setFeed(f => ({ ...f, items: f.items.map(i => (i.id === item.id ? { ...i, kudos: flip } : i)) }))
    try {
      const k = await giveKudos(groupId, item.id)
      setFeed(f => ({ ...f, items: f.items.map(i => (i.id === item.id ? { ...i, kudos: k } : i)) }))
    } catch (e) { setFeed(before); useUI.getState().toast(e?.message || String(e)) }
  }

  if (!feed) return <div className="friends-state" role="status">{t('Loading…')}</div>
  if (feed.error) return <div className="friends-state" role="alert">{t('Couldn’t load the feed.')}</div>
  if (!feed.items.length) return <div className="friends-empty">
    <Icon name="list" />
    <p className="dim">{t('Nothing yet. Workouts appear here when friends who share them finish one.')}</p>
  </div>
  return <ul className="feed-list">
    {feed.items.map(item => <li key={item.id} className={'feed-item' + (item.self ? ' feed-self' : '')}>
      <div className="feed-text">
        <span className="feed-line">{feedLine(item)}</span>
        <span className="feed-when small dim">{feedAgo(item.at)}</span>
      </div>
      {item.self
        ? item.kudos.count > 0 && <span className="feed-kudos-count small dim">{tn('{0} kudos', '{0} kudos', item.kudos.count)}</span>
        : <button type="button" className={'feed-kudos' + (item.kudos.mine ? ' on' : '')} aria-pressed={item.kudos.mine}
          aria-label={item.kudos.mine ? t('Take back kudos, {0} in all', item.kudos.count) : t('Give kudos, {0} so far', item.kudos.count)} onClick={() => kudos(item)}>
          <Icon name={item.kudos.mine ? 'starFill' : 'star'} /><span>{item.kudos.count || ''}</span>
        </button>}
    </li>)}
  </ul>
}
