import { describe as suite, expect, it } from 'vitest'
import {
  BUDGET_CEILING_MS,
  BUDGET_FLOOR_MS,
  budgetMs,
  literals,
  MAX_WORDS,
  maxOutputTokens,
  stripFillers,
  wordCount
} from '../src/main/cleanup/text.js'

suite('budzet korekty', () => {
  it('trzyma sie podlogi, dopoki mowienie jest krotkie', () => {
    // Podloga nie jest wyborem — TTFT jest staly (~500 ms) niezaleznie od dlugosci.
    expect(budgetMs(0)).toBe(BUDGET_FLOOR_MS)
    expect(budgetMs(5000)).toBe(BUDGET_FLOOR_MS)
    expect(budgetMs(7500)).toBe(BUDGET_FLOOR_MS)
  })

  it('rosnie proporcjonalnie w waskim pasie miedzy podloga a sufitem', () => {
    expect(budgetMs(10_000)).toBe(2000)
    expect(budgetMs(12_500)).toBe(2500)
  })

  it('nie przekracza sufitu, choćby mowa trwala minute', () => {
    expect(budgetMs(15_000)).toBe(BUDGET_CEILING_MS)
    expect(budgetMs(60_000)).toBe(BUDGET_CEILING_MS)
  })
})

suite('wypelniacze', () => {
  it('wycina dzwieki wahania razem z sierocym przecinkiem', () => {
    expect(stripFillers('no wiec yyy trzeba to zrobic')).toBe('no wiec trzeba to zrobic')
    expect(stripFillers('eee, no dobrze')).toBe('no dobrze')
  })

  it('nie rusza slow, ktore bywaja trescia', () => {
    // "no", "znaczy", "wiesz" zostaja — raz skasowanego slowa nie ma jak odzyskac.
    const text = 'no znaczy wiesz, to jest tak'
    expect(stripFillers(text)).toBe(text)
  })

  it('nie tyka liter w srodku slowa', () => {
    expect(stripFillers('immmunitet')).toBe('immmunitet')
    expect(stripFillers('kreeeatywny')).toBe('kreeeatywny')
  })

  it('zwraca pusty tekst, gdy dyktowanie bylo samym wahaniem', () => {
    expect(stripFillers('yyy eee mmm')).toBe('')
  })
})

suite('dlugosc', () => {
  it('liczy slowa ciagami miedzy bialymi znakami', () => {
    expect(wordCount('  dwa   slowa  ')).toBe(2)
    expect(wordCount('   ')).toBe(0)
  })

  it('prog 150 slow pokrywa typowe dyktowanie z duzym zapasem', () => {
    // Mediana realnych dyktowan to 27 slow, p95 to 121.
    expect(MAX_WORDS).toBe(150)
    expect(wordCount('slowo '.repeat(121))).toBeLessThan(MAX_WORDS)
  })

  it('sufit wyjscia rosnie z wejsciem i zawsze zostawia zapas', () => {
    expect(maxOutputTokens('ok')).toBeGreaterThan(4)
    expect(maxOutputTokens('a'.repeat(300))).toBeGreaterThan(maxOutputTokens('a'.repeat(100)))
  })
})

suite('tokeny nietykalne', () => {
  it('lapie adres, e-mail i sciezke', () => {
    expect(literals('wejdz na examply.com/ценник i sprawdz')).toContain('examply.com/ценник')
    expect(literals('napisz na jan@firma.pl jutro')).toContain('jan@firma.pl')
    expect(literals('to jest w src/main/index.ts gdzies')).toContain('src/main/index.ts')
  })

  it('lapie identyfikator mieszajacy litery z cyframi', () => {
    expect(literals('bilet COVID-19 wygasa')).toContain('COVID-19')
  })

  it('obcina interpunkcje zdania, ale nie sam adres', () => {
    expect(literals('zajrzyj na example.com/cennik.')).toEqual(['example.com/cennik'])
  })

  it('nie uznaje zwyklych slow za nietykalne', () => {
    expect(literals('to jest zwykle polskie zdanie')).toEqual([])
  })
})
