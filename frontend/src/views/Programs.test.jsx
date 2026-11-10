// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { programs } from '../lib/library-data.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ S: {}, params: {}, navs: [], confirm: null, toasts: [] }))
vi.mock('../store/useStore.js', () => {
  const getState = () => ({ S: mocks.S, update: fn => { fn(mocks.S) } })
  const useStore = sel => sel(getState())
  useStore.getState = getState
  return { useStore }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: text => mocks.toasts.push(text) }) } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => path => mocks.navs.push(path), useParams: () => mocks.params }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: options => { mocks.confirm = options } }))
const { default: Programs } = await import('./Programs.jsx')
const { default: ProgramDetail } = await import('./ProgramDetail.jsx')
let host, root
beforeEach(() => {
  mocks.S = { routines: [], programmes: {}, week: { 1: ['old'] } }
  mocks.params = {}; mocks.navs = []; mocks.confirm = null; mocks.toasts = []
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async C => { await act(async () => { root.render(<C />); await new Promise(resolve => setTimeout(resolve, 20)) }) }
const click = async text => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === text)
  expect(button).toBeTruthy()
  await act(async () => button.click())
}
it('browses unreviewed programs and combines filters with an empty state', async () => {
  await render(Programs)
  expect(host.textContent).toContain(programs[0].title)
  expect(host.textContent).toContain('Not reviewed by a coach yet')
  await click('Aerobic endurance')
  await click('4 days')
  expect(host.textContent).toContain('No programs match these filters.')
})
it('copies without starting and opens the editable programme', async () => {
  mocks.params.id = 'foundation-2'
  await render(ProgramDetail)
  expect(host.textContent).toContain('Week 1: 1 set per exercise, RIR 4')
  await click('Copy to my routines')
  expect(mocks.S.routines).toHaveLength(2)
  expect(mocks.S.programme).toBeUndefined()
  expect(mocks.S.week).toEqual({ 1: ['old'] })
  const p = Object.values(mocks.S.programmes)[0]
  expect(mocks.navs).toEqual(['/plan/prog/' + p.id])
})
it('confirms replacement before creating anything, then starts through the existing path', async () => {
  mocks.params.id = 'foundation-2'
  mocks.S.programmes.old = { id: 'old', name: 'Old block', weeks: [{}] }
  mocks.S.programme = { id: 'old', saved: { week: { 3: ['original'] } } }
  await render(ProgramDetail)
  await click('Start program')
  expect(mocks.confirm.title).toBe('Stop Old block and start Foundation / Two Days?')
  expect(mocks.S.routines).toHaveLength(0)
  await act(async () => mocks.confirm.onConfirm())
  expect(mocks.S.routines).toHaveLength(2)
  expect(mocks.S.programme.saved.week).toEqual({ 3: ['original'] })
  expect(mocks.toasts).toEqual(['Started Foundation / Two Days'])
})
it('shows corrected interval totals and handles unknown program links', async () => {
  mocks.params.id = 'conditioning-3'
  await render(ProgramDetail)
  expect(host.textContent).toContain('20 min: 6 easy, 2 × (2 hard, 3 easy), 4 easy')
  mocks.params.id = 'missing'
  await render(ProgramDetail)
  expect(host.textContent).toContain('Program not found.')
  expect(host.textContent).not.toContain('Start program')
})
