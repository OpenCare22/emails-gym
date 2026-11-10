import { expect, it } from 'vitest'
import { requiresHomeScreen } from './install-required.js'

const user = { id: 'u1' }
const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }
const check = (nav, extra = {}) => requiresHomeScreen({ user, nav, win: {}, ...extra })

it.each([iphone, { userAgent: 'iPad' }, { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }])('requires installation on iOS browsers: %j', nav => {
  expect(check(nav)).toBe(true)
})
it.each([{ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }, { userAgent: 'Windows', maxTouchPoints: 10 }, { userAgent: 'Android', maxTouchPoints: 5 }, {}])('leaves other platforms alone: %j', nav => {
  expect(check(nav)).toBe(false)
})
it('allows signed-out visitors and native builds', () => {
  expect(check(iphone, { user: null })).toBe(false)
  expect(check(iphone, { mobile: true })).toBe(false)
})
it('allows either standalone signal', () => {
  expect(check({ ...iphone, standalone: true })).toBe(false)
  expect(check(iphone, { win: { matchMedia: query => ({ matches: query === '(display-mode: standalone)' }) } })).toBe(false)
})
