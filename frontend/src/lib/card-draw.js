// What every shared picture of openGym has in common: the two formats, the light and dark looks
// and the logo in the corner. Pure drawing, no DOM: the workout card (lib/workout-card.js, after a
// workout and in History) and Your year (lib/wrapped-cards.js) both paint with it, and
// lib/share-image.js gets the picture out of the app. No exercise picture or clip is ever drawn
// on a card (the licence keeps those inside the app, NOTICE.md).

// 9:16 for Stories and Reels, 1:1 for a feed or a chat.
export const FORMATS = { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } }
export const FORMAT_IDS = Object.keys(FORMATS)
export const STYLE_IDS = ['dark', 'light']
// No site of our own to print under the name (upstream printed opengym.ch here).
export const SITE = ''

/**
 * The colours of a card, the app's own (index.css) in a fixed light or dark look, whatever the
 * app shows right now. `acc` is the accent, as a hex or rgb colour; on light paper a bright accent
 * is too faint to read as text, so text in the accent (`accText`) is the accent darkened there.
 */
// "#rgb", "#rrggbb", "rgb(…)" or "rgba(…)" as [r, g, b, a]; null for anything else.
export function parseColor(value) {
  const s = String(value || '').trim()
  let m = s.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = i => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(p => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p)))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
}
// CSS color-mix(in srgb, a p%, b): p of `a` over the rest of `b`, as an rgb() string. A canvas
// is handed plain rgb, so the card does not depend on how a WebView parses color-mix().
export function mixColor(a, b, p) {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x || !y) return x ? a : b
  const ch = i => Math.round(x[i] * p + y[i] * (1 - p))
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
}

export function cardPalette(style, acc = '#a7c7a2') {
  const light = style === 'light'
  const a = parseColor(acc) ? acc : '#a7c7a2'
  return light
    ? { bg: '#f8f9f7', surface: '#ffffff', tile: '#f0f2ef', label: '#161b17', label2: '#626c64', acc: a, accText: mixColor(a, '#000000', 0.62), sep: '#dce2dc', light: true }
    : { bg: '#0b0d0c', surface: '#161a18', tile: '#202622', label: '#f5f7f4', label2: '#a0aaa1', acc: a, accText: a, sep: '#333a35', light: false }
}

// The Email's Gym slab E (design/emails_gym_icon.svg), in the icon's own 1024 grid: three bands
// as M/H/L/Q/Z paths, drawn with plain canvas calls (no Path2D, which not every runtime has).
const MARK_PATHS = [
  'M409 301 H702 Q718 301 709 317 L665 379 Q656 392 636 392 H353 Q338 392 348 378 L392 316 Q399 301 409 301Z',
  'M334 466 H650 Q667 466 658 482 L612 547 Q603 560 584 560 H278 Q264 560 273 545 L318 481 Q324 466 334 466Z',
  'M266 633 H580 Q596 633 586 649 L540 713 Q532 725 514 725 H211 Q196 725 207 710 L251 646 Q257 633 266 633Z',
]
const MARK_BOX = { x: 196, y: 301, w: 522, h: 424 }
export const MARK_ASPECT = MARK_BOX.w / MARK_BOX.h

function tracePath(ctx, d) {
  const tok = d.match(/[MHLQZ]|-?\d+(?:\.\d+)?/g)
  let i = 0, x = 0, y = 0
  const n = () => Number(tok[i++])
  ctx.beginPath()
  while (i < tok.length) {
    const c = tok[i++]
    if (c === 'M') { x = n(); y = n(); ctx.moveTo(x, y) }
    else if (c === 'L') { x = n(); y = n(); ctx.lineTo(x, y) }
    else if (c === 'H') { x = n(); ctx.lineTo(x, y) }
    else if (c === 'Q') { const cx = n(), cy = n(); x = n(); y = n(); ctx.quadraticCurveTo(cx, cy, x, y) }
    else if (c === 'Z') ctx.closePath()
  }
}

/** The logo mark, `h` high, its left edge at x, centred on y. */
export function drawMark(ctx, x, y, h, color) {
  const s = h / MARK_BOX.h
  ctx.save()
  ctx.translate(x - MARK_BOX.x * s, y - (MARK_BOX.y + MARK_BOX.h / 2) * s)
  ctx.scale(s, s)
  ctx.fillStyle = color
  for (const d of MARK_PATHS) { tracePath(ctx, d); ctx.fill() }
  ctx.restore()
}

/**
 * The footer every card ends with: the mark and "Email’s Gym" with "Gym" in the accent. `y` is the text's baseline. Drawn left to right whatever the language: it is a
 * logo, and a logo does not mirror.
 */
export function drawBrand(ctx, { x, y, width, colors, family, size = 40 }) {
  const markH = size * 0.78
  drawMark(ctx, x, y - size * 0.36, markH, colors.acc)
  let tx = x + markH * MARK_ASPECT + size * 0.4
  ctx.direction = 'ltr'
  ctx.textAlign = 'left'
  ctx.font = `800 ${size}px ${family}`
  ctx.fillStyle = colors.label
  ctx.fillText('Email’s ', tx, y)
  tx += ctx.measureText('Email’s ').width
  ctx.fillStyle = colors.accText || colors.acc
  ctx.fillText('Gym', tx, y)
  if (SITE) {
    ctx.font = `600 ${Math.round(size * 0.72)}px ${family}`
    ctx.fillStyle = colors.label2
    ctx.textAlign = 'right'
    ctx.fillText(SITE, x + width, y)
    ctx.textAlign = 'left'
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

