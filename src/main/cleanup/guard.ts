import { literals, tokens } from './text.js'
import { stem } from './stem.js'

/**
 * Straz nad wynikiem. Broni **przed nadgorliwoscia modelu**, nie przed bledami STT:
 * wyjscie rowne wejsciu jest zawsze poprawne, wyjscie napisane od nowa — nigdy.
 * Wszystkie warstwy sa lokalne i licza sie w mikrosekundach.
 */
export type GuardLayer = 'empty' | 'truncation' | 'bloat' | 'literal' | 'coverage' | 'order'

export type Verdict = { ok: true; text: string } | { ok: false; layer: GuardLayer }

/**
 * Progi startowe, nie ostateczne. Maja wyjsc z zestawu oceny, a nie z przeczucia —
 * do tego czasu sa tu, w jednym miejscu, zeby dalo sie je nastroic bez szukania.
 *
 * Stosunek dlugosci mierzymy w tokenach i wobec wejscia **juz oczyszczonego
 * z wypelniaczy**. Dzieki temu 20–30 % skrocenia znika z rownania i pasmo zaciska
 * sie z luznego ~0,6 do 0,85–1,15.
 */
export const MIN_RATIO = 0.85
export const MAX_RATIO = 1.15
/** Luz dla krotkich tekstow: przy 3 tokenach kazdy stosunek jest zgrubny. */
export const RATIO_SLACK = 1
export const MIN_COVERAGE = 0.85
export const MIN_ORDER = 0.9

/** Model lubi zaczac od zapowiedzi. To sie obcina, a nie odrzuca. */
const PREAMBLE =
  /^\s*(?:oto|poprawiona wersja|poprawiony tekst|here(?:'s| is))\b[^\n:]{0,60}:\s*/i
const FENCE_OPEN = /^\s*```[\p{L}]*\s*\n?/u
const FENCE_CLOSE = /\n?\s*```\s*$/

export function guard(input: string, raw: string): Verdict {
  const text = keepShape(input, strip(raw))
  if (!text.trim()) return { ok: false, layer: 'empty' }

  const before = tokens(input)
  const after = tokens(text)

  // Rozdecie lapie dwa tryby porazki naraz: "ok" rozwiniete w pelne zdanie
  // oraz odpowiedz **na** tresc zamiast korekty.
  if (after.length > before.length * MAX_RATIO + RATIO_SLACK) return { ok: false, layer: 'bloat' }
  if (after.length < before.length * MIN_RATIO - RATIO_SLACK) {
    return { ok: false, layer: 'truncation' }
  }

  for (const literal of literals(input)) {
    if (!text.includes(literal)) return { ok: false, layer: 'literal' }
  }

  if (coverage(before, after) < MIN_COVERAGE) return { ok: false, layer: 'coverage' }
  // Parafraza zachowuje sens i czesc slow, ale lamie kolejnosc. Embeddingi tego nie
  // widza, bo mierza sens, a przepisanie sens zachowuje. LCS widzi.
  if (order(before, after) < MIN_ORDER) return { ok: false, layer: 'order' }

  return { ok: true, text }
}

function strip(raw: string): string {
  return raw.replace(FENCE_OPEN, '').replace(FENCE_CLOSE, '').replace(PREAMBLE, '').trim()
}

/**
 * `grok-4.20` potrafi dolozyc podzial na akapity, o co prompt nie prosil. To zmiana
 * ksztaltu, nie slow, wiec straz jej nie odrzuca — po prostu ja cofa.
 */
function keepShape(input: string, output: string): string {
  if (/\n/.test(input)) return output
  return output.replace(/\s*\n+\s*/g, ' ')
}

/** Udzial rdzeni wejscia obecnych w wyjsciu. */
function coverage(before: readonly string[], after: readonly string[]): number {
  if (before.length === 0) return 1
  const pool = new Set(after.map(stem))
  const kept = before.filter((token) => pool.has(stem(token))).length
  return kept / before.length
}

/** Najdluzszy wspolny podciag rdzeni, dzielony przez dlugosc wyjscia. */
function order(before: readonly string[], after: readonly string[]): number {
  if (after.length === 0) return 0
  const a = before.map(stem)
  const b = after.map(stem)
  // Jeden wiersz DP — wejscie ma najwyzej 150 slow, wiec i tak jest to darmowe.
  let prev = new Array<number>(b.length + 1).fill(0)
  for (const left of a) {
    const row = new Array<number>(b.length + 1).fill(0)
    for (let j = 0; j < b.length; j++) {
      row[j + 1] = left === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j])
    }
    prev = row
  }
  return prev[b.length] / after.length
}
