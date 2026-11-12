// @vitest-environment happy-dom
import React, { act } from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import FavStar from './FavStar.jsx'

let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

it('stars and unstars an exercise with one tap', () => {
  useStore.setState(s => ({ S: { ...s.S, favEx: [] } }))
  act(() => root.render(<FavStar id="0025" />))
  const b = host.querySelector('button')
  expect(b.getAttribute('aria-pressed')).toBe('false')
  expect(b.getAttribute('aria-label')).toBe('Add to favourites')
  act(() => { b.click() })
  expect(useStore.getState().S.favEx).toEqual(['0025'])
  expect(b.getAttribute('aria-pressed')).toBe('true')
  expect(b.getAttribute('aria-label')).toBe('Remove from favourites')
  act(() => { b.click() })
  expect(useStore.getState().S.favEx).toEqual([])
})
