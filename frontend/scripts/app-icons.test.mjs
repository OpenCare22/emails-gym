/* The alternate home-screen icons: every file scripts/app-icons.mjs owns is there, the size each
 * platform wants, and drawn the way the script draws it today; and the native projects list the
 * same icons as src/lib/app-icon-variants.js, or the picker would offer one the phone has not got. */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { IOS_SIZE, PREVIEW, ROOT, draw, files, pngInfo, scene } from './app-icons.mjs'
import { APP_ICON_VARIANTS } from '../src/lib/app-icon-variants.js'

const read = rel => readFileSync(join(ROOT, rel), 'utf8')
const ALT = APP_ICON_VARIANTS.filter(v => v.id !== 'default')

describe('generated icon files', () => {
  it('are all committed', () => {
    const missing = files().map(([rel]) => rel).filter(rel => !existsSync(join(ROOT, rel)))
    expect(missing).toEqual([])
  })

  it('have the sizes each platform wants', () => {
    for (const v of APP_ICON_VARIANTS) {
      const preview = join(ROOT, `public/app-icons/${v.id}.png`)
      expect(pngInfo(readFileSync(preview))).toMatchObject({ width: PREVIEW, height: PREVIEW })
      expect(statSync(preview).size, v.id).toBeLessThanOrEqual(30 * 1024)
    }
    for (const v of ALT) {
      // Apple turns down an app icon with an alpha channel.
      const ios = readFileSync(join(ROOT, `ios/App/App/Assets.xcassets/${v.ios}.appiconset/icon-1024.png`))
      expect(pngInfo(ios)).toEqual({ width: IOS_SIZE, height: IOS_SIZE, alpha: false })
      const set = JSON.parse(read(`ios/App/App/Assets.xcassets/${v.ios}.appiconset/Contents.json`))
      expect(set.images).toEqual([{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }])
    }
  })

  it('match a fresh draw (the small ones; --check compares them all)', () => {
    for (const v of APP_ICON_VARIANTS) {
      expect(readFileSync(join(ROOT, `public/app-icons/${v.id}.png`)).equals(draw(v, PREVIEW)), v.id).toBe(true)
    }
  })
})

describe('node scripts/app-icons.mjs --check', () => {
  // Every committed icon against a fresh draw, the 1024s too (about 20 s, so it runs once, here).
  it('finds nothing out of date', () => {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts/app-icons.mjs'), '--check'], { encoding: 'utf8' })
    expect(out).toContain('app icons up to date')
  }, 120_000)
})

describe('the Halloween icon', () => {
  const v = APP_ICON_VARIANTS.find(x => x.id === 'halloween')

  it('is a hand-made SVG the renderer knows every piece of', () => {
    expect(v).toMatchObject({ name: 'Halloween', ios: 'AppIcon-Halloween', art: 'resources/icons/halloween.svg' })
    // scene() throws on any element it cannot draw.
    expect(scene(read(v.art)).length).toBeGreaterThan(10)
  })

  it('is dark at the edges, orange on the dumbbell, pale on the moon', () => {
    const shapes = scene(read(v.art))
    const at = (x, y) => shapes.find(s => s.hit(x, y)).color(x, y).map(Math.round)
    expect(at(256, 256)).toEqual([255, 122, 26])   // the bar
    expect(at(90, 110)).toEqual([247, 232, 180])   // the moon's lit side
    const corner = at(10, 500)
    expect(Math.max(...corner)).toBeLessThan(40)
  })

  it('keeps the web and its spider inside the safe zone Android promises', () => {
    // The round mask shows up to 256 from the centre but only guarantees 66 of 72 dp (about 234):
    // in that rim only the two thin moorings may show, not the web itself.
    const shapes = scene(read(v.art))
    let lit = 0
    for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
      const d = Math.hypot(x - 256, y - 256)
      if (d >= 234 && d <= 256 && Math.max(...shapes.find(s => s.hit(x, y)).color(x, y)) > 120) lit++
    }
    expect(lit).toBeLessThan(80)
    expect(shapes.find(s => s.hit(294, 178)).color(294, 178).map(Math.round)).toEqual([236, 223, 255])   // the spider
  })
})

describe('the Christmas icon', () => {
  const v = APP_ICON_VARIANTS.find(x => x.id === 'christmas')

  it('is a hand-made SVG the renderer knows every piece of', () => {
    expect(v).toMatchObject({ name: 'Christmas', ios: 'AppIcon-Christmas', android: 'IconChristmas', art: 'resources/icons/christmas.svg' })
    expect(scene(read(v.art)).length).toBeGreaterThan(20)
  })

  it('a lime dumbbell in a Santa hat, wrapped with a red ribbon, on a dark winter night', () => {
    const shapes = scene(read(v.art))
    const at = (x, y) => shapes.find(s => s.hit(x, y)).color(x, y).map(Math.round)
    expect(at(256, 256)).toEqual([163, 230, 53])    // the bar, openGym lime
    expect(at(165, 140)).toEqual([230, 57, 70])     // the hat
    expect(at(357, 300)).toEqual([230, 57, 70])     // the ribbon
    expect(at(150, 164)).toEqual([248, 249, 250])   // the hat's brim
    expect(Math.max(...at(10, 500))).toBeLessThan(40)
  })

  it('keeps everything inside the safe zone Android promises', () => {
    const shapes = scene(read(v.art))
    let lit = 0
    for (let y = 0; y < 512; y += 2) for (let x = 0; x < 512; x += 2) {
      const d = Math.hypot(x - 256, y - 256)
      if (d >= 234 && d <= 256 && Math.max(...shapes.find(s => s.hit(x, y)).color(x, y)) > 120) lit++
    }
    expect(lit).toBe(0)
  })
})

describe('iOS alternate icons', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj')

  it('every App build configuration names all alternate icon sets', () => {
    const names = [...pbx.matchAll(/ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES = "([^"]*)";/g)].map(m => m[1].split(' '))
    expect(names.length).toBe((pbx.match(/ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/g) || []).length)
    for (const n of names) expect(n).toEqual(ALT.map(v => v.ios))
    expect(names[0]).toContain('AppIcon-Halloween')
    expect(names[0]).toContain('AppIcon-Christmas')
  })

  it('the plugin is compiled, registered and knows the same sets', () => {
    expect(pbx).toMatch(/\/\* AppIconPlugin\.swift in Sources \*\/,/)
    expect(pbx).toMatch(/\/\* AppIconPlugin\.swift \*\/ = \{isa = PBXFileReference;[^}]*path = AppIconPlugin\.swift;/)
    expect(read('ios/App/App/MainViewController.swift')).toContain('bridge?.registerPluginInstance(AppIconPlugin())')
    const swift = read('ios/App/App/AppIconPlugin.swift')
    const pairs = [...swift.matchAll(/"(\w+)": "(AppIcon-\w+)"/g)].map(m => [m[1], m[2]])
    expect(pairs).toEqual(ALT.map(v => [v.id, v.ios]))
  })
})
