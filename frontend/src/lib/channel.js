// The iPhone app is updated by the App Store; the browser with its server.
import { MOBILE } from './mobile.js'

let infoP = null
function channelInfo() {
  return infoP || (infoP = (async () => {
    if (!MOBILE) return { channel: 'web', gymReminder: false }
    const { Capacitor } = await import('@capacitor/core')
    const platform = Capacitor.getPlatform()
    if (platform === 'ios') return { channel: 'appstore', gymReminder: true }
    return { channel: 'web', gymReminder: false }
  })().catch(() => ({ channel: 'web', gymReminder: false })))
}

export async function getChannel() {
  return (await channelInfo()).channel
}

/** Whether this phone build can offer the gym reminder (it needs background location). */
export async function gymReminderBuilt() {
  return (await channelInfo()).gymReminder
}

// Store and web builds manage their own updates.
export async function selfUpdates() {
  return false
}

/** Whether the native barcode scanner is in this build. */
export async function nativeScanner() {
  if (!MOBILE) return false
  return (await getChannel()) === 'appstore'
}

