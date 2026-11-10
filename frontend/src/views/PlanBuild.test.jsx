// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ S: {}, navs: [], sheets: [], toasts: [], confirm: null }))
vi.mock('../store/useStore.js', () => {
  const getState = () => ({ S: mocks.S, update: fn => { fn(mocks.S) } })
  const useStore = sel => sel(getState())
  useStore.getState = getState
  return { useStore }
})
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: r => mocks.sheets.push(r), toast: x => mocks.toasts.push(x) }) } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => path => mocks.navs.push(path), useParams: () => ({}) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: o => { mocks.confirm = o } }))
const { default: PlanBuild } = await import('./PlanBuild.jsx')

let host, root
beforeEach(() => {
  vi.useFakeTimers()
  mocks.S = { unit: 'kg', routines: [], programmes: {}, week: {}, bodyweight: [{ d: '2026-11-09', w: 75 }], equipProfiles: [], workouts: [] }
  mocks.navs = []; mocks.sheets = []; mocks.toasts = []; mocks.confirm = null
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })
const render = async () => { await act(async () => { root.render(<PlanBuild />) }) }
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const row = title => [...host.querySelectorAll('button.lrow')].find(b => b.querySelector('.lrow-t')?.textContent === title)
const tap = async el => { expect(el).toBeTruthy(); await act(async () => { el.click() }) }
const pick = async title => tap(row(title))
const type = async (label, value) => {
  const input = host.querySelector(`input[aria-label="${label}"]`)
  expect(input, label).toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const body = async ({ height = 176, age = 25, sex = 'Male' } = {}) => {
  await type('Height in cm', height); await type('Age', age)
  await tap(button(sex)); await tap(button('Next'))
}
const friendA = async () => {
  await pick('Build muscle and lose fat'); await body()
  await pick('6 months to 2 years'); await pick('More than 25'); await pick('More than 30'); await pick('Yes')
  await pick('4 days'); await pick('60 min'); await pick('Full gym')
  await tap(button('Skip')); await tap(button('Skip')); await pick('No')
}
const built = async () => { for (let i = 0; i < 8; i++) await act(async () => { vi.advanceTimersByTime(400) }) }

it('asks one question at a time with a count, prefilled weight, and Back to Programs from the first', async () => {
  await render()
  expect(host.textContent).toContain('1 of 12')
  await pick('Build muscle')
  expect(host.textContent).toContain('2 of 12')
  expect(host.querySelector('input[aria-label="Weight in kg"]').value).toBe('75')
  await tap(host.querySelector('.hdr .iconbtn'))
  expect(host.textContent).toContain('1 of 12')
  await tap(host.querySelector('.hdr .iconbtn'))
  expect(mocks.navs).toEqual(['/programs'])
})

it('shows the building steps, then the plan with its reasons', async () => {
  await render()
  await friendA()
  expect(host.textContent).toContain('Building the best plan for you')
  for (const s of ['Choosing your split', 'Picking your exercises', 'Setting sets, reps and rest']) expect(host.textContent).toContain(s)
  await built()
  expect(host.querySelector('h1').textContent).toBe('Your plan: muscle and fat loss, 4 days')
  const why = host.querySelectorAll('.plan-why li')
  expect(why.length).toBeGreaterThanOrEqual(5)
  expect(host.textContent).toContain('Not reviewed by a coach yet')
  expect(host.textContent).toContain('Built from published training research by the EG Plan Model. Not medical advice.')
  expect(host.querySelectorAll('.card h3')[0].textContent).toBe('Upper A')
})

it('starts the plan as routines and a programme, and saves the body details', async () => {
  await render()
  await friendA(); await built()
  await tap(button('Start plan'))
  expect(mocks.S.routines).toHaveLength(4)
  const p = Object.values(mocks.S.programmes)[0]
  expect(p.src).toMatchObject({ model: 'EG Plan Model', modelVersion: 1, seed: 1 })
  expect(p.src.answers.health).toBeUndefined()
  expect(mocks.S.programme.id).toBe(p.id)
  expect(mocks.S.body).toMatchObject({ heightCm: 176, sex: 'male' })
  expect(mocks.navs).toEqual(['/plan/prog/' + p.id])
})

it('shuffles to other exercises with the same sessions, and swaps one exercise', async () => {
  await render()
  await friendA(); await built()
  const names = () => [...host.querySelectorAll('.program-exercise strong')].map(x => x.textContent)
  const before = names()
  for (let i = 0; i < 5 && names().join() === before.join(); i++) await tap(button('Shuffle exercises'))
  expect(names().join()).not.toBe(before.join())
  expect([...host.querySelectorAll('.card h3')].slice(0, 4).map(x => x.textContent)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
  const first = names()[0]
  await tap(host.querySelector('.program-exercise-head button'))
  expect(mocks.sheets).toHaveLength(1)
  const sheet = document.createElement('div'); document.body.append(sheet)
  const sheetRoot = createRoot(sheet)
  await act(async () => sheetRoot.render(mocks.sheets[0](() => {})))
  const options = sheet.querySelectorAll('button.lrow')
  expect(options.length).toBeGreaterThan(0)
  expect(options.length).toBeLessThanOrEqual(5)
  await act(async () => options[0].click())
  expect(names()[0]).not.toBe(first)
  await act(async () => sheetRoot.unmount()); sheet.remove()
})

it('takes feet, inches and pounds on a lb profile, and gives the model cm and kg', async () => {
  mocks.S.unit = 'lb'; mocks.S.bodyweight = [{ d: '2026-11-09', w: 165 }]
  await render()
  await pick('Build muscle and lose fat')
  expect(host.querySelector('input[aria-label="Weight in lb"]').value).toBe('165')
  await type('Height, feet', 5); await type('Height, inches', 10); await type('Age', 25)
  await tap(button('Male')); await tap(button('Next'))
  await pick('6 months to 2 years'); await pick('More than 25'); await pick('More than 30'); await pick('Yes')
  await pick('4 days'); await pick('60 min'); await pick('Full gym')
  await tap(button('Skip')); await tap(button('Skip')); await pick('No')
  await built()
  await tap(button('Save to my routines'))
  const p = Object.values(mocks.S.programmes)[0]
  expect(p.src.answers).toMatchObject({ heightCm: 177.8, weightKg: 74.84 })
  expect(mocks.S.programme).toBeUndefined()
})

it('sends a health answer of yes to a professional instead of a plan', async () => {
  await render()
  await pick('Build muscle'); await body()
  await pick('Not really, or not yet'); await pick('1 to 10'); await pick('11 to 30'); await pick('No')
  await pick('3 days'); await pick('45 min'); await pick('Full gym')
  await tap(button('Skip')); await tap(button('Skip')); await pick('Yes')
  expect(host.textContent).toContain('Talk to a doctor or physiotherapist')
  expect(host.querySelectorAll('.program-exercise')).toHaveLength(0)
})
