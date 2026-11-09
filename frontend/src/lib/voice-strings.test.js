import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LPROJ, PAGE_LOCALE, PHRASES, STRINGS } from '../../ios/ci/voice-strings.mjs'

// Siri's words live in three places that have to agree: VoiceIntents.swift (the English keys and
// phrases), the .lproj files ios/ci/voice-strings.mjs writes, and Settings → Siri & Shortcuts,
// which shows the phrases in the page's language (src/locales).
const root = join(import.meta.dirname, '..', '..')
const swift = readFileSync(join(root, 'ios/App/App/VoiceIntents.swift'), 'utf8')
const lproj = (lang, file) => readFileSync(join(root, 'ios/App/App', `${lang}.lproj`, file), 'utf8')
const unq = s => s.replace(/\\"/g, '"')

describe('VoiceIntents.swift and its strings', () => {
  it('has every phrase in the table, and nothing more', () => {
    const inSwift = [...swift.matchAll(/^\s+"([^"\n]*\\\(\.applicationName\)[^"\n]*)",$/gm)].map(m => m[1].replace('\\(.applicationName)', '{app}'))
    expect(inSwift.length).toBeGreaterThan(0)
    expect(inSwift.sort()).toEqual(Object.keys(PHRASES).sort())
  })

  it('has every word it says in the table', () => {
    const keys = new Set([
      ...[...swift.matchAll(/say\("((?:[^"\\]|\\.)*)"/g)].map(m => unq(m[1])),
      ...[...swift.matchAll(/LocalizedStringResource = "((?:[^"\\]|\\.)*)"/g)].map(m => unq(m[1])),
      ...[...swift.matchAll(/IntentDescription\("((?:[^"\\]|\\.)*)"\)/g)].map(m => unq(m[1])),
      ...[...swift.matchAll(/IntentDialog\("((?:[^"\\]|\\.)*)"\)/g)].map(m => unq(m[1])),
      ...[...swift.matchAll(/@Parameter\(title: "((?:[^"\\]|\\.)*)"/g)].map(m => unq(m[1])),
    ])
    const missing = [...keys].filter(k => !(k in STRINGS))
    expect(missing).toEqual([])
    expect(keys.size).toBeGreaterThan(15)
  })

  it('wrote every language (run node frontend/ios/ci/voice-strings.mjs after a change)', () => {
    const app = s => s.replace(/\{app\}/g, '${applicationName}')
    for (const lang of LPROJ) {
      const phrases = lproj(lang, 'AppShortcuts.strings')
      for (const [key, t] of Object.entries(PHRASES)) {
        expect(phrases, `${lang} ${key}`).toContain(`"${app(key)}" = "${app(t[lang])}";`)
      }
      const words = lproj(lang, 'Localizable.strings')
      for (const [key, t] of Object.entries(STRINGS)) expect(words, `${lang} ${key}`).toContain(`"${key}" = "${t[lang]}";`)
    }
  })
})
