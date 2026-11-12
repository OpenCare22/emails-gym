// @vitest-environment happy-dom
// The library's "Add to today's workout" with nothing in progress starts a Freestyle session that
// already holds the exercise (sheets.jsx startFlow's `addEx`).
import { beforeEach, expect, it } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { startFlow } from './sheets.jsx'

beforeEach(() => { useStore.setState({ S: { ...structuredClone(DEF), weighIn: false }, user: null }) })

it('starts a Freestyle session with the exercise in it', () => {
  startFlow([], { addEx: '0025' })
  const a = useStore.getState().S.active
  expect(a.routineIds).toEqual([])
  expect(a.entries.map(e => e.id)).toEqual(['0025'])
})

it('starts an empty Freestyle session without it', () => {
  startFlow([])
  expect(useStore.getState().S.active.entries).toEqual([])
})
