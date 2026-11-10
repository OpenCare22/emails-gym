// @vitest-environment happy-dom
// Friends (handoff §4C, PLAN.md Phase 7): real groups and boards from api/social/, honest empty
// states, never placeholder people; your own row once, as "You"; ties share a rank.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ user: { id: 'a', name: 'Emil' }, social: null, boards: {}, navs: [], sheets: [], posts: [] }))
vi.mock('../store/useStore.js', () => {
  const st = () => ({ user: mocks.user, S: { unit: 'kg' } })
  const useStore = sel => sel(st()); useStore.getState = st
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const ui = { openSheet: r => mocks.sheets.push(r), toast: vi.fn() }
  const useUI = sel => sel(ui); useUI.getState = () => ui
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => p => mocks.navs.push(p), useParams: () => ({ code: 'abcdefghijklmnop' }) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: o => o.onConfirm() }))
vi.mock('../lib/social.js', async orig => ({
  ...await orig(),
  getSocial: async () => structuredClone(mocks.social),
  getBoard: async (groupId, metric, range) => structuredClone(mocks.boards[`${metric}:${range}`] || { metric, range, rows: [] }),
  setSharing: async (groupId, sharing) => { mocks.posts.push(['sharing', groupId, sharing]); return { sharing } },
  peekInvite: async () => ({ name: 'Gym lads', members: 3, owner: 'Dana' }),
  joinGroup: async code => { mocks.posts.push(['join', code]); return { group: { id: 'g1', name: 'Gym lads' } } },
}))
const { default: Friends, LeaderboardRow } = await import('./Friends.jsx')
const { default: JoinGroup } = await import('./JoinGroup.jsx')

const me = { uid: 'a', name: 'Emil', self: true, owner: true }
const group = (members = [me], extra = {}) => ({ id: 'g1', name: 'Gym lads', owner: true, members, invite: { code: 'abcdefghijklmnop', expiresAt: '2026-11-25T00:00:00Z' }, ...extra })
const sharingOff = { workouts: false, streak: false, volume: false, prs: false, steps: false, activeMinutes: false, strength: false, feed: false }
let host, root
beforeEach(() => {
  mocks.user = { id: 'a', name: 'Emil' }; mocks.boards = {}; mocks.navs = []; mocks.sheets = []; mocks.posts = []
  mocks.social = { groups: [], sharing: {}, nudges: true }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const mount = async (el = <Friends />) => { await act(async () => { root.render(el) }); await act(async () => {}); await act(async () => {}) }
const btn = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)

it('signed out: says friends need a profile on a server, and nothing else', async () => {
  mocks.user = null
  await mount()
  expect(host.textContent).toContain('Friends need a profile on a server. Sign in first.')
  expect(host.querySelectorAll('.lb-row')).toHaveLength(0)
})

it('no group yet: start one or join with a link, never made-up people', async () => {
  await mount()
  expect(host.textContent).toContain('No friends here yet')
  expect(btn('Start a group')).toBeTruthy()
  await act(async () => btn('Join with a link').click())
  expect(mocks.sheets).toHaveLength(1)
  expect(host.querySelectorAll('.lb-row')).toHaveLength(0)
})

it('alone in a group: invite friends', async () => {
  mocks.social = { groups: [group()], sharing: { g1: sharingOff }, nudges: true }
  await mount()
  expect(host.textContent).toContain('Just you so far')
  expect(btn('Invite friends')).toBeTruthy()
})

it('a leaderboard: ranks with ties, a crown for first, you once with a quiet highlight', async () => {
  mocks.social = { groups: [group([me, { uid: 'b', name: 'Dana' }, { uid: 'c', name: 'Sam' }])], sharing: { g1: { ...sharingOff, workouts: true } }, nudges: true }
  mocks.boards['workouts:week'] = { metric: 'workouts', range: 'week', rows: [
    { uid: 'b', name: 'Dana', value: 3, rank: 1 }, { uid: 'a', name: 'Emil', value: 2, rank: 2, self: true, shared: true }, { uid: 'c', name: 'Sam', value: 2, rank: 2 },
  ] }
  await mount()
  const rows = [...host.querySelectorAll('.lb-row')]
  expect(rows.map(r => r.querySelector('.lb-name').textContent)).toEqual(['Dana', 'You', 'Sam'])
  expect(rows[0].querySelector('.lb-rank .icn, .lb-rank svg')).toBeTruthy()
  expect(rows.slice(1).map(r => r.querySelector('.lb-rank').textContent)).toEqual(['2', '2'])
  expect(rows[1].classList.contains('lb-self')).toBe(true)
  expect(host.textContent).toContain('Workouts completed this week')
})

it('a metric nobody shares says so, and offers to share yours', async () => {
  mocks.social = { groups: [group([me, { uid: 'b', name: 'Dana' }])], sharing: { g1: sharingOff }, nudges: true }
  mocks.boards['workouts:week'] = { metric: 'workouts', range: 'week', rows: [{ uid: 'a', name: 'Emil', value: 1, rank: 1, self: true, shared: false }] }
  await mount()
  expect(host.textContent).toContain('Only you see this')
  expect(host.textContent).toContain('Nobody in this group shares this yet.')
  await act(async () => btn('Share this with the group').click())
  expect(mocks.sheets).toHaveLength(1)
})

it('switching to volume shows it in the viewer’s unit', async () => {
  mocks.social = { groups: [group([me, { uid: 'b', name: 'Dana' }])], sharing: { g1: sharingOff }, nudges: true }
  mocks.boards['volume:week'] = { metric: 'volume', range: 'week', rows: [{ uid: 'b', name: 'Dana', value: 12345, rank: 1 }] }
  await mount()
  await act(async () => btn('Volume').click())
  await act(async () => {})
  expect(host.querySelector('.lb-value').textContent).toBe('12,345 kg')
})

it('the join page asks what to share, Workouts and Streak ticked, then joins', async () => {
  await mount(<JoinGroup />)
  expect(host.querySelector('h1').textContent).toBe('Join Gym lads?')
  expect(host.textContent).toContain('Started by Dana · 3 people')
  const on = [...host.querySelectorAll('input[type="checkbox"], [role="switch"]')].map(s => s.checked ?? s.getAttribute('aria-checked') === 'true')
  expect(on.filter(Boolean)).toHaveLength(2)
  await act(async () => btn('Join group').click())
  await act(async () => {})
  expect(mocks.posts[0]).toEqual(['join', 'abcdefghijklmnop'])
  expect(mocks.posts[1][2]).toMatchObject({ workouts: true, streak: true, volume: false, feed: false })
  expect(mocks.navs).toEqual(['/friends'])
})

it('LeaderboardRow offers Nudge only on other people’s rows', async () => {
  await mount(<ol>
    <LeaderboardRow row={{ uid: 'a', name: 'Emil', value: 1, rank: 1, self: true }} metricLabel="x" onNudge={() => {}} />
    <LeaderboardRow row={{ uid: 'b', name: 'Dana', value: 1, rank: 1 }} metricLabel="x" onNudge={() => {}} />
  </ol>)
  expect([...host.querySelectorAll('.lb-nudge')]).toHaveLength(1)
})
