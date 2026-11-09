// @vitest-environment happy-dom
// #303: DEFAULT_LANG from /api/config sets the language of a fresh copy — the sign-in screen,
// and a profile created from it — and nothing else. A copy saved before the mark existed keeps
// its language even when that is the old default, 'en': it may well have been chosen.
//
// The language worked out for such a copy is the device's own and is never written into the
// synced state: two devices with browsers in different languages would otherwise push their
// answers over each other on every sync round.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { api } from '../lib/api.js'
import { effectiveLang } from '../lib/default-lang.js'
import { useStore, freshState, DEF } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const nav = langs => Object.defineProperty(navigator, 'languages', { value: langs, configurable: true })
const shown = () => { const { S, config } = useStore.getState(); return effectiveLang(S, config) }
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT')

beforeEach(() => { localStorage.clear(); api.mockReset(); nav(['en-US']); useStore.setState({ config: null }) })
afterEach(() => { localStorage.clear(); useStore.setState({ S: clone(DEF), user: null, ready: false, config: null }) })

describe('instance default language', () => {
  it('a fresh copy is marked as not having picked a language; DEF is not', () => {
    expect(freshState().langAuto).toBe(true)
    expect(DEF.langAuto).toBeUndefined()
  })

  it('an existing copy with lang "en" and no mark is left in English', () => {
    nav(['de-DE'])
    useStore.setState({ S: { ...clone(DEF), lang: 'en' }, config: { default_lang: 'pt-BR' } })
    expect(shown()).toBe('en')
  })

  it('two devices with browsers in different languages do not push the profile back and forth', async () => {
    // Device B's browser is English; the server copy was last written from device A (German).
    nav(['en-US'])
    const server = { ...clone(DEF), _ts: 100, lang: 'de', langAuto: true, workouts: [{ id: 'w1', d: '2026-09-01', start: 1, entries: [] }] }
    useStore.setState({ S: clone(server), user: { id: 'u1' }, ready: true, config: { invite_only: false } })
    localStorage.setItem('gym_sync', JSON.stringify({ rev: 5, ts: 100 }))
    expect(shown()).toBe('en')
    expect(useStore.getState().S.lang).toBe('de')

    // The next poll: the server has not moved, and this device owes it nothing.
    api.mockResolvedValue({ state: { ...server, _rev: 5 }, rev: 5 })
    await useStore.getState().pullState()
    await useStore.getState().pullState()
    expect(puts()).toHaveLength(0)
    expect(useStore.getState().S.lang).toBe('de')
    expect(shown()).toBe('en')
  })
})
