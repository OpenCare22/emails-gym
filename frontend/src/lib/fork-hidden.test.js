import { describe, expect, it } from 'vitest'
import { HIDDEN, hidden } from './fork-hidden.js'
import { cardState, directory } from './integrations.js'
import { searchSettings } from '../views/settings-pages.js'
import { isOn } from './modules.js'
import { activeSeason, seasonAccent } from './seasonal.js'

const web = { mobile: false, platform: null, user: null, demo: false, health: null, server: null, offered: [] }
const iphone = { ...web, mobile: true, platform: 'ios', health: { status: 'available', granted: false } }
const guestWeb = { user: null, mobile: false, android: false, demo: false, webauthn: false, installTip: true, desktopWeb: true }
const tr = s => s

describe('what this fork hides (Phase 1, hide before delete)', () => {
  it('hides exactly the four features the plan names', () => {
    expect([...HIDDEN].sort()).toEqual(['app-icons', 'health-connect', 'imports', 'progress-photos', 'seasonal', 'structural-balance'])
    for (const id of HIDDEN) expect(hidden(id)).toBe(true)
    expect(hidden('body')).toBe(false)
  })

  it('takes the import cards and Health Connect off Integrations, on the web and on an iPhone', () => {
    for (const ctx of [web, iphone]) {
      for (const id of ['hevy', 'files', 'health-connect']) expect(cardState(id, ctx)).toBeNull()
      const ids = directory(ctx).flatMap(c => c.cards.map(card => card.id))
      expect(ids).not.toContain('hevy')
      expect(ids).not.toContain('files')
      expect(ids).not.toContain('health-connect')
    }
    // Export stays: only bringing data in from other apps is hidden.
    expect(cardState('csv', web)).toEqual({ status: null, action: 'export' })
  })

  it('leaves the imports out of the settings search, but keeps restoring a backup', () => {
    const found = q => searchSettings(q, guestWeb, tr).map(h => h.title)
    expect(found('import')).not.toContain('Import from another app')
    expect(found('import')).not.toContain('Import from Hevy')
    expect(found('import')).not.toContain('Import a file')
    expect(found('hevy')).not.toContain('Import from Hevy')
    expect(found('hevy')).not.toContain('Hevy')
    expect(found('import')).toContain('Import backup')
  })

  it('keeps seasonal themes off, so their colours never replace the Email\'s Gym accent', () => {
    const S = { modules: { seasonal: true }, seasonal: { halloween: 'on', halloweenColors: true } }
    expect(isOn(S, 'seasonal')).toBe(false)
    expect(activeSeason(S, new Date('2026-10-31T12:00:00'))).toBe(null)
    expect(seasonAccent(S, new Date('2026-10-31T12:00:00'))).toBe(null)
  })
})
