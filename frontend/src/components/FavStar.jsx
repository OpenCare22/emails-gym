import { useStore } from '../store/useStore.js'
import { isFav, toggleFav } from '../lib/favourites.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

// The star at the front of an exercise row (the picker, the library): one tap stars or unstars
// it (lib/favourites.js), and starred exercises float to the top of every list.
export default function FavStar({ id }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const on = isFav(S, id)
  return <button type="button" className={'iconbtn fav-btn fav-row' + (on ? ' on' : '')} aria-pressed={on}
    aria-label={on ? t('Remove from favourites') : t('Add to favourites')}
    onClick={e => { e.stopPropagation(); update(s => { toggleFav(s, id) }) }}>
    <Icon name={on ? 'starFill' : 'star'} className={on ? 'fav-star' : 'fav-off'} />
  </button>
}
