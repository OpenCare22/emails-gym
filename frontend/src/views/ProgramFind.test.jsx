// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ S: {}, navs: [] }))
vi.mock('../store/useStore.js', () => {
  const getState = () => ({ S: mocks.S, update: fn => { fn(mocks.S) } })
  const useStore = sel => sel(getState())
  useStore.getState = getState
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => path => mocks.navs.push(path), useParams: () => ({}) }))
const { default: ProgramFind } = await import('./ProgramFind.jsx')
let host, root
beforeEach(() => {
  mocks.S = { equipProfiles: [], activeEquipId: null }
  mocks.navs = []
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = async () => { await act(async () => { root.render(<ProgramFind />) }) }
const pick = async title => {
  const row = [...host.querySelectorAll('button.lrow')].find(b => b.querySelector('.lrow-t')?.textContent === title)
  expect(row, title).toBeTruthy()
  await act(async () => { row.click(); await new Promise(r => setTimeout(r, 0)) })
}
const answer = async list => { for (const a of list) await pick(a) }
// The results wait for the program data (a dynamic import): wait for them rather than a fixed time.
const settle = async () => {
  for (let i = 0; i < 100 && /Loading/.test(host.textContent); i++) await act(async () => { await new Promise(r => setTimeout(r, 20)) })
}

it('asks seven questions one at a time and shows matches with reasons', async () => {
  await render()
  expect(host.textContent).toContain('1 of 7')
  await answer(['Build muscle', 'Intermediate', '4 days', '90 min or more', 'Full gym', 'Some', 'No'])
  await settle()
  const cards = host.querySelectorAll('.card')
  expect(cards.length).toBeGreaterThan(0)
  expect(cards[0].textContent).toContain('Build / Four Days')
  expect(cards[0].textContent).toContain('Built for muscle growth')
  expect(cards[0].textContent).toContain('Not reviewed by a coach yet')
  await act(async () => cards[0].querySelector('button.lrow').click())
  expect(mocks.navs).toEqual(['/programs/build-4'])
})

it('goes back a question, and from the first question back to Programs', async () => {
  await render()
  await pick('Build muscle')
  expect(host.textContent).toContain('2 of 7')
  const back = () => act(async () => host.querySelector('.hdr .iconbtn').click())
  await back()
  expect(host.textContent).toContain('1 of 7')
  await back()
  expect(mocks.navs).toEqual(['/programs'])
})

it('suggests a professional instead of a program when health limits exercise', async () => {
  await render()
  await answer(['Build muscle', 'Intermediate', '4 days', '90 min or more', 'Full gym', 'Some', 'Yes'])
  await settle()
  expect(host.textContent).toContain('Talk to a doctor or physiotherapist')
  expect(host.querySelectorAll('.card')).toHaveLength(0)
})

it('says plainly when nothing fits', async () => {
  await render()
  await answer(['Build muscle', 'Intermediate', '5 or more', '90 min or more', 'No equipment', 'Some', 'No'])
  await settle()
  expect(host.textContent).toContain('No program fits these answers yet.')
})

it('offers the active gym profile and matches its equipment', async () => {
  mocks.S = { equipFilterOn: true, activeEquipId: 'g1', equipProfiles: [{ id: 'g1', name: 'Home', equipment: ['dumbbell'], accV: 2 }] }
  await render()
  await answer(['General fitness', 'Beginner', '2 days', '45 min'])
  expect(host.textContent).toContain('My gym: Home')
  await answer(['My gym: Home', 'Some', 'No'])
  await settle()
  expect(host.textContent).toContain('No program fits these answers yet.')
})
