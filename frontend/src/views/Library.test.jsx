// @vitest-environment happy-dom
// Favourites (issue #6): the Library floats starred exercises to the top of the current
// result list — after the search and body-part filters, without reordering the rest.
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Library from './Library.jsx'
import { EXDB } from '../lib/exercises.js'
import { CASED_NAME_LANGS, EXERCISE_NAME_LANGS, _setLangState } from '../lib/i18n-core.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({ S: state.S, user: null, update: mut => { const next = structuredClone(state.S); mut(next); state.S = next } })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
const navTo = vi.hoisted(() => ({ fn: () => {} }))
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => navTo.fn(...a) }))
vi.mock('../sheets.jsx', () => ({ exerciseDetailSheet: vi.fn(), addToRoutineSheet: vi.fn(), customExSheet: vi.fn(), menuSheet: vi.fn(), startFlow: vi.fn() }))
import { exerciseDetailSheet, addToRoutineSheet, menuSheet, startFlow } from '../sheets.jsx'

const mounted = []
function render() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<Library />))
  return host
}
const names = host => [...host.querySelectorAll('.item .tt')].map(el => el.textContent).slice(1)   // drop "Create your own"
const cssSource = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

beforeEach(() => {
  mocks.S = { unit: 'kg', lang: 'en', routines: [], workouts: [], customEx: [], exWeights: {}, equipProfiles: [], activeEquipId: null, equipFilterOn: false }
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Library favourites', () => {
  it('puts favourites first, marked with a star, and leaves the rest in catalogue order', () => {
    const plain = names(render())
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    const fav = [plain[6], plain[2]]
    mocks.S.favEx = fav.map(n => EXDB.find(e => e.n === n).id)
    const host = render()
    const shown = names(host)
    expect(shown.slice(0, 2)).toEqual(plain.filter(n => fav.includes(n)))
    expect(shown.slice(2)).toEqual(plain.filter(n => !fav.includes(n)))
    const rows = [...host.querySelectorAll('.item')].slice(1)
    expect(rows[0].querySelector('.fav-star')).not.toBeNull()
    expect(rows[2].querySelector('.fav-star')).toBeNull()
  })

  // The Library is the one page whose header puts a text button beside the title, so it leaves the
  // title the least room of anywhere in the app — 95px for Polish, 125px for Russian on a 320px
  // screen. The button must stay reachable (it is flex:none, the title block shrinks), but a title
  // squeezed that far must not come apart: at 34px "Упражнения" broke into three lines, so the
  // title drops a step on phone widths and breaks a word only as a last resort.
  it('keeps the header button reachable without shredding the title', () => {
    expect(cssSource).toContain('.hdr>div{min-width:0}')
    expect(cssSource).toContain('.hdr>.btn{flex:none}')
    // the page title is --fs-large, which drops from 34 to 30 px on phone widths (P1 type scale)
    expect(cssSource).toMatch(/\.hdr h1\{font-size:var\(--fs-large\)/)
    expect(cssSource).toMatch(/@media \(max-width:420px\)\{:root\{--fs-large:1\.875rem\}\}/)
    const h1 = cssSource.match(/^\.hdr h1\{([^}]*)\}/m)
    expect(h1?.[1]).toContain('overflow-wrap:break-word')
    expect(h1[1]).not.toContain('overflow-wrap:anywhere')
    expect(h1[1]).not.toContain('hyphens:auto')
  })

  it('keeps a favourite on top inside a body-part filter, but never pulls one in from elsewhere', () => {
    const chest = EXDB.filter(e => e.bp === 'chest')
    const legs = EXDB.find(e => e.bp !== 'chest')
    mocks.S.favEx = [chest[4].id, legs.id]
    const host = render()
    const chip = [...host.querySelectorAll('.chips .chip')].find(b => b.textContent === 'chest')
    act(() => chip.click())
    const shown = names(host)
    expect(shown[0]).toBe(chest[4].n)
    expect(shown).not.toContain(legs.n)
  })
})

// The header counts the catalogue, and from the first exercise of your own, those too (owner
// request for v1.3.10): "1324 animated exercises + 5 of your own". It has to stay one line on a
// phone, so it runs under the title row at full width, never wraps, and ellipsizes as a last resort.
describe('Library header count', () => {
  const sub = host => host.querySelector('.hdr .sub').textContent
  const own = n => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, n: 'my move ' + i, bp: 'chest', eq: '', custom: true }))
  afterEach(() => _setLangState('en', {}, null, null))

  it('shows only the catalogue while you have no exercises of your own', () => {
    expect(sub(render())).toBe(`${EXDB.length} exercises with animations`)
  })

  it('adds "+ 1 of your own" for a single custom exercise', () => {
    mocks.S.customEx = own(1)
    expect(sub(render())).toBe(`${EXDB.length} animated exercises + 1 of your own`)
  })

  it('adds the count for several custom exercises', () => {
    mocks.S.customEx = own(5)
    expect(sub(render())).toBe(`${EXDB.length} animated exercises + 5 of your own`)
  })

  it('keeps the subtitle on one line on wider screens, clipping with an ellipsis', () => {
    expect(sub(render())).toBeTruthy()
    const rule = cssSource.match(/^\.hdr\.lib-hdr>\.sub\.lib-count\{([^}]*)\}/m)?.[1] || ''
    expect(rule).toContain('white-space:nowrap')
    expect(rule).toContain('overflow:hidden')
    expect(rule).toContain('text-overflow:ellipsis')
    expect(rule).toContain('flex:1 0 100%')
    expect(cssSource).toMatch(/^\.hdr\.lib-hdr\{[^}]*flex-wrap:wrap/m)
  })

  it('lets the subtitle wrap on narrow phones so nothing is cut at 320 px', () => {
    const narrow = cssSource.match(/@media \(max-width:360px\)\{\.hdr\.lib-hdr>\.sub\.lib-count\{([^}]*)\}\}/)?.[1] || ''
    expect(narrow).toContain('white-space:normal')
    expect(narrow).toContain('overflow:visible')
  })
})

