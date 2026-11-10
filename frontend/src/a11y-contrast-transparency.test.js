import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (f) => readFileSync(resolve(process.cwd(), 'src', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The body of the first top-level block whose prelude matches `head`, braces counted.
function block(css, head) {
  const at = css.search(head)
  if (at < 0) return ''
  const open = css.indexOf('{', at)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  return ''
}
const rule = (css, sel) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`))?.[1] || ''
}
const token = (decls, name) => decls.match(new RegExp(`${name}:\\s*([^;}]+)`))?.[1]?.trim()

const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
const rgba = (v) => { const m = v.match(/rgba\(([^)]+)\)/); const p = m[1].split(',').map(Number); return { rgb: p.slice(0, 3), a: p[3] } }
const lum = (rgb) => { const l = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] }
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
const over = ({ rgb, a }, bg) => rgb.map((c, i) => c * a + bg[i] * (1 - a))

describe('Increase Contrast (#707)', () => {
  const css = read('index.css')
  const hc = block(css, /@media\s*\(prefers-contrast:\s*more\)/)
  const themes = [
    ['dark', rule(css, ':root'), rule(hc, ':root')],
    ['light', rule(css, ':root[data-theme="light"]'), rule(hc, ':root[data-theme="light"]')],
  ]

  // The fork's text tokens are solid colours (index.css), so "firmer" is measured as contrast on
  // a card rather than as opacity: Increase Contrast must raise it, never lower it.
  const solid = v => hex(v)
  it.each(themes)('%s: secondary text reads at 4.5:1 on a card, hairlines get firmer', (_t, base, more) => {
    expect(more).not.toBe('')
    const card = hex(token(base, '--surface'))
    expect(ratio(solid(token(more, '--label-2')), card)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(solid(token(more, '--label-3')), card)).toBeGreaterThanOrEqual(4.5)
    for (const k of ['--label-2', '--label-3', '--sep', '--sep-op']) {
      const b = token(base, k), m = token(more, k)
      const was = b.startsWith('#') ? ratio(solid(b), card) : ratio(over(rgba(b), card), card)
      expect(ratio(solid(m), card), k).toBeGreaterThan(was)
    }
  })

  it('leaves the accents alone: their labels already reach 4.5:1 (lib/theme-contrast.test.js)', () => {
    expect(hc).not.toMatch(/--acc|--on-acc/)
    expect([...css.matchAll(/:root\[data-accent="(\w+)"\]\s*\{[^}]*--on-acc:(#\w+)/g)].map(m => m[1])).toEqual(['blue', 'terracotta', 'lavender'])
  })
})

describe('Reduce Transparency (#708)', () => {
  // Every blurred surface in a sheet has to be listed in that sheet's own
  // prefers-reduced-transparency block, with the blur off. A new frosted bar that forgets it
  // stays see-through for the people who asked for less of exactly that.
  it.each(['index.css', 'coach.css'])('%s: no surface keeps its blur', (file) => {
    const css = read(file)
    const reduce = block(css, /@media\s*\(prefers-reduced-transparency:\s*reduce\)/)
    const off = [...reduce.matchAll(/([^{}]+)\{[^}]*(?:^|;)\s*backdrop-filter:none/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()))
    const blurred = [...css.matchAll(/([^{}]+)\{[^}]*backdrop-filter:[^;}]*blur\(/g)]
      .flatMap((m) => m[1].split(',').map((s) => s.trim()))
      .filter((s) => !s.startsWith('@'))
    expect(blurred.length).toBeGreaterThan(0)
    for (const sel of blurred) expect(off, sel).toContain(sel)
  })
})
