import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
const declarations = selector => rules.filter(([, selectors]) => selectors.split(',').some(s => s.trim() === selector)).map(([, , body]) => body).join(';')
const value = (body, property) => [...body.matchAll(new RegExp(`(?:^|;)\\s*${property}:([^;]+)`, 'g'))].at(-1)?.[1].trim()

describe('short control hit areas', () => {
  for (const [selector, height] of [['.btn.sm', 36], ['.seg button', 40], ['.sp-back', 34]]) {
    it(`${selector} grows vertically to 44px without changing its face`, () => {
      expect(value(declarations(selector), 'position')).toBe('relative')
      const target = declarations(`${selector}::before`)
      expect(value(target, 'content')).toBe("''")
      expect(value(target, 'position')).toBe('absolute')
      expect(value(target, 'inset')).toBe('0')
      expect(value(target, 'inset-block')).toBe('min(0px, calc((100% - 44px)/2))')
      for (const h of [height, 44, 50]) {
        const inset = Math.min(0, (h - 44) / 2)
        expect(h - 2 * inset).toBe(Math.max(h, 44))
      }
    })
  }

  it('chips split the unchanged row gap and never expand sideways or beyond a scrolling strip', () => {
    const row = declarations('.chips')
    expect(value(row, '--chip-row-gap')).toBe('7px')
    expect(value(row, 'gap')).toBe('var(--chip-row-gap) 7px')
    expect(value(row, 'padding')).toBe('4px 4px 6px')
    expect(value(declarations('.chip::before'), 'inset')).toBe('0')
    expect(value(declarations('.chips.wrap .chip::before'), 'inset-block')).toBe('max(calc(var(--chip-row-gap) / -2), min(0px, calc((100% - 44px)/2)))')
    const gap = parseFloat(value(row, '--chip-row-gap'))
    for (const height of [24, 32, 40, 44, 50]) {
      const growth = -Math.max(gap / -2, Math.min(0, (height - 44) / 2))
      expect(growth * 2).toBeLessThanOrEqual(gap)
      expect(height + growth * 2).toBeLessThanOrEqual(Math.max(height, 44))
      if (height === 32) expect(height + growth * 2).toBe(39)
    }
  })
})
