import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { trophyInfo, ALL_MILESTONES, backgroundsFor, cardClass, freshTrophies } from '../lib/trophies.js'
import { getTrophies } from '../lib/social.js'
import Icon from './Icon.jsx'

// A person's trophy cabinet (PLAN.md Phase 7 item 7): earned medals with their dates, and for your
// own, the ones still to earn greyed with how to get them, plus the card backgrounds to pick.

const fmt = iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function Medal({ kind, at, locked = false }) {
  const info = trophyInfo(kind)
  return <li className={'medal medal-' + info.tier + (locked ? ' medal-locked' : '')}>
    <span className="medal-badge" aria-hidden="true"><Icon name={locked ? 'lock' : info.icon} /></span>
    <span className="medal-name">{info.name}</span>
    <span className="medal-sub small dim">{locked ? info.how : fmt(at)}</span>
  </li>
}

export function Cabinet({ trophies, self }) {
  const earned = new Set(trophies.map(x => x.kind))
  const toEarn = self ? ALL_MILESTONES.filter(k => !earned.has(k)) : []
  if (!trophies.length && !toEarn.length) return <p className="dim small">{t('No trophies yet.')}</p>
  return <ul className="medal-grid" aria-label={t('Trophies')}>
    {trophies.map(x => <Medal key={x.id} kind={x.kind} at={x.at} />)}
    {toEarn.map(k => <Medal key={k} kind={k} locked />)}
  </ul>
}

function BackgroundPicker({ trophies }) {
  const chosen = useStore(s => s.S?.socialCard) || 'plain'
  return <div className="bg-pick" role="radiogroup" aria-label={t('Card background')}>
    {backgroundsFor(trophies).map(b => <button key={b.id} type="button" role="radio" aria-checked={chosen === b.id} disabled={!b.open}
      className={'bg-swatch ' + cardClass(b.id) + (chosen === b.id ? ' on' : '')}
      onClick={() => useStore.getState().update(s => { s.socialCard = b.id })}>
      <span className="bg-name">{b.name}</span>
      {!b.open && <span className="bg-how small">{b.how}</span>}
    </button>)}
  </div>
}

/** A friend's card (or yours): background, name and cabinet. Loads from the server. */
export function FriendCard({ groupId, uid }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let gone = false
    getTrophies(groupId, uid).then(d => {
      if (gone) return
      setData(d)
      if (d.self) {
        const fresh = freshTrophies(d.trophies)
        if (fresh.length) useUI.getState().toast(fresh.length === 1 ? t('New trophy: {0}', trophyInfo(fresh[0].kind).name) : t('{0} new trophies', fresh.length))
      }
    }).catch(() => { if (!gone) setData({ error: true }) })
    return () => { gone = true }
  }, [groupId, uid])
  if (!data) return <div className="friends-state" role="status">{t('Loading…')}</div>
  if (data.error) return <div className="friends-state" role="alert">{t('Couldn’t load the trophies.')}</div>
  return <div className="friend-card">
    <div className={'friend-card-top ' + cardClass(data.card, data.self ? data.trophies : null)}>
      <h3>{data.self ? t('Your trophies') : data.name}</h3>
      <span className="small">{t('{0} earned', data.trophies.length)}</span>
    </div>
    <Cabinet trophies={data.trophies} self={data.self} />
    {data.self && <>
      <h4 className="friend-card-h">{t('Card background')}</h4>
      <BackgroundPicker trophies={data.trophies} />
    </>}
  </div>
}

export const friendCardSheet = (groupId, uid) => useUI.getState().openSheet(() => <FriendCard groupId={groupId} uid={uid} />)
