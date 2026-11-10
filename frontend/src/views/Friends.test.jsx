// @vitest-environment happy-dom
// Friends (handoff §4C): an honest empty state until the server has friends (PLAN.md Phase 7),
// never placeholder people; the user's own row once, as "You"; Nudge only on other people's rows.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

import Friends, { LeaderboardRow } from './Friends.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, original, toast

beforeEach(() => {
  original = { S: useStore.getState().S, user: useStore.getState().user }
  useStore.setState({ S: structuredClone(DEF), user: { id: 'u1', name: 'Emil' } })
  toast = vi.fn()
  useUI.setState({ toast })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState(original)
})

const mount = async (props = {}) => { await act(async () => root.render(<Friends {...props} />)) }

describe('Friends', () => {
  it('without the friends API: the layout and an empty state, never made-up people', async () => {
    await mount()
    expect(host.querySelector('h1').textContent).toBe('Friends')
    expect([...host.querySelectorAll('.seg button')].map(b => b.textContent)).toEqual(['This week', 'Streaks', 'All time'])
    expect(host.textContent).toContain('Workouts completed this week')
    expect(host.querySelector('.friends-empty h2').textContent).toBe('No friends here yet')
    expect(host.querySelectorAll('.lb-row')).toHaveLength(0)
  })

  it('says what each ranking counts, in plain words', async () => {
    await mount()
    await act(async () => [...host.querySelectorAll('.seg button')].find(b => b.textContent === 'Streaks').click())
    expect(host.textContent).toContain('Weeks in a row with a workout')
  })

  it('Invite friends says plainly that invites are not there yet', async () => {
    await mount()
    await act(async () => host.querySelector('.friends-empty .btn').click())
    expect(toast).toHaveBeenCalledWith('Inviting friends arrives in a later update.')
  })

  it('with the API on, shows that it is loading instead of an empty list', async () => {
    await mount({ api: true })
    expect(host.querySelector('[role="status"]').textContent).toBe('Loading…')
    expect(host.querySelector('.friends-empty')).toBeNull()
  })
})

describe('a leaderboard row', () => {
  it('names the user once, as You, and offers Nudge only on other people', async () => {
    const onNudge = vi.fn()
    const rows = [
      { id: 'u1', rank: 1, name: 'Emil Mladenov', value: 5, self: true },
      { id: 'u2', rank: 2, name: 'Peter Petrov', value: 4 },
    ]
    await act(async () => root.render(<ol>{rows.map(r => <LeaderboardRow key={r.id} row={r} metricLabel="Workouts" onNudge={onNudge} />)}</ol>))
    const [mine, theirs] = host.querySelectorAll('.lb-row')
    expect(mine.classList.contains('lb-self')).toBe(true)
    expect(mine.querySelector('.lb-name').textContent).toBe('You')
    expect(mine.querySelector('.lb-sub').textContent).toBe('Emil Mladenov')
    expect(mine.querySelector('.lb-nudge')).toBeNull()
    expect(theirs.querySelector('.lb-avatar').textContent).toBe('PP')
    await act(async () => theirs.querySelector('.lb-nudge').click())
    expect(onNudge).toHaveBeenCalledWith(rows[1])
    expect(host.textContent.match(/Emil/g)).toHaveLength(1)
  })
})
