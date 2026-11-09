// The Email's Gym mark (design/emails_gym_icon.svg): the forward-leaning slab E. `tile` draws it on
// the icon's near-black square (rounded like an app icon); without it, the bands alone in the
// current text colour, so it follows the theme. Decorative unless given a `label`.
const BANDS = [
  'M409 301 H702 Q718 301 709 317 L665 379 Q656 392 636 392 H353 Q338 392 348 378 L392 316 Q399 301 409 301Z',
  'M334 466 H650 Q667 466 658 482 L612 547 Q603 560 584 560 H278 Q264 560 273 545 L318 481 Q324 466 334 466Z',
  'M266 633 H580 Q596 633 586 649 L540 713 Q532 725 514 725 H211 Q196 725 207 710 L251 646 Q257 633 266 633Z',
]

export default function BrandMark({ size = 28, tile = false, label, className }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  if (tile) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 1024 1024" {...a11y}>
        <rect width="1024" height="1024" rx="230" fill="#0b0d0c" />
        <g fill="#f4f6f2" transform="translate(45 0)">{BANDS.map(d => <path key={d} d={d} />)}</g>
      </svg>
    )
  }
  // The bands' own box (x 196-718, y 301-725), so the mark sits flush with the text beside it.
  return (
    <svg className={className} width={size * 522 / 424} height={size} viewBox="196 301 522 424" fill="currentColor" {...a11y}>
      {BANDS.map(d => <path key={d} d={d} />)}
    </svg>
  )
}
