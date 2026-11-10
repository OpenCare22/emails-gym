// Undo only the completion, preserving logged values, navigation and other sets.
export function undoFocusCompletion(active, receipt, epoch) {
  const entry = active?.entries[receipt.idx]
  const row = entry?.sets[receipt.i]
  if (!active || active.id !== receipt.session || entry?.id !== receipt.exercise ||
      entry.sets.length !== receipt.count || epoch !== receipt.epoch ||
      !row?.done || row.at !== receipt.at) return false
  row.done = false
  if (row.sides) {
    for (const side of ['L', 'R']) if (row.sides[side]) row.sides[side].done = false
  }
  return true
}
