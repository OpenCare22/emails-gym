import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ mobile: true, platform: 'ios' }))
vi.mock('./mobile.js', () => ({ get MOBILE() { return h.mobile } }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => h.platform } }))
beforeEach(() => { vi.resetModules(); h.mobile = true; h.platform = 'ios' })

it('keeps the iPhone scanner and gym reminder, with App Store updates', async () => {
  const m = await import('./channel.js')
  expect(await m.getChannel()).toBe('appstore')
  expect(await m.gymReminderBuilt()).toBe(true)
  expect(await m.nativeScanner()).toBe(true)
  expect(await m.selfUpdates()).toBe(false)
})

it.each(['web', 'android'])('has no native capabilities on %s', async platform => {
  h.platform = platform
  const m = await import('./channel.js')
  expect(await m.getChannel()).toBe('web')
  expect(await m.gymReminderBuilt()).toBe(false)
  expect(await m.nativeScanner()).toBe(false)
  expect(await m.selfUpdates()).toBe(false)
})

it('keeps browser builds on the web channel', async () => {
  h.mobile = false
  const m = await import('./channel.js')
  expect(await m.getChannel()).toBe('web')
  expect(await m.nativeScanner()).toBe(false)
})