describe('Library similar exercises', () => {
  const search = (host, text) => {
    const input = host.querySelector('.search input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const label = host => host.querySelector('.similar-label')?.textContent || null

  it('offers what comes close instead of "No match" when nothing matches exactly', () => {
    const host = render()
    search(host, 'dumbbell curl qwxz')
    expect(label(host)).toBe('No exact match. These come close:')
    expect(host.textContent).not.toContain('No match')
    expect(names(host).slice(0, 5).some(n => /dumbbell.*curl/.test(n))).toBe(true)
  })

  it('lists similar ones under a short result list, without repeating a result', () => {
    const host = render()
    search(host, 'face pull')
    expect(label(host)).toBe('Similar exercises')
    const all = names(host)
    expect(new Set(all).size).toBe(all.length)
  })
})

// One tap to star from the list, and a ＋ that asks where the exercise goes (wayfinding pass,
// docs/superpowers/specs/2026-11-12-full-mode-wayfinding-design.md).
describe('Library row actions', () => {
  const firstRow = host => [...host.querySelectorAll('.item')][1]
  it('a row star toggles the favourite without opening the detail sheet', () => {
    exerciseDetailSheet.mockClear()
    const host = render()
    const row = firstRow(host)
    const star = row.querySelector('button[aria-pressed]')
    expect(star).not.toBeNull()
    act(() => { star.click() })
    expect(mocks.S.favEx).toHaveLength(1)
    expect(exerciseDetailSheet).not.toHaveBeenCalled()
  })

  it('＋ offers today\'s workout and a routine', () => {
    menuSheet.mockClear(); addToRoutineSheet.mockClear(); startFlow.mockClear()
    const host = render()
    act(() => { firstRow(host).querySelector('.lib-add').click() })
    const { items } = menuSheet.mock.calls.at(-1)[0]
    expect(items.map(i => i.label)).toEqual(["Add to today's workout", 'Add to a routine'])
    items[1].onClick()
    expect(addToRoutineSheet).toHaveBeenCalled()
    items[0].onClick()
    const id = startFlow.mock.calls.at(-1)?.[1]?.addEx
    expect(startFlow).toHaveBeenCalledWith([], { addEx: id })
    expect(typeof id).toBe('string')
  })

  it('with a session running, Add to today\'s workout appends it there', () => {
    menuSheet.mockClear(); startFlow.mockClear()
    mocks.S.active = { id: 'a', d: '2026-11-12', start: 1, routineIds: [], name: 'Freestyle', cur: 0, entries: [] }
    const host = render()
    act(() => { firstRow(host).querySelector('.lib-add').click() })
    menuSheet.mock.calls.at(-1)[0].items[0].onClick()
    expect(startFlow).not.toHaveBeenCalled()
    expect(mocks.S.active.entries).toHaveLength(1)
  })
})

describe('Library header', () => {
  it('is called Exercises, with a back arrow to Workouts and no switcher', () => {
    const calls = []; navTo.fn = p => calls.push(p)
    const host = render()
    expect(host.querySelector('.hdr h1').textContent).toBe('Exercises')
    expect(host.querySelector('.workouts-switch')).toBeNull()
    act(() => { host.querySelector('.hdr [data-back="/plan"]').click() })
    expect(calls).toEqual(['/plan'])
    navTo.fn = () => {}
  })
})

describe('Add to today\'s workout while a saved workout is open for editing', () => {
  it('adds nothing to it and says why', () => {
    menuSheet.mockClear(); startFlow.mockClear()
    mocks.S.active = { id: 'w', d: '2026-11-03', start: 1, routineIds: [], name: 'Push', cur: 0, entries: [], editingWorkoutId: 'w' }
    const host = render()
    act(() => { [...host.querySelectorAll('.item')][1].querySelector('.lib-add').click() })
    menuSheet.mock.calls.at(-1)[0].items[0].onClick()
    expect(startFlow).not.toHaveBeenCalled()
    expect(mocks.S.active.entries).toHaveLength(0)
  })
})
