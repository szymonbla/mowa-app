import type { Replacement } from './types.js'

const WORD = /[\p{L}\p{N}_]/u

/**
 * Stosuje pierwsza pasujaca zamiane do fragmentu oryginalnego tekstu. Tekst
 * wyprodukowany przez regule nie wraca do skanera, wiec `A → B`, `B → C`
 * pozostawia B. To sprawia, ze wynik nie zalezy od przypadkowego lancucha regul.
 */
export function applyReplacements(text: string, rules: readonly Replacement[]): string {
  const usable = rules.filter((rule) => rule.from.trim())
  let cursor = 0
  let result = ''

  while (cursor < text.length) {
    let candidate: { at: number; rule: Replacement } | null = null

    for (const rule of usable) {
      const match = nextWholeWord(text, rule.from, cursor)
      if (match !== null && (candidate === null || match < candidate.at)) {
        candidate = { at: match, rule }
      }
    }

    if (!candidate) return result + text.slice(cursor)
    result += text.slice(cursor, candidate.at) + candidate.rule.to
    cursor = candidate.at + candidate.rule.from.length
  }

  return result
}

/**
 * Pierwsze wystapienie `phrase` w `text` od pozycji `from`, ograniczone do
 * calego slowa. Eksportowane, bo skaner kandydatow w `scripts/corpus.ts` musi
 * pytac o dokladnie te same dopasowania, ktore wykona zamiana.
 */
export function nextWholeWord(text: string, phrase: string, from: number): number | null {
  const matcher = new RegExp(escapeRegExp(phrase), 'giu')
  matcher.lastIndex = from
  for (let match = matcher.exec(text); match; match = matcher.exec(text)) {
    const at = match.index
    const before = at === 0 ? '' : text[at - 1]
    const after = text[at + phrase.length] ?? ''
    if ((!before || !WORD.test(before)) && (!after || !WORD.test(after))) return at
  }
  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
