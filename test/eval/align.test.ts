import { describe as suite, expect, it } from 'vitest'
import { edits, f05 } from './align.js'
import type { Edit } from './align.js'

const words = (text: string): string[] => text.split(/\s+/)

suite('edits rozbija zmiany token po tokenie', () => {
  it('nie widzi zadnej edycji w identycznym tekscie', () => {
    expect(edits(words('a b c'), words('a b c'))).toEqual([])
  })

  it('lapie pojedyncze podstawienie', () => {
    expect(edits(words('a b c'), words('a x c'))).toEqual([
      { start: 1, removed: ['b'], added: ['x'] }
    ])
  })

  it('lapie wstawienie', () => {
    expect(edits(words('a c'), words('a b c'))).toEqual([{ start: 1, removed: [], added: ['b'] }])
  })

  it('lapie usuniecie', () => {
    expect(edits(words('a b c'), words('a c'))).toEqual([{ start: 1, removed: ['b'], added: [] }])
  })

  it('rozbija sklejony blok na osobne edycje zamiast jednej', () => {
    // Bez rozbicia "all-split" (ticket 13) dwa sasiadujace podstawienia sklejalyby sie
    // w jeden blok — poprawka tylko jednego z nich dostalaby F0.5 = 0.
    const e = edits(words('a b c d'), words('a x y d'))
    expect(e).toEqual([
      { start: 1, removed: ['b'], added: ['x'] },
      { start: 2, removed: ['c'], added: ['y'] }
    ])
  })
})

suite('f05 wazy precyzje wyzej niz recall', () => {
  it('daje 1 dla dwoch pustych zbiorow edycji (poprawny no-op)', () => {
    expect(f05([], [])).toBe(1)
  })

  it('daje 0, gdy model poprawia cos, czego nie trzeba bylo ruszac', () => {
    const ref = edits(words('a b c'), words('a b c'))
    const hyp = edits(words('a b c'), words('a x c'))
    expect(f05(ref, hyp)).toBe(0)
  })

  it('daje 1 dla dokladnego trafienia', () => {
    const ref = edits(words('a b c'), words('a x c'))
    const hyp = edits(words('a b c'), words('a x c'))
    expect(f05(ref, hyp)).toBe(1)
  })

  it('liczy duplikaty edycji osobno, nie jako jedno trafienie', () => {
    // Dwa identyczne wstawienia w tym samym miejscu (model dublujacy token) to dwa
    // osobne dopasowania wzgledem referencji z jedna taka edycja — recall < 1, nie > 1.
    const ref: Edit[] = [{ start: 1, removed: [], added: ['x'] }]
    const hyp: Edit[] = [
      { start: 1, removed: [], added: ['x'] },
      { start: 1, removed: [], added: ['x'] }
    ]
    expect(f05(ref, hyp)).toBeLessThan(1)
    expect(f05(ref, hyp)).toBeGreaterThan(0)
  })

  it('karze falszywa poprawke mocniej niz przeoczona (precyzja > recall)', () => {
    const before = words('a b c d')
    // Referencja poprawia dwa slowa; model trafia jedno i dokleja falszywe trzecie.
    const ref = edits(before, words('x y c d'))
    const hypMissed = edits(before, words('x b c d')) // recall ucierpial, precyzja pelna
    const hypExtra = edits(before, words('x y z d')) // precyzja ucierpiala, recall pelny
    expect(f05(ref, hypMissed)).toBeGreaterThan(f05(ref, hypExtra))
  })
})
