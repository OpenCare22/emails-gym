// Features this fork hides but keeps (docs/fork/PLAN.md, Phase 1: "hide before you delete").
// Each id is checked where its entry points are drawn; the code behind them is untouched. To bring
// one back, delete its id here. After a week or two of use, the ones nobody missed get deleted.
//
//   progress-photos      Stats → Progress photos, and /progress-photos
//   structural-balance   Stats → Structural balance, and /structural-balance
//   imports              importing from other apps: Settings → Data and the Integrations cards
//                        (Import backup stays: it restores this app's own backups)
//   health-connect       the Android-only Health Connect card on Integrations
//   app-icons            upstream's alternate app icons (phone app only); the icon is the slab E
//   seasonal             the Seasonal themes module (Halloween, Christmas): their colours would
//                        replace the Email's Gym accent (DESIGN_PLAN step 1)
export const HIDDEN = new Set(['progress-photos', 'structural-balance', 'imports', 'health-connect', 'seasonal', 'app-icons'])

/** Whether a feature is hidden in this fork. */
export const hidden = id => HIDDEN.has(id)
