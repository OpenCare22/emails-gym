// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ data: null, S: { socialCard: 'plain' }, toast: vi.fn() }))
vi.mock('../store/useStore.js', () => {
  const st = () => ({ S: mocks.S, update: fn => fn(mocks.S) })
  const useStore = sel => sel(st()); useStore.getState = st
  return { useStore }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast, openSheet: () => {} }) } }))
vi.mock('../lib/social.js', async orig => ({ ...await orig(), getTrophies: async () => structuredClone(mocks.data) }))
const { FriendCard } = await import('./TrophyCabinet.jsx')
let host, root
beforeEach(() => { mocks.S = { socialCard: 'plain' }; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async () => { await act(async () => { root.render(<FriendCard groupId="g1" uid="b" />) }); await act(async () => {}) }

it('a friend’s card: their background and earned medals only', async () => {
  mocks.data = { uid: 'b', name: 'Dana', self: false, card: 'stripes', trophies: [{ id: 'workouts-10', kind: 'workouts-10', at: '2026-11-01T10:00:00Z' }] }
  await render()
  expect(host.querySelector('h3').textContent).toBe('Dana')
  expect(host.querySelector('.friend-card-top').classList.contains('cardbg-stripes')).toBe(true)
  expect(host.querySelectorAll('.medal')).toHaveLength(1)
  expect(host.querySelector('.medal-name').textContent).toBe('10 workouts')
  expect(host.querySelector('.bg-pick')).toBeNull()
})

it('your own card: still-to-earn medals greyed, backgrounds to pick, locked ones disabled', async () => {
  mocks.data = { uid: 'a', name: 'Emil', self: true, card: null, trophies: [{ id: 'workouts-1', kind: 'workouts-1', at: '2026-11-01T10:00:00Z' }, { id: 'workouts-10', kind: 'workouts-10', at: '2026-11-02T10:00:00Z' }] }
  await render()
  expect(host.querySelector('h3').textContent).toBe('Your trophies')
  expect(host.querySelectorAll('.medal-locked').length).toBeGreaterThan(5)
  const stripes = [...host.querySelectorAll('.bg-swatch')].find(b => b.textContent.includes('Slab stripes'))
  const gold = [...host.querySelectorAll('.bg-swatch')].find(b => b.textContent.includes('Gold slab'))
  expect(stripes.disabled).toBe(false)
  expect(gold.disabled).toBe(true)
  await act(async () => stripes.click())
  expect(mocks.S.socialCard).toBe('stripes')
})
