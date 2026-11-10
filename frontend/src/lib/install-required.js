// iPadOS can request desktop sites and identify itself as a Mac with a touch screen.
export function requiresHomeScreen({ user, mobile = false, nav = globalThis.navigator, win = globalThis.window } = {}) {
  if (!user || mobile) return false
  const ios = /iPhone|iPad|iPod/.test(nav?.userAgent || '')
    || (/Mac/.test(nav?.platform || nav?.userAgent || '') && nav?.maxTouchPoints > 1)
  return ios && nav?.standalone !== true && !win?.matchMedia?.('(display-mode: standalone)').matches
}
