// Google Health (Fitbit) in the app (PLAN.md Phase 4; the server side is api/health/). The server
// holds the connection and the data; the app reads it from /api/google-health, keeps a copy in
// localStorage so Home shows numbers at once, asks for a sync when the last one is over 30
// minutes old, and copies Fitbit weigh-ins into the weight chart (a day you weighed in by hand
// keeps yours). Pure helpers first, each with a test; the small store below them does the I/O.
import { create } from 'zustand'
import { api } from './api.js'
import { addWeighIn } from './weigh-ins.js'

export const SRC = 'google'
export const STALE_MS = 30 * 60 * 1000
const CACHE = 'gym_ghealth_v1'

/** Steps on a day ('YYYY-MM-DD'), or null. */
export const stepsOn = (data, d) => (data?.steps && Number.isFinite(data.steps[d]) ? data.steps[d] : null)

/** The newest resting heart rate: { bpm, d }, or null. */
export function latestRestingHr(data) {
  const days = Object.keys(data?.restingHr || {}).sort()
  const d = days.at(-1)
  return d ? { bpm: data.restingHr[d], d } : null
}

/** Average steps over the 7 days before `today`, for a quiet comparison; null with under 3 days. */
export function weekAverageSteps(data, today) {
  const t = Date.parse(today + 'T12:00:00Z')
  const vals = []
  for (let i = 1; i <= 7; i++) { const v = stepsOn(data, new Date(t - i * 864e5).toISOString().slice(0, 10)); if (v != null) vals.push(v) }
  return vals.length >= 3 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

const localTime = iso => { const dt = new Date(iso); return Number.isNaN(dt) ? null : `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` }

/**
 * Adds the Fitbit weigh-ins S doesn't have yet (S mutated, profile unit), skipping any day with a
 * reading typed in by hand. Returns how many were added.
 */
export function applyWeighIns(S, weights, kgToUnit = kg => (S.unit === 'lb' ? kg / 0.45359237 : kg)) {
  if (!Array.isArray(weights) || !weights.length) return 0
  const days = Array.isArray(S.bodyweight) ? S.bodyweight : []
  const seen = new Set(), manual = new Set()
  for (const day of days) {
    for (const r of day?.ins || []) { if (r.sid) seen.add(r.sid); if (!r.src) manual.add(day.d) }
    if (!day?.ins && day?.d && !day.src) manual.add(day.d)
  }
  let added = 0
  for (const w of weights) {
    if (!w?.id || seen.has(w.id) || manual.has(w.d)) continue
    if (addWeighIn(S, { d: w.d, at: localTime(w.at), w: kgToUnit(w.kg), t: Date.parse(w.at) || Date.now(), src: SRC, sid: w.id })) { added++; seen.add(w.id) }
  }
  return added
}

function cached() {
  try { return JSON.parse(localStorage.getItem(CACHE)) || null } catch { return null }
}

export const useGoogleHealth = create((set, get) => ({
  info: cached(), // the last /api/google-health answer
  busy: false,
  error: null,
  async load({ sync = 'auto' } = {}, onWeights) {
    if (get().busy) return get().info
    set({ busy: true, error: null })
    try {
      let info = await api('/api/google-health')
      const stale = info.connected && info.status !== 'reconnect' && (!info.lastSync || Date.now() - Date.parse(info.lastSync) > STALE_MS)
      if (info.connected && (sync === 'now' || (sync === 'auto' && stale))) {
        try { info = await api('/api/google-health/sync', { method: 'POST', timeout: 60000 }) }
        catch (e) { info = await api('/api/google-health').catch(() => info); set({ error: e?.message || String(e) }) }
      }
      try { localStorage.setItem(CACHE, JSON.stringify(info)) } catch { /* private mode */ }
      set({ info })
      if (info?.data?.weight?.length && onWeights) onWeights(info.data.weight)
      return info
    } catch (e) {
      set({ error: e?.message || String(e) })
      return get().info
    } finally { set({ busy: false }) }
  },
  async disconnect() {
    await api('/api/google-health/disconnect', { method: 'POST' })
    try { localStorage.removeItem(CACHE) } catch { /* fine */ }
    set({ info: { available: true, connected: false } })
  },
  clear() { try { localStorage.removeItem(CACHE) } catch { /* fine */ } set({ info: null }) },
}))
