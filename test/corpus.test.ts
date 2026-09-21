import { describe as suite, expect, it } from 'vitest'
import { applyReplacements } from '../src/shared/replacements.js'
import { CANDIDATES } from '../scripts/corpus.js'
import { correctionCorpus } from './fixtures/ambiguous-terms.js'

/** Lista aliasow zamieniona na reguly, ktore uzytkownik mialby w ustawieniach. */
const RULES = CANDIDATES.map((candidate) => ({ from: candidate.alias, to: candidate.target }))

/** Alias, z ktorego powstala ta propozycja. Najdluzszy wygrywa, bo aliasy moga sie zaczynac tak samo. */
function aliasOf(original: string): string {
  const matches = CANDIDATES.filter((candidate) =>
    original.toLowerCase().startsWith(candidate.alias.toLowerCase())
  ).map((candidate) => candidate.alias)
  return matches.sort((a, b) => b.length - a.length)[0] ?? ''
}

/**
 * Czy dzisiejsza zamiana calego slowa dotknie tej wlasnie formy. Pytanie idzie
 * o sama forme, nie o zdanie: w jednym zdaniu potrafi stac i trafiony `Potato`,
 * i nietkniete `bardzo`, wiec porownanie calych zdan odpowiedzialoby o cudzym
 * dopasowaniu. Granice napisu daja tu te sama odpowiedz co granice slowa.
 */
function shippedRuleFires(row: (typeof correctionCorpus)[number]): boolean {
  const { original } = row.proposal
  return applyReplacements(original, RULES) !== original
}

suite('korpus J2a', () => {
  it('kazdy wiersz pochodzi z aliasu ze skanera', () => {
    for (const row of correctionCorpus) expect(aliasOf(row.proposal.original)).not.toBe('')
  })

  it('zamiana calego slowa nie psuje ani jednego zdania w korpusie', () => {
    const wrong = correctionCorpus.filter((row) => shippedRuleFires(row) && !row.shouldApply)
    expect(wrong).toEqual([])
  })

  it('zamiana calego slowa nie widzi wiekszosci prawdziwych wystapien', () => {
    const wanted = correctionCorpus.filter((row) => row.shouldApply)
    const reached = wanted.filter(shippedRuleFires)
    expect(reached.length).toBeLessThan(wanted.length / 2)
  })

  it('przyjecie kazdej propozycji po rdzeniu psulo by 8 zdan', () => {
    const wrong = correctionCorpus.filter((row) => !row.shouldApply)
    expect(wrong).toHaveLength(8)
    expect(
      wrong.filter((row) => row.proposal.original.toLowerCase().startsWith('bard'))
    ).toHaveLength(7)
  })
})
