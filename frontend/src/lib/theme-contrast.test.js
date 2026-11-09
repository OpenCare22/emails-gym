// Every text/background pair of the Email's Gym tokens meets WCAG AA, in both themes and with every
// accent preset (DESIGN_PLAN step 1). Reads the token blocks out of index.css itself, so a colour
// changed there without checking it fails here.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contrast } from './accent.js'
import { ACCENTS } from './format.js'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

const block = selector => {
  const at = css.indexOf(selector + ' {')
  if (at < 0) throw new Error('no block ' + selector)
  return css.slice(at, css.indexOf('\n}', at))
}
// '--x: #rrggbb' and '--x: var(--y)'; the references are resolved where the colours are read.
const vars = text => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6}\b|var\(--[a-z0-9-]+\))/gi)].map(m => [m[1], m[2].toLowerCase()]))
const resolve = T => Object.fromEntries(Object.entries(T).map(([k, v]) => {
  for (let i = 0; i < 5 && v.startsWith('var('); i++) v = T[v.slice(6, -1)] || v
  return [k, v]
}))
const accentVars = selector => {
  const m = css.match(new RegExp(selector.replace(/[[\]"]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))
  return m ? vars(m[1]) : {}
}

const DARK = vars(block(':root'))
const LIGHT = { ...DARK, ...vars(block(':root[data-theme="light"]')) }
const THEMES = { dark: DARK, light: LIGHT }

// The page, sheets and bars, cards, and the elevated surface: everything text sits on.
const GROUNDS = ['bg', 'bg-el', 'surface', 'surface-2']
const TEXT = ['label', 'label-2', 'label-3', 'label-dim', 'green-ink', 'orange-ink', 'red-ink', 'heart-rate']
const AA = 4.5
const UI = 3

const theme = (name, accent) => {
  const base = THEMES[name]
  if (accent === 'sage') return base
  const sel = name === 'dark' ? `:root[data-accent="${accent}"]` : `:root[data-theme="light"][data-accent="${accent}"]`
  return { ...base, ...accentVars(sel) }
}

// Status inks live in a later block of their own (the light ones darker).
const inks = name => {
  const re = name === 'dark' ? /:root\{\s*--streak-ink[^}]*\}/ : /:root\[data-theme="light"\]\{\s*--streak-ink[^}]*\}/
  return vars(css.match(re)[0])
}

describe('the Email\'s Gym tokens meet AA', () => {
  it('defines the handoff\'s values for both themes', () => {
    expect(DARK.bg).toBe('#0b0d0c')
    expect(DARK.surface).toBe('#161a18')
    expect(DARK.label).toBe('#f5f7f4')
    expect(DARK.acc).toBe('#a7c7a2')
    expect(LIGHT.bg).toBe('#f8f9f7')
    expect(LIGHT.label).toBe('#161b17')
    expect(LIGHT['acc-ink']).toBe('#355d3b')
    expect(Object.keys(ACCENTS)).toEqual(['sage', 'blue', 'terracotta', 'lavender'])
  })

  for (const name of ['dark', 'light']) {
    for (const accent of Object.keys(ACCENTS)) {
      it(`${name}, ${accent}: text 4.5:1, accent graphics and boundaries 3:1`, () => {
        const T = resolve({ ...theme(name, accent), ...inks(name) })
        const fails = []
        const check = (fg, bg, min) => {
          const r = contrast(T[fg], T[bg])
          if (!(r >= min)) fails.push(`${fg} on ${bg}: ${r.toFixed(2)} < ${min}`)
        }
        for (const bg of GROUNDS) {
          for (const fg of TEXT) check(fg, bg, AA)
          check('acc-ink', bg, AA)
          check('acc', bg, UI)
        }
        check('on-acc', 'acc', AA)
        check('on-btn', 'btn', AA)
        expect(fails).toEqual([])
      })
    }

    it(`${name}: heart-rate zones and chart series are 3:1 on cards`, () => {
      const T = resolve(THEMES[name])
      const fails = []
      for (const k of ['zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6']) {
        for (const bg of ['surface', 'surface-2']) {
          const r = contrast(T[k], T[bg])
          if (!(r >= UI)) fails.push(`${k} on ${bg}: ${r.toFixed(2)}`)
        }
      }
      expect(fails).toEqual([])
    })
  }
})
