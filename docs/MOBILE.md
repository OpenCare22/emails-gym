# The iPhone app

**Just want the app?** See [getting the app](#getting-the-app): the App Store (and the public
TestFlight beta) on an iPhone. These links are for upstream openGym. Then read
[how the phone app works](#how-the-phone-app-works) and
[connecting it to your server](#connecting-the-app-to-your-own-server). Everything from
[Prerequisites](#prerequisites) on is for building the app yourself.

## Getting the app

| | Where | Updates |
|---|---|---|
| **iPhone and iPad** | The [App Store](https://apps.apple.com/app/id6822275400). To test the next version early: the [public TestFlight beta](https://testflight.apple.com/join/RKATb61k) | the App Store or TestFlight |
| **Apple Watch** | Comes with the iPhone app | with the iPhone app |

## How the phone app works

openGym ships in two flavors from the same codebase:

| | **Self-hosted** (this repo's default) | **Mobile app** (`VITE_MOBILE=1`) |
|---|---|---|
| Runs | in any browser, against your own server | natively on iPhone (Capacitor shell) |
| Accounts | passkey sign-in, one profile per person | none, the phone *is* the account |
| Data | synced to your server, readable on desktop | stays on the device (file in the app's private storage) |
| Reminders | Web Push from your server | native local notifications, no server involved |
| Exercise media | served by your server (`exercise-media/`) | packed into the app (`exercise-media/`) |

The mobile flavor never talks to a backend by default: no sign-in screen, no sync, no
telemetry. State is mirrored from `localStorage` into `opengym-state.json` in the app's
private data directory on every change (iOS is allowed to evict WebView storage under
pressure; the file mirror is the durable copy and is restored on launch). Backups go out
through the OS share sheet instead of a browser download.

### Connecting the app to your own server

On first launch the app asks how you want to use it. Alongside the fully local mode above,
you can instead **connect it to a self-hosted openGym server**: your data then lives there,
synced the same way the browser PWA does, instead of only on the phone. This is a mode of the
same app, not a different build or download.

Passkeys can't be used for this: the app's WebView runs at its own origin, which never
matches the real hostname WebAuthn needs. Instead you *pair* the device from a browser
that's already signed in: Settings → Account → **"Pair the mobile app"** first asks you to confirm
it's you (your passkey, or your password where password sign-in is on), then shows a one-time
code (valid 5 minutes, and a new one is a tap away once it runs out); enter your server's address and that code in the app (same first-launch screen,
or Settings → Account → **"Connect to my server"** later) to finish. Notes:

- Works offline too: the phone keeps its copy (and the file mirror) while connected, and
  changes made without a network go to the server as soon as it is reachable again.
- `https://` is best: it keeps the pairing code and the bearer token (the connection carries one
  instead of a cookie) off the network in plain text.
- Pairing says your server "refused the app's request (CORS)", or that "a login page or proxy
  rule replied instead of openGym", or fails with "Failed to fetch" on an older version, while
  the browser works? Something in front of openGym is answering the app instead: a reverse proxy
  handling the CORS preflight itself, adding a second `Access-Control-Allow-Origin`, or SSO /
  forward-auth on `/api/`. openGym answers the preflight and does its own sign-in; see
  [Phone app and CORS](SELF_HOSTING.md#phone-app-and-cors) for the fixes and a `curl` self-check.
- The token lasts `SESSION_DAYS` (90 by default, see `docs/SELF_HOSTING.md`) and renews
  itself: every time the app starts, a token past half its life is swapped for a fresh one.
  A phone that is used at all never runs out; one left unopened for longer than
  `SESSION_DAYS` has to be paired again.
- "Sign out everywhere" (Settings → Account, in the browser) revokes a paired app's access
  too: it's the same signed session token either way, just delivered over a header instead
  of a cookie. The phone has no passkey to sign back in with, so it has to be **paired
  again**; nothing on it is lost meanwhile (see below). See `/api/pair/create` and
  `/api/pair/redeem` in `api/server.js` for the exchange itself.
- Settings → Account → "Disconnect" first checks that your server has every change. If it has, the
  phone drops cleanly back to local mode. If not, it says how many changes are missing and
  offers **Try again**, **Export backup**, or **Disconnect anyway**, which keeps those
  changes on the phone and adds them back the next time it is paired with the same server
  and account.

### A server behind Cloudflare Access

If your server sits behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
(Zero Trust), the app can't do Access's interactive sign-in from inside its WebView. Use a
**service token** instead:

1. In Zero Trust → Access → Service Auth, create a service token and note its Client ID and
   Client Secret.
2. In the Access application for your openGym host, add a policy with the **Service Auth**
   action that includes that token.
3. In the application's **CORS settings**, enable **Bypass OPTIONS requests to origin**. The
   app runs on its own origin, so every request is preceded by a CORS preflight, and a
   preflight never carries the token. Without the bypass, Access refuses it and nothing
   gets through. The openGym API answers the preflight itself and allows both headers.
4. In the app, before connecting: first-launch screen → **Connection settings** (or the
   **Cloudflare Access** button in the Connect sheet), enter your server's address and the two
   values, then pair as usual. They can be changed later under Settings → **Server & sync** →
   **Cloudflare Access**.

The app then sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` with every request to
the server address they were entered for (scheme, host and port), including the pairing itself,
and with nothing else: a pairing with any other address goes without them. Disconnecting from
the server removes them. Both are kept in the phone's secure storage (iOS Keychain), never in synced data or backups.

### Connection states

Settings → Account → **Server & sync** shows the server, the account, how things stand, when the phone
last held exactly what the server holds, how many changes are still waiting, and a **Sync
now** button that says how it went. Whenever the app is *not* connected, a line under the
status bar says so on every screen, and stays until the condition is gone:

| The line says | What it means | What to do |
|---|---|---|
| *Offline. Your changes are saved on this device…* | No answer at all: no network, the server is down, or it did not answer within 20 s (60 s for an upload). | Nothing, it syncs by itself once the server is reachable. **Try again** checks at once. |
| *Your server answered with an error (HTTP 502)…* | The server (or the proxy in front of it) answered with an error. The code is the one the server sent. | Check the server and its proxy logs; **Try again** once it is back. A 413 means the proxy's upload limit is too small (`client_max_body_size`). |
| *Your server's address answered with something other than openGym (HTTP 200)…* | Something else answered in the server's place, typically a proxy's sign-in page or a catch-all that serves the web app for `/api/*`. | Let `/api/*` through to the openGym API unchanged, including the `Authorization` header. |
| *Your server no longer accepts this phone…* | The server refused the phone's token (401): "sign out everywhere", the account disabled, a `data/secret` that was replaced, a token older than `SESSION_DAYS`, or a proxy with its own login that rejects `Authorization: Bearer`. | **Pair again**: in a signed-in browser open Settings → "Pair the mobile app" and enter the new code. The address is already filled in. |
| *This phone is no longer paired with your server…* | A phone that an earlier version of the app unpaired by itself after its token was refused. The address is gone. | **Pair again**, typing the address. |
| *On this phone only, not connected to a server* | Local mode, chosen at first launch or after Disconnect. Said quietly. | Nothing, or **Connect** to pair with a server. |

Don't want the line? Settings → Look & Home → **Show connection status** turns it off (it is on
by default, and the setting travels with your profile). A phone kept local on purpose then shows
nothing at all. On a phone with a server, a problem (offline, an error, a refused phone, or
changes still waiting after a few seconds) puts a small orange dot on the **Home** tab and on
the Settings gear instead; Settings → Account → Server & sync says what it is.

In every one of these states the phone keeps its data and every change you make. Pairing
again with the **same account** merges what the phone kept with what the server has (new
workouts from both sides, the later edit of each routine, the newer copy's settings), and
nothing needs to be exported first. Pairing with a *different* account keeps the first
account's unsent changes aside on the phone until that account comes back.

Where the phone keeps things, in case you ever need them by hand:

- `opengym-state.json` in the app's private data directory: the durable copy of everything
  on the phone, written after every change (not reachable without a rooted phone or `adb`
  on a debug build). `opengym-state-owner.json` beside it says which account that copy
  belongs to: a paired phone only ever takes the file back for that account.
- `opengym-stash.json`, same directory: changes kept by "Disconnect anyway" or by another
  account pairing, waiting for their server and account.
- `Documents/openGym/opengym-backup-YYYY-MM-DD.json`: only with Settings → Data & backup → **Auto-backup on
  changes** switched on: a dated copy after every finished workout or edited routine, in a
  folder of its own under the phone's Documents folder, where a file manager or a sync app
  (Syncthing, a cloud folder) can reach it without taking the rest of Documents along. One
  file per day; each new copy deletes all but the newest 14 of these dated files in that
  folder. Nothing else is deleted, in that folder or anywhere: other files you keep there, and
  the copies versions before 1.3.9 wrote straight into `Documents/`, stay until you remove
  them yourself. Settings → Data & backup → **Import backup** reads any of them back, wherever it is.

### Photos and videos of your own exercises

An exercise you create can carry one photo, GIF or short video, and a link to a video or guide.
The file is prepared on the phone before it is kept anywhere: a photo is re-encoded (at most
1600 px, WebP or JPEG; the location and camera data a phone writes into a photo do not
survive), a GIF loses its comment and metadata blocks, and an MP4/MOV keeps its picture and
sound while its metadata and any GPS or sensor track are zeroed. The original file name is
never stored.

- **Where it lives:** `Library/opengym-media/` in the app's own storage (iOS's Library folder), one file per photo or video named by its SHA-256, plus a small
  `index.json`. The state keeps only a reference of a few hundred bytes. A MOV is stored with
  an `.mp4` name so the WebView plays it.
- **Local mode:** that folder is the only copy. **Export with photos & videos (.zip)** in
  Settings → Data & backup writes a zip with the usual JSON backup and every file, through the share
  sheet; **Import backup** takes that zip back. The daily auto-backup stays JSON only.
- **Paired with a server:** files go up to the server (`PUT /api/media/{hash}`) and come down
  with the phone's token into the same folder, so they show offline too. A file that has not
  reached the server yet is owed like an unsynced change: **Disconnect** says so and keeps it.
  Big files wait for Wi-Fi unless you tap Settings → Data & backup → **Photos & videos**.
- **Backups:** iOS includes Library in iCloud and computer backups.
- **Permissions:** iOS asks for the camera
  (`NSCameraUsageDescription`, now also for photos and videos of exercises and for filming a
  set) and, to record a video with sound from the picker, the microphone
  (`NSMicrophoneUsageDescription`).

### Filming a set

During a workout, **Film this set** in a set's menu (and **Film a set** under More in the
exercise's ⋯ menu) records a short video for that set, or picks one from the phone's videos. It
uses the same file input, ingest, folder and sync as the photos above; what is particular:

- **Recording:** a file input with `accept="video/*" capture="environment"`. iOS opens its camera
  in video mode.
- **Length and size:** the server's `videoSec` and `videoMB` from `/api/config`, or 60 s and
  40 MB in local mode. A longer or bigger video is refused before it is kept. There is no
  transcoding or compression: neither platform offers it to the WebView without a native plugin,
  and the app does not add one, so the camera's own file is what is kept. A long clip filmed in
  4K can hit the size cap; 1080p is plenty to judge depth.
- **Where it lives:** on the set, `set.media = [ref]`, one per set and at most 24 per workout. In
  local mode only in `opengym-media/`. Paired, it goes up with the workout once it is saved,
  unless **Keep videos on this phone only** was on when it was filmed (the ref then says
  `local: true`): the sync never sends it, Settings counts it as kept on this phone, and other
  devices show "On the phone that filmed it". A sign-out still treats it as owed and keeps it
  aside with the stash, since it is the only copy.
- **Deleting:** a removed set, a deleted workout or Remove on the video takes the reference away;
  the file goes with the local clean-up (after its one-hour grace) and the server's GC, like any
  removed photo. A copied set does not take the video along.
- **Privacy:** never in a Coach request, an MCP answer (only a count), a share card, Wrapped, a
  PDF, a CSV or a plan file. The zip backup carries the files, as it does every photo.

Worth checking on a real device after changes here, since no test runs a WebView: a short
a long video seeks from its `_capacitor_file_` URL; an iPhone photo arrives as JPEG and an iPhone video (HEVC or H.264 MOV)
plays; the zip export opens the share sheet.

### Apple Health

Settings → Integrations → **Apple Health** controls writing finished workouts and weigh-ins.
Permissions and sync state stay on this phone in `opengym-health.json`.
The Apple Watch uses the same switch.

#### Reading back: heart rate and weigh-ins (v1.4.3, #544, #127)

Two more switches in the same Apple Health card, each off by
default, each independent of writing and of the other:

- **Heart rate from your watch.** For each workout finished in the last 24 hours, the heart-rate
  samples between its start and end (+5 min) are read: `HC.readHeartRate({ from, to })` →
  `{ samples: [[ms, bpm]] }`. `lib/heart-rate.js` `hrFromSamples` splits them over the sets: a set
  ends at its tick (`at`) and lasts as long as its reps (3 s each, 15-120 s), seconds or minutes
  take, never starting before the previous tick (the same estimate as the .fit export); its rest
  runs to the next set. A set gets `hr` / `restHr` (`{ avg, max }`, the Apple Watch fields) only
  when it has none yet, so the Apple Watch's live reading is never replaced. Sparse sources (median
  gap over 20 s, a band that saves once a minute) and workouts without ticks get only the session's
  reading, `w.hr = { avg, max, src: 'hc' | 'ah', n }`, replaced later only by a fuller read from
  the same hub (Garmin and Fitbit sync late) and never when `src` is `'watch'`. Re-read at most
  every 10 minutes (2 after coming back to the foreground) until the 24 hours are over.
- **Weigh-ins from other apps.** `HC.readWeights({ since })` → `{ records: [{ t, kg, id, origin,
  clientId }] }`: 30 days back the first time, afterwards from the newest seen minus two days. `lib/health-read.js` `mergeWeighIns`
  keeps every sample with its time as a weigh-in of its day (#859, `lib/weigh-ins.js`), under an id
  made from the hub's own record id, so two phones reading the same sample add it once. It skips
  openGym's own records (`clientRecordId` `opengym-*`, origin `ch.duartesantos.opengym*`), a sample
  at a minute the day already has a weigh-in for (typed in, or read before), one removed in openGym
  (the day's `gone`), and a whole day deleted in openGym after it was measured, and converts to lb
  for an lb profile. Imported weigh-ins carry `src` and are never written back (`healthRecords`
  leaves them out); typed ones stand beside them, and the daily-value setting picks the day's number.
- **Foreground only.** Reads run at launch, on resume and after saves, never in the background.
  Old workouts are not filled in.
- **Device-local state** in `opengym-health.json`: `readHr`, `readWeight`, `wCursor`, `seen` (what
  was imported, per hub sample), `hrTried` (when each recent workout was last read), `readError`.
- **iPhone:** `AppleHealthPlugin.swift` `readHeartRate` / `readWeights` through `HKSampleQuery`;
  the plain-value conversion is `WatchCore/Sources/WatchCore/HealthReadCore.swift` (compiled into
  the app, tested by `swift test`). Apple Health never says whether reading was allowed, so a
  refusal reads nothing. The usage string (`NSHealthShareUsageDescription`) says what is read.
- **Synced fields:** `set.hr`, `set.restHr`, `w.hr`, `bodyweight[].src` are plain optional fields;
  the server keeps them through every writer (`api/test/sync-hr.test.js`).
#### Heart rate from AirPods on the iPhone (iOS 26, #818)

AirPods Pro 3 and Powerbeats Pro 2 measure the heart rate, but iOS turns their sensor on only while
an app on the iPhone runs a workout session, which third-party apps may do since iOS 26. So the
iPhone runs one, the same `HKWorkoutSession` + `HKLiveWorkoutBuilder` the Apple Watch app runs:

- **When:** the iPhone app on iOS 26 or later, the Apple Health switch on (no switch of its own), a
  live workout (not one logged afterwards, not the tour's practice), and no Apple Watch app taking
  it. "Taking it" means the watch sent a heart rate or any event for that workout while its Apple
  Health is on, or the watch app is reachable right now with Apple Health on. A watch that could
  take it gets 15 s after the start to show up (the phone opens the watch app then); if it takes
  the workout later anyway, the phone's session is dropped unsaved. One workout in Apple Health,
  never two. `lib/phone-workout.js` `phoneSessionPlan` decides, its tests pin it.
- **Per set:** the native side (`ios/App/App/PhoneWorkoutPlugin.swift`) keeps every reading with its
  own time (builder statistics, an anchored query, and a fresh `HKSampleQuery` whenever the page
  asks, for readings saved while the phone was locked). The page works out `set.hr` / `set.restHr`
  as the watch does: a set from the end of the rest before it (or the tick before it, when that rest
  was cut short) to its own tick, a rest from the tick until the rest timer ran out or the next set
  was ticked (`liveHrPatches`). They go through the same `patchSetIn` as the watch's `setHr`, and
  only into sets without a reading, so merge and display are unchanged. The page may sleep in
  between; the sets are worked out when it wakes.
- **Live readout:** a small "♥ 128" in the workout header while a reading is under a minute old.
- **Apple Health:** finishing saves the live workout (`finishWorkout`, sync id `opengym-w-<id>`,
  version 1, the workout's name as `OpenGymTitle`). `AppleHealthPlugin.saveSession` asks
  `PhoneWorkoutLedger` and skips its post-hoc write for it, as it does for the watch's copy (it waits
  up to 20 s for a save still in flight). Discarding drops it (`discardWorkout`).
- **AirPods out:** readings stop, the session keeps going, they resume when the buds go back in.
- **Crash or kill:** iOS keeps the session and hands it back on the next launch
  (`UIScene.ConnectionOptions.shouldHandleActiveWorkoutRecovery` in `AppDelegate`,
  `recoverActiveWorkoutSession`); the page adopts it for its workout by the sync id it was started
  with, rest windows included (kept in `localStorage`).
- **Background mode:** `processing` in `UIBackgroundModes`, as in Apple's iPhone sample ("Building
  a workout app for iPhone and iPad", WWDC25 session 322). Not watchOS's `workout-processing`, which
  Apple lists for the watch only.
- **Permissions:** nothing new. The Apple Health switch already asks to save workouts and read the
  heart rate; the usage strings say AirPods too.
- **Below iOS 26** the plugin answers `{ supported: false }` and nothing runs.

Worth checking on a real iPhone on iOS 26 with AirPods Pro 3: buds in from the start; put in
mid-workout; taken out and put back; the screen locked across rests; with the watch app in use (one
workout in Apple Health, the watch's).

### Animation quality and the animation packs (store apps)

Settings → Workout → **Animation quality**, in the store apps only (the web and a self-hosted
server show nothing new): **Auto** (360 px on a phone, 720 px on a tablet), **Still only** (no
animation, just the still), **Built in** (the files inside the app), or 240, 360, 480, 720 or
1080 px. Plus **Download over Wi-Fi only** (on by default) and, per pack on the device, its size
and **Delete**.

- **Licence first.** The animations are licensed from Gym visual. The repository, the web build
  and every self-hosted server only ever have the 180 px files. Anything larger reaches people
  only inside the official store apps: built into the package, or as an **Apple-hosted asset pack**
  (Background Assets, iOS 26) that the store delivers. Never from a server of
  ours, never at a URL anyone can fetch. No tool here opens a media file; packs are planned from
  file names alone.
- **The packs.** One per quality and figure: `anim-<px>-male`, `anim-<px>-female` for 240, 360,
  480, 720 and 1080, all on demand. A figure's pack holds every drawing that figure shows: per
  catalogue exercise its drawing for that figure, or its own when it is drawn once (those are in
  both packs). Inside a pack a drawing sits at `<packId>/<drawing id>.webp`, so the male and the
  female pack of a quality (which share every drawing made once), or two qualities, never claim
  the same path in the one tree Background Assets reads all packs as.
  `node scripts/media/make-pack-manifests.mjs <out>` writes, per pack, the ids and the manifest
  `xcrun ba-package` takes (`fileSource` `<px>/<id>.webp`, relative to a source root with one
  folder per quality), plus a summary. `--layout clip` writes `clip/<id>.webp` instead.
- **What shows** (`src/lib/anim-quality.js`, `clipSources`): the chosen quality's pack for the
  figure shown if it is installed, else the next smaller installed pack of that figure, else the
  built-in file, then the still. Never a blank, and never the other figure's drawing. Custom
  exercises keep their own media (`components/CustomMedia.jsx`) and never go through any of this.
- **Downloads.** Choosing a quality whose pack is not there starts its download for the figure
  shown, and the built-in animations show meanwhile; switching the figure (Look & Home → Exercise
  drawings) fetches the other figure's pack of that quality. Auto does the same, over Wi-Fi.
- **This device only.** The choice is kept in the WebView's localStorage (`gym_anim_v1`), never in
  the synced profile: packs are downloaded per device, and a phone and an iPad want different
  sizes. Switching quality or figure never writes the profile; `src/lib/anim-data-safety.test.js`
  holds that, and that every exercise a profile refers to keeps a picture at every quality.
- **iOS:** `AnimationPacksPlugin.swift` (`AssetPackManager`: status, download with progress,
  remove, the folder of a pack's files). Before iOS 26 it answers "unavailable" and the setting
  offers only Still only and Built in. Apple-hosted packs need the downloader extension
  `ios/App/AnimationPacksDownloader` (a `StoreDownloaderExtension`), added and embedded by
  `ios/ci/add-asset-downloader.rb` (run once and commit the project; CI runs it until then), the
  Info.plist keys `BAAppGroupID`, `BAHasManagedAssetPacks`, `BAUsesAppleHosting`, and the App
  Group `group.ch.opengym.app` on the app and the extension. `scripts/ios/finish-ipa.sh` signs the
  extension with its own profile (`EXT_PROFILE`).
App Store Connect, once: the App Group `group.ch.opengym.app`; the bundle id
`ch.opengym.app.AnimationPacksDownloader` (an app extension); the App Groups capability on
`ch.opengym.app` and on the extension, both with that group; an App Store provisioning profile
for each; then the ten packs uploaded as Apple-hosted background assets for the app.

Worth checking on a device: picking 720 px starts a download that shows its progress; the
animation sharpens once it is done; Delete frees the space and the animation falls back; on
cellular with Wi-Fi only on, it waits; Still only shows stills everywhere a workout shows media.

### Gym reminder (#614)

Settings → Reminders → **Gym reminder**, in the phone app only (the web build has no such page:
a browser cannot watch where you are with the page closed). Off by default. The gyms are plain
Settings rows (name, address, radius; "Off" on one that is switched off), the last row adds one.
Adding is search first, like a maps app (`views/GymReminder.jsx` `GymFindPage`): the app's search
field, "Current location" as the first row, results as you type (after a 350 ms pause, newest
question wins) with distance, a kind hint and the address. A pick opens the editor
(`GymEditPage`): a small map card with the pin fixed in the middle and the map moving under it,
the radius as a circle, a "show where I am" button; then Name, an on/off switch, the radius as
Small 75 m / Medium 120 m / Large 200 m (a saved gym with another radius keeps it as a fourth
choice), the notification text, Save, "Open in Apple Maps / Google Maps" and Remove.

- **iPhone search: Apple Maps.** `ios/App/App/GymMapPickerPlugin.swift` answers `complete`
  (two MKLocalSearchCompleters, one filtered to fitness centres, those first), `resolve` (one
  MKLocalSearch for the row picked) and `reverse` (CLGeocoder, the address of a spot). It keeps
  nothing and needs no API key. A build without these calls (1.4.4 build 45 had a full-screen
  picker instead) answers `UNIMPLEMENTED`, and `lib/gym-places.js` uses OpenStreetMap from then on.
- **iPhone fallback: OpenStreetMap data.** The type-ahead asks Photon
  (`photon.komoot.io`, built for search-as-you-type; fair use): at least two letters, at most one
  request every 500 ms, answers cached for the session, repeats in flight not sent again, a
  User-Agent naming the app, biased to where you are, gyms ranked first, `lang` only where Photon
  has it (en, de, fr). If Photon fails, Nominatim answers within its policy (one request a second,
  cached). The address of a moved pin is Photon's reverse lookup, once per spot.
- **The map:** Leaflet (`components/GymMap.jsx`) with standard OSM tiles and
  attribution (tile usage policy), darkened by a CSS filter in dark mode (no second provider:
  CARTO's dark basemaps need an API key now). "Open in Google Maps" / "Open in Apple Maps" open
  plain links, no key, no SDK.

Each gym has a radius (100 m by default, 50 to 500), an optional text and an `off` flag (kept on
the list, not watched: the native side skips it when they arm the regions). Up to 20 gyms (iOS watches at
most 20 regions per app). Walking into one posts "Gym spotted. Ready for your workout? 💪"; a tap
opens the Start screen (or the running workout).

- **Equipment here (#808).** With equipment profiles set up, the editor has an "Equipment here"
  row: a profile (each one is a gym with its own plates, dumbbells, bars and machine stacks,
  `lib/gym-inventory.js`) or "Don't switch". Kept on the place as `equip` (native storage only,
  like the rest). A tap on the arrival notification, a check-in sticker, or a workout started
  while the phone is inside that place's radius makes it the active gym, with a toast "Using Home
  gym equipment" (`lib/gym-auto.js`). Only when location is already allowed: nothing here asks for
  it. A session with a set done already is not switched from here; the workout header's gym chip
  does that, after a question.

- **No nagging** (`src/lib/gym-reminder.js` `skipReason`, the same rule in
  `ios/App/GymReminderCore`): at most once a day, not after a workout
  logged today, not on a day note that excuses today, not while a session started in the last
  12 hours runs, and only inside the optional time window (an overnight one wraps). The phone
  decides when the gym is entered, from what the page last told it (`GymReminder.status`, sent
  after every save of the profile and on every return to the app).
- **Trained on another device?** A workout logged on the web or another phone that this phone has
  not synced yet: before posting, a paired phone asks its server (`GET /api/nudge-check`, the same
  few bytes the missed-day check uses) whether today is done, bounded to **3 seconds** (an ephemeral `URLSession` with 3 s timeouts plus a hard stop). "Done" keeps it quiet and is
  remembered for the rest of the day. No server (local only), offline, an error or no answer in
  time: the phone's own status decides, as before. The page hands over the server and its headers
  with `GymReminder.server` (`lib/gym-reminder.js` `pushGymServer`); iOS keeps them in the Keychain (this device only).
- **Locations stay on the phone.** The gyms live only in the native side's own storage: iOS `Application Support/gym-reminder.json`, excluded from backups. The
  WebView's storage keeps only an on/off flag (it is part of phone backups), the synced profile
  and backup files never see any of it.
- **iOS:** region monitoring (`CLLocationManager`, `GymReminderPlugin.swift`). Needs **Always**
  location and Precise Location; no background location mode is declared (region monitoring does
  not need one). iOS relaunches the app in the background on arrival; `AppDelegate` makes
  `GymReminderCenter` the location delegate at launch so the event lands. On an iPhone with an
  Apple Watch the notification shows on the watch as usual.

### Routine links: "Share with a friend" (v1.4.4)

A routine (Plan → a routine → **Share with a friend**) or a past workout (History → the workout →
Workout options → **Share with a friend**, sent as the routine Save as routine would make) goes out
as `https://opengym.ch/r#<payload>` through the share sheet (`components/RoutineShare.jsx`,
`src/lib/routine-link.js`). The payload is `1.d.<base64url>`: link format 1, a plan file holding
that one routine (same `opengym_plan` version, read by the same `parsePlan`/`mergePlan` as an
imported file), deflate-raw through `CompressionStream` (`j` = plain JSON where there is none).
It sits in the URL **fragment**, which browsers never send, so opengym.ch only serves the page. The
sender's weights ride along only with **Include my weights**, their name only with **Your name**
(both off by default). Over 2000 characters the share falls back to a plan file of that routine.

Opening one shows a preview with **Add to my routines**: always a new routine, never over one
already there ("Push Day (from Alex)", "Push Day 2" when the name is taken), custom exercises
created like a plan file's. A newer link format than the app reads asks for an update.

| Where | Link | |
| --- | --- | --- |
| Website | `https://opengym.ch/r#P` | `website/r/index.html` (served at /r/): the routine by name and sets, Open in openGym, Get the app, Open in the web app (your server or the demo) |
| App | `opengym://r#P` | the website's Open in openGym; the `opengym` scheme is already registered (CFBundleURLTypes, the VIEW filter for `opengym:`). Read through `@capacitor/app`'s `appUrlOpen` and `getLaunchUrl` (`useRoutineLinks`, waits until the app is set up) |
| Web app | `<server>/#/r/P` | read before the router sends the unknown route to /home, then the address goes back to `#/plan` |

iPhone: without associated domains the https link opens the page in Safari, one more tap to the
app. Adding `applinks:opengym.ch` (see the NFC notes below) would cover `/r*` too.

### NFC stickers (v1.4.4)

Settings → Look & Home → **Set up an NFC sticker** writes a blank NTAG sticker (NTAG213 or bigger;
the link is under 110 bytes) with one NDEF URI record. Two kinds, chosen in the sheet
(`components/Nfc.jsx`); what a sticker says and does is `src/lib/nfc-tags.js`:

| Sticker | Link | A tap |
| --- | --- | --- |
| Start | `https://opengym.ch/nfc?do=start` | starts today's planned session through the usual Start (weigh-in first, if on); a running workout opens instead, never a second one; nothing planned: the Start screen |
| Check in | `https://opengym.ch/nfc?do=checkin&card=<id>` | the membership code screen (`#/checkin`) on that card; offered only when a code is saved |
| Machine | `https://opengym.ch/nfc?ex=<exercise id>` | during a workout: jumps to the exercise (`active.cur`), or asks before adding it after the current one; outside: the exercise's details. An exercise the profile lacks: a short toast |

The same tap within 4 s, or any tap within 1.2 s of the last, is dropped (`tagDebouncer`). A link
that opens the app before it is set up (cold start, sign-in) waits until it is (`useNfcTagLinks`).
`opengym://nfc?...`, `opengym://checkin`, `opengym://start` and `opengym://exercise/<id>` are read
too. Machine stickers come from an exercise's details → **Write NFC sticker for this exercise**.

- **Why an https link:** that is what a phone reads with the app closed. iOS background tag reading (iPhone XS and newer) only routes
  web links and universal links, never custom schemes. The app has **no associated domains yet**,
  so on an iPhone the tap shows a banner that opens `opengym.ch/nfc` in Safari, and that page
  (`website/nfc/index.html`, served at /nfc) hands the query to the app as `opengym://nfc?...` (CFBundleURLTypes in
  Info.plist, delivered through `@capacitor/app`'s `appUrlOpen`). A phone without openGym lands on
  the same page. To make it one tap on iPhone later: enable Associated Domains on the app id, add
  `applinks:opengym.ch` to `App.entitlements`, and serve `/.well-known/apple-app-site-association`
  for `/nfc*` on opengym.ch.
- **Writing, iOS:** `NfcTagsPlugin.swift`, an `NFCNDEFReaderSession` with Core NFC's own sheet
  (`queryNDEFStatus`, `writeNDEF`). Needs the **NFC Tag Reading** capability on the app id
  (`com.apple.developer.nfc.readersession.formats` = `TAG`; App Store Connect refuses `NDEF`
  there, `scripts/ios/finish-ipa.sh` drops it from the profile's entitlements) and
  `NFCReaderUsageDescription` in Info.plist. There is no permission prompt: the system sheet is
  the consent, so the app shows no explainer before it.
- **Web:** Web NFC (`NDEFReader`), which only Chrome on Android has. It writes, and reads while
  the page is open once the site has the NFC permission (asked at the first write). Every other
  browser, and phones without NFC, never see the NFC rows (`nfcSupport()`).
- **Not a card cloner.** No host card emulation, no reading of other tags' contents beyond our own
  link, nothing that copies or imitates a gym's access card. The membership code stays the QR or
  barcode the check-in screen draws.

### Siri and Shortcuts (v1.4.4)

Nothing to switch on: the phrases and shortcuts are there once the app is installed. Settings →
Look & Home → **Siri & Shortcuts** lists them
(`components/VoiceShortcuts.jsx`). The app side is `src/lib/voice.js`.

**iPhone, iOS 16 and up** (`ios/App/App/VoiceIntents.swift`, App Intents; the deployment target
stays 15.5 and everything is `@available(iOS 16.0, *)`). One `AppShortcutsProvider`, so the four
show up in Siri, Spotlight and the Shortcuts app with no setup:

| Phrase | Intent | What happens |
| --- | --- | --- |
| "Start my workout in openGym" | `StartWorkoutIntent` (opens the app) | hands `opengym://start?today=1` to Capacitor like any link: today's plan through the widget's Start path (`lib/widget-links.js`, weigh-in step included), the running workout if there is one, Home on a rest day |
| "Log my weight in openGym" | `LogWeightIntent` (stays closed) | asks for the number, in the profile's unit from the widget snapshot, 20 to 700 kg or 44 to 1500 lb; writes `{ id, w, unit, at, d }` to `voice.pendingWeighIns` in the App Group's defaults and says "Logged 78.2 kg" |
| "What's my workout today in openGym" | `TodayWorkoutIntent` (stays closed) | answers from `widget.json` (the widget snapshot, `lib/widgets.js`): the running workout, today's plan, done, or the rest day and what's next |
| "How's my streak in openGym" | `StreakIntent` (stays closed) | the week streak and whether this week counts yet, from the same snapshot |

Before the app has written a snapshot (never opened) the closed ones say "Open openGym once, then
ask me again" and log nothing: without the profile's unit a number means nothing.

The page brings pending weigh-ins in when it starts and whenever it comes back to the foreground,
once the store is ready (`startVoice`, through the `VoiceBridge` plugin: `pending()`, `clear({ ids })`).
`importPendingWeighIns` converts to the profile's unit, keeps the day the phone was on when Siri
logged it (`d`, so 23:30 stays that evening wherever the phone is now; a day not yet reached here
becomes today), lets a newer weigh-in of that day win, drops anything that is not a body weight,
and remembers the ids it brought in (`og_voice_seen`) so one the phone failed to clear never comes
twice. It goes through the store's `update` like the weigh-in sheet, so it syncs and reaches
Health like any other weigh-in. A toast says "78.2 kg logged by Siri".

Words: `ios/App/App/<lang>.lproj/AppShortcuts.strings` (the phrases, each keeping
`${applicationName}`) and `Localizable.strings` (titles and answers), in every language the
widgets have plus Swedish, written by `node frontend/ios/ci/voice-strings.mjs`. They are real
localized resources of the App target (variant groups in `project.pbxproj`, `knownRegions`). The
same phrases appear in Settings from `src/locales`; `src/lib/voice-strings.test.js` keeps the
Swift source, the generated files and the page's packs in step.

## Prerequisites

- Node 22 (the Capacitor 8 CLI needs it)
- **iOS:** a Mac with Xcode 26 and CocoaPods (`brew install cocoapods`). A free Apple ID
  is enough to run the app on your own iPhone (see below); paid membership is only needed
  for App Store and TestFlight distribution ([APP_STORES.md](APP_STORES.md)).

## Build & run

```sh
cd frontend
npm install
npm run build:mobile        # VITE_MOBILE build + `cap sync` into ios/

npx cap open ios            # opens Xcode (Mac only) → set your signing team, then run
```

`npm run build:mobile` builds the app, puts the 180 px exercise media from `catalogue/media` next
to it (`scripts/catalogue/stage-media.mjs`) and copies the result into the iOS project. Re-run
it after every web-code change before building natively.

> **Heads-up:** after `build:mobile`, `frontend/dist` contains the *mobile* bundle.
> Run a plain `npm run build` again before deploying `dist` to a server.

## App icons & splash screens

`frontend/resources/icon.svg` is the 1024×1024 source (the app's dumbbell glyph on the
app background). Generate all platform assets from it on a machine with the tooling:

```sh
cd frontend
npx @capacitor/assets@3.0.5 generate --iconBackgroundColor '#0c0e12' --splashBackgroundColor '#0c0e12'
```

The generator is not a dependency of the app (it pulls in an old Capacitor CLI and sharp),
so `npx` fetches it for that one run.

(If the generator won't take the SVG directly, export it to `resources/icon.png` at
1024×1024 first; any image tool can do it.)

The alternate icons people can pick in Settings → Look & Home → App icon are not made by that
generator. `node scripts/app-icons.mjs` draws them from the list in
`src/lib/app-icon-variants.js` and the glyph in `resources/icon.svg`, with no dependencies: the
SVG per icon in `resources/icons/`, an `AppIcon-<Name>` set (1024 px, opaque) per icon in the iOS
asset catalog, and the previews in
`public/app-icons/`. An icon with `art` (Halloween) is a hand-made SVG in `resources/icons/`
instead, which the script renders; it may use only rect, circle, line, polyline, polygon and one
two-stop radialGradient. `--check` says whether the committed files still match. A new icon also
needs its name in `AppIconPlugin.swift`, and its set in `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`;
`scripts/app-icons.test.mjs` fails until all of them agree.

## Distributing your own build

See [APP_STORES.md](APP_STORES.md) for upstream store release guidance.

### iPhone: build it yourself

The [App Store app](https://apps.apple.com/app/id6822275400) is the easy way. If you want your own build, for example of a fork:

- **Xcode free signing:** open `ios/` in Xcode with a free Apple ID as the team and run it
  onto your own iPhone. Apple expires the signature after 7 days; re-run from Xcode to renew.
- **AltStore / Sideloadly:** automate that 7-day re-signing.
- **Self-host + PWA:** open your instance in Safari → Share → *Add to Home Screen*. Full-screen
  app, no expiry, plus sync and passkeys.

Every pull request that touches the iOS shell is compiled on a Mac by the `iOS` GitHub workflow
(`.github/workflows/ios.yml`), which also starts it in the simulator. Its unsigned IPA has no
web assets; `scripts/ios/finish-ipa.sh` adds them and signs it on the release machine.

### Release notes for maintainers

- Keep `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in the iOS project in step with
  `frontend/package.json`.
- Don't push a version tag you don't mean to release: the published release is what builds the
  images (`docker-publish.yml`).
- **License:** openGym is AGPL-3.0, which by itself sits badly with app-store terms of
  service. `NOTICE.md` carries an app-store exception (an additional permission under
  AGPL §7) granted by the copyright holder, and the [CLA](../CLA.md) covers contributions.
- The app requests notification permission when the workout-day reminder is switched on,
  and again at the first rest if it is still unanswered. The opt-in missed-workout nudge is
  scheduled the same way, beside the reminder: one notification on the evening (20:00–21:30) of
  each upcoming planned day, at most 3 past the last workout, rescheduled whenever a workout is
  logged. A workout logged on another device (the web, a second phone) reaches these only when
  the app syncs, so a paired phone also runs a **background check** before them
  (`lib/nudge-check.js`, the native `NudgeCheck` plugin): it asks the server
  `GET /api/nudge-check?date=…` (a few bytes: was the day trained or excused, would the server
  still nudge it) and takes back that day's reminder and nudge when the answer says so. Offline,
  an error or no answer leaves everything as it was, and the app resyncs in full whenever it is
  opened. On iOS it is a `BGAppRefreshTask` asked for an hour before, and
  **iOS decides when it actually runs**: it learns from how often the app is opened, holds back
  in Low Power Mode, and never runs it after the app was swiped away from the app switcher or
  with Background App Refresh off, so there the check is a good chance, not a promise. The
  pairing token it needs is kept in the Keychain.
