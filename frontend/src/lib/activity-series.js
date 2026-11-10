// Calendar days use UTC arithmetic, keeping buckets stable across daylight-saving changes.
const DAY = 864e5
const stamp = d => Date.parse(d + 'T00:00:00Z')
const iso = ms => new Date(ms).toISOString().slice(0, 10)
export const average = values => {
  const valid = values.filter(v => Number.isFinite(v) && v >= 0)
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

/** Inclusive trailing range; weekly buckets start Monday and average only recorded days. */
export function activitySeries(data = {}, { today, days = 7, weekly = days > 7 } = {}) {
  const end = stamp(today), start = end - (days - 1) * DAY
  const buckets = new Map(), readings = []
  for (let at = start; at <= end; at += DAY) {
    const d = iso(at), value = data[d]
    const valid = Number.isFinite(value) && value >= 0
    const monday = at - ((new Date(at).getUTCDay() + 6) % 7) * DAY
    const key = weekly ? iso(Math.max(start, monday)) : d
    if (!buckets.has(key)) buckets.set(key, { d: key, end: d, values: [] })
    const bucket = buckets.get(key)
    bucket.end = d
    if (valid) { bucket.values.push(value); readings.push({ d, t: stamp(d), y: value }) }
  }
  return {
    points: [...buckets.values()].map(b => ({ d: b.d, end: b.end, t: stamp(b.d), y: average(b.values), count: b.values.length })),
    readings, average: average(readings.map(p => p.y)),
  }
}

/** Compare the first and last available readings within the selected range. */
export function restingHrChange(readings) {
  return readings.length < 2 ? null : readings.at(-1).y - readings[0].y
}
