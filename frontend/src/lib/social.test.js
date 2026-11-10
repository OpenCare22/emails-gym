import { describe, it, expect } from 'vitest'
import { formatValue, codeFromText, boardMeaning, BOARDS, SHARE_KEYS, SHARE_COPY, nudgeMessage } from './social.js'

describe('Friends helpers', () => {
  it('shows each metric in plain terms, volume in the viewer’s unit', () => {
    expect(formatValue('workouts', 3)).toBe('3')
    expect(formatValue('volume', 1000, { unit: 'kg' })).toBe('1,000 kg')
    expect(formatValue('volume', 1000, { unit: 'lb' })).toBe('2,205 lb')
    expect(formatValue('strength', 1.5)).toBe('1.50 × body weight')
    expect(formatValue('streak', 6)).toBe('6 wk')
    expect(formatValue('steps', null)).toBe('–')
  })
  it('finds the invite code in a link, a hash or on its own', () => {
    expect(codeFromText('Join my group\nhttps://emailsgym.com/#/join/abcdefghijklmnop')).toBe('abcdefghijklmnop')
    expect(codeFromText('  abcdefghijklmnop ')).toBe('abcdefghijklmnop')
    expect(codeFromText('#/join/abcdefghijklmnop')).toBe('abcdefghijklmnop')
    expect(codeFromText('hello')).toBeNull()
  })
  it('explains every board and every sharing switch', () => {
    for (const b of BOARDS()) for (const [range] of b.ranges) expect(boardMeaning(b.metric, range)).not.toBe('')
    const copy = SHARE_COPY()
    for (const k of SHARE_KEYS) expect(copy[k][1].length).toBeGreaterThan(10)
  })
  it('says what happened to a nudge', () => {
    expect(nudgeMessage({ sent: true })).toBe('Nudge sent')
    expect(nudgeMessage({ sent: false })).toBe('They’ll see it next time they open the app.')
    expect(nudgeMessage(null, { code: 'already-nudged' })).toBe('You already nudged them today.')
    expect(nudgeMessage(null, { code: 'nudges-off' })).toBe('They’ve turned nudges off.')
  })
})
