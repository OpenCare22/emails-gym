// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import FeelRow from './FeelRow.jsx'
import ReturnNote from './ReturnNote.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
const render = el => { host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(el)) }
const click = el => act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const button = name => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === name)
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('FeelRow', () => {
  it('asks with three choices and none shown as picked', () => {
    const got = []
    render(<FeelRow value={null} onChange={v => got.push(v)} />)
    expect(host.textContent).toContain('How did that feel?')
    expect(['Easy', 'Good', 'Hard'].map(button).every(Boolean)).toBe(true)
    expect(host.querySelector('.feel-none')).not.toBe(null)
    expect(host.querySelector('[aria-pressed="true"]')).toBe(null)
    click(button('Easy'))
    expect(got).toEqual(['easy'])
  })
  it('a set answer folds into a chip that reopens, and picking it again clears it', () => {
    const got = []
    render(<FeelRow value="easy" onChange={v => got.push(v)} />)
    expect(button('Felt easy')).toBeTruthy()
    expect(button('Easy')).toBeFalsy()
    click(button('Felt easy'))
    click(button('Easy'))
    expect(got).toEqual([null])
  })
})

describe('ReturnNote', () => {
  it('offers the usual plan, then easing in again', () => {
    let n = 0
    render(<ReturnNote days={10} usual={false} onToggle={() => n++} />)
    expect(host.textContent).toContain('Back after 10 days, so today is a little lighter.')
    click(button('Use my usual plan'))
    expect(n).toBe(1)
    act(() => root.render(<ReturnNote days={10} usual onToggle={() => n++} />))
    expect(host.textContent).toContain('Using your usual plan.')
    expect(button('Ease in instead')).toBeTruthy()
  })
})
