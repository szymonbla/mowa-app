import { diffArrays } from 'diff'

/**
 * Jedna edycja wzgledem `before`, na pozycji `start` w jego tokenach.
 * Puste `removed` = wstawienie, puste `added` = usuniecie.
 */
export interface Edit {
  start: number
  removed: string[]
  added: string[]
}

/**
 * Edycje `before` -> `after`, rozbite token po tokenie (ticket 13: naiwny `diffArrays`
 * sklejaby sasiadujace zmiany w jeden blok, i poprawka czesciowa dostalaby F0.5 = 0).
 */
export function edits(before: readonly string[], after: readonly string[]): Edit[] {
  const changes = diffArrays(before as string[], after as string[])
  const result: Edit[] = []
  let pos = 0
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i]
    if (!change.removed && !change.added) {
      pos += change.value.length
      continue
    }
    if (!change.removed) {
      // Wstawienie bez poprzedzajacego usuniecia — kazdy token osobno, ta sama pozycja.
      for (const token of change.value) result.push({ start: pos, removed: [], added: [token] })
      continue
    }
    const removed = change.value
    const next = changes[i + 1]
    const added = next?.added ? next.value : []
    if (added.length > 0) i++
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      result.push({
        start: pos + j,
        removed: removed[j] === undefined ? [] : [removed[j]],
        added: added[j] === undefined ? [] : [added[j]]
      })
    }
    pos += removed.length
  }
  return result
}

/** Dopasowanie edycji "na twardo" — parafraza jest zakazana, wiec zgadza sie albo nie. */
function key(edit: Edit): string {
  return `${edit.start}:${edit.removed.join(' ')}:${edit.added.join(' ')}`
}

function counts(edits: readonly Edit[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const edit of edits) {
    const k = key(edit)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

/**
 * F0.5 na zbiorach edycji, nie na tekstach — standard GEC (M2/ERRANT). Waga 0.5
 * karze falszywa poprawke mocniej niz przeoczona, bo to ona boli bardziej.
 */
export function f05(reference: readonly Edit[], hypothesis: readonly Edit[]): number {
  if (reference.length === 0 && hypothesis.length === 0) return 1

  // Liczniki, nie zbiory — dwa identyczne wstawienia w tym samym miejscu to dwa
  // osobne trafienia, nie jedno. Zbior dawal ujemne fn przy zduplikowanej edycji.
  const refCounts = counts(reference)
  let tp = 0
  for (const edit of hypothesis) {
    const k = key(edit)
    const remaining = refCounts.get(k) ?? 0
    if (remaining > 0) {
      tp++
      refCounts.set(k, remaining - 1)
    }
  }
  const fp = hypothesis.length - tp
  const fn = reference.length - tp
  if (tp === 0) return 0

  const precision = tp / (tp + fp)
  const recall = tp / (tp + fn)
  const beta2 = 0.25
  return ((1 + beta2) * precision * recall) / (beta2 * precision + recall)
}
