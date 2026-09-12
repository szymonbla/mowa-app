import { readFileSync } from 'node:fs'

/**
 * `exact` = twarda asercja, zero tolerancji (granica slownika, no-op). `f05` = ocena
 * edycyjna wzgledem referencji. Domyslnie `f05` — pole pomijalne dla wiekszosci probek.
 */
export type Mode = 'exact' | 'f05'

export interface Sample {
  id: string
  /** Wejscie po lokalnym wycieciu wypelniaczy — tak samo porownuje straz. */
  input: string
  reference: string
  mode?: Mode
  /** Wylacznie do przegladu czlowieka — harness tego pola nie czyta. */
  note?: string
}

export function loadSamples(path: string): Sample[] {
  const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'))
  if (!Array.isArray(raw)) throw new Error(`${path}: oczekiwana lista probek`)
  return raw.map((entry, i) => parseSample(entry, i, path))
}

function parseSample(entry: unknown, i: number, path: string): Sample {
  const e = entry as Partial<Sample>
  if (typeof e.id !== 'string' || typeof e.input !== 'string' || typeof e.reference !== 'string') {
    throw new Error(`${path}[${i}]: brakuje id/input/reference`)
  }
  if (e.mode !== undefined && e.mode !== 'exact' && e.mode !== 'f05') {
    throw new Error(`${path}[${i}]: mode musi byc 'exact' albo 'f05'`)
  }
  return {
    id: e.id,
    input: e.input,
    reference: e.reference,
    mode: e.mode ?? 'f05',
    ...(e.note ? { note: e.note } : {})
  }
}
