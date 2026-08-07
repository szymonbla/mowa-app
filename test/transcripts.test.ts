import { describe as suite, expect, it } from 'vitest'
import { createTranscriptLog, outcomeOf } from '../src/main/transcripts.js'
import type { CloseLine, OpenLine } from '../src/main/transcripts.js'
import type { Attempt, Correction } from '../src/main/cleanup/index.js'

const ATTEMPT: Attempt = { provider: 'xai', model: 'grok-4.20-0309-non-reasoning', ms: 312 }

interface Options {
  enabled?: boolean
  append?: (line: string) => void
}

/** Adapter pamieciowy na to samo miejsce, w ktorym produkcja dopisuje do pliku. */
function log(opts: Options = {}) {
  const lines: string[] = []
  let n = 0
  const instance = createTranscriptLog({
    enabled: () => opts.enabled ?? true,
    append: opts.append ?? ((line) => lines.push(line)),
    now: () => new Date('2026-08-07T12:00:00.000Z'),
    id: () => `wpis-${++n}`
  })
  return { instance, lines, parsed: <T>(): T[] => lines.map((l) => JSON.parse(l) as T) }
}

suite('outcome wpisu', () => {
  it('rozroznia pominiecie od awarii, bo przy jednym nikt nie czekal', () => {
    expect(outcomeOf({ kind: 'skipped', reason: 'too-long' })).toBe('skip:too-long')
    const failure: Correction = {
      kind: 'failed',
      failure: { kind: 'cleanup', reason: 'budget' },
      attempt: ATTEMPT
    }
    expect(outcomeOf(failure)).toBe('fail:budget')
  })

  it('ma osobna wartosc na wylaczona korekte', () => {
    // Bez tego wpis z pustym `clean` bylby nie do odroznienia od nieudanej korekty,
    // a dla oceny to dwie zupelnie rozne rzeczy.
    expect(outcomeOf(null)).toBe('off')
  })

  it('nazywa wynik udany', () => {
    const done: Correction = { kind: 'corrected', text: 'Dzień dobry.', attempt: ATTEMPT }
    expect(outcomeOf(done)).toBe('corrected')
  })
})

suite('zapis 1 — surowy tekst', () => {
  it('idzie natychmiast, z liczba slow i czasem mowienia', () => {
    const { instance, parsed } = log()
    const id = instance.open('yyy trzeba to zrobic', 'pl', 4200.7)
    expect(id).toBe('wpis-1')
    expect(parsed<OpenLine>()[0]).toEqual({
      id: 'wpis-1',
      t: '2026-08-07T12:00:00.000Z',
      lang: 'pl',
      words: 4,
      speechMs: 4201,
      raw: 'yyy trzeba to zrobic'
    })
  })

  it('nie zapisuje nic, gdy log wylaczony', () => {
    const { instance, lines } = log({ enabled: false })
    expect(instance.open('cokolwiek', 'pl', 2000)).toBeNull()
    expect(lines).toHaveLength(0)
  })
})

suite('zapis 2 — domkniecie wpisu', () => {
  it('laczy sie z pierwszym po id', () => {
    const { instance, parsed } = log()
    const id = instance.open('dzien dobry', 'pl', 2000)
    instance.close(id ?? '', { kind: 'corrected', text: 'Dzień dobry.', attempt: ATTEMPT })
    const [open, close] = parsed<OpenLine & CloseLine>()
    expect(close.id).toBe(open.id)
    expect(close).toEqual({
      id: 'wpis-1',
      clean: 'Dzień dobry.',
      outcome: 'corrected',
      cleanupMs: 312,
      provider: 'xai',
      model: 'grok-4.20-0309-non-reasoning'
    })
  })

  it('zostawia puste `clean`, gdy poprawiona wersja nie powstala', () => {
    // Wpis, nie para: poprawiona wersja jest opcjonalna, bo czesto jej nie ma.
    const { instance, parsed } = log()
    instance.close('wpis-1', { kind: 'skipped', reason: 'nothing' })
    expect(parsed<CloseLine>()[0]).toEqual({
      id: 'wpis-1',
      clean: '',
      outcome: 'skip:nothing',
      cleanupMs: 0
    })
  })

  it('zapisuje warstwe strazy, ktora odrzucila wynik', () => {
    const { instance, parsed } = log()
    instance.close('wpis-1', {
      kind: 'failed',
      failure: { kind: 'cleanup', reason: 'guard', detail: 'order' },
      attempt: { ...ATTEMPT, rejectedBy: 'order' }
    })
    expect(parsed<CloseLine>()[0]).toMatchObject({ outcome: 'fail:guard', rejectedBy: 'order' })
  })

  it('domyka wpis nawet po wylaczeniu logu w trakcie dyktowania', () => {
    // Polowka wpisu jest gorsza niz wpis, ktorego uzytkownik juz nie chcial.
    let enabled = true
    const lines: string[] = []
    const instance = createTranscriptLog({
      enabled: () => enabled,
      append: (line) => lines.push(line),
      id: () => 'wpis-1'
    })
    instance.open('dzien dobry', 'pl', 2000)
    enabled = false
    instance.close('wpis-1', null)
    expect(lines).toHaveLength(2)
  })
})

suite('log poza sciezka krytyczna', () => {
  it('polyka awarie zapisu, zamiast ja podnosic', () => {
    // Nieudany zapis nie ma wariantu `Failure` i nie zatrzymuje wklejenia. Cena jest
    // znana: cichy, martwy log poznac dopiero przy zbieraniu materialu.
    const { instance } = log({
      append: () => {
        throw new Error('EACCES')
      }
    })
    expect(() => instance.open('dzien dobry', 'pl', 2000)).not.toThrow()
    expect(() => instance.close('wpis-1', null)).not.toThrow()
  })
})
