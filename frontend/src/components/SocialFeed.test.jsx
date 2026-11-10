// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ feed: { items: [] }, kudos: [], toast: vi.fn() }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('../lib/social.js', async orig => ({
  ...await orig(),
  getFeed: async () => structuredClone(mocks.feed),
  giveKudos: async (g, id) => { mocks.kudos.push(id); return { count: 1, mine: true } },
}))
const { default: SocialFeed } = await import('./SocialFeed.jsx')
let host, root
beforeEach(() => { mocks.kudos = []; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async () => { await act(async () => { root.render(<SocialFeed groupId="g1" />) }); await act(async () => {}) }
const at = new Date(Date.now() - 12 * 60000).toISOString()

it('says plainly when there is nothing yet', async () => {
  mocks.feed = { items: [] }
  await render()
  expect(host.textContent).toContain('Nothing yet. Workouts appear here when friends who share them finish one.')
})

it('lists friends’ workouts in plain words with a kudos button, and none on your own', async () => {
  mocks.feed = { items: [
    { id: 'b:1', uid: 'b', name: 'Dana', at, title: 'Push Day', sets: 12, prs: 2, minutes: 55, self: false, kudos: { count: 0, mine: false } },
    { id: 'a:1', uid: 'a', name: 'Emil', at, title: null, sets: 8, prs: 0, minutes: null, self: true, kudos: { count: 3, mine: false } },
  ] }
  await render()
  const lines = [...host.querySelectorAll('.feed-line')].map(e => e.textContent)
  expect(lines).toEqual(['Dana finished Push Day, 2 records, 55 min', 'You finished a workout'])
  expect(host.textContent).toContain('12 min ago')
  expect(host.querySelectorAll('.feed-kudos')).toHaveLength(1)
  expect(host.textContent).toContain('3 kudos')
  const k = host.querySelector('.feed-kudos')
  expect(k.getAttribute('aria-pressed')).toBe('false')
  await act(async () => k.click())
  expect(mocks.kudos).toEqual(['b:1'])
  expect(host.querySelector('.feed-kudos').getAttribute('aria-pressed')).toBe('true')
})
