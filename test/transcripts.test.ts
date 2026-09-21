import { describe as suite, expect, it } from 'vitest'
import { createTranscriptLog } from '../src/main/transcripts.js'
import type { Line } from '../src/main/transcripts.js'

interface Options {
  enabled?: boolean
  append?: (line: string) => void
}

/** Adapter pamieciowy na to samo miejsce, w ktorym produkcja dopisuje do pliku. */
function log(opts: Options = {}) {
  const lines: string[] = []
  const instance = createTranscriptLog({
    enabled: () => opts.enabled ?? true,
    append: opts.append ?? ((line) => lines.push(line)),
    now: () => new Date('2026-08-07T12:00:00.000Z')
  })
  return { instance, lines, parsed: <T>(): T[] => lines.map((l) => JSON.parse(l) as T) }
}

suite('zapis surowego tekstu', () => {
  it('idzie natychmiast, z jezykiem i czasem mowienia', () => {
    const { instance, parsed } = log()
    instance.write('yyy trzeba to zrobic', 'pl', 4200.7)
    expect(parsed<Line>()[0]).toEqual({
      t: '2026-08-07T12:00:00.000Z',
      lang: 'pl',
      speechMs: 4201,
      raw: 'yyy trzeba to zrobic'
    })
  })

  it('nie zapisuje nic, gdy log wylaczony', () => {
    const { instance, lines } = log({ enabled: false })
    instance.write('cokolwiek', 'pl', 2000)
    expect(lines).toHaveLength(0)
  })
})

suite('log poza sciezka krytyczna', () => {
  it('polyka awarie zapisu, zamiast ja podnosic', () => {
    // Nieudany zapis nie ma wariantu `Failure` i nie zatrzymuje wklejenia. Cena jest
    // znana: cichy, martwy log poznac dopiero przy zagladnieciu do pliku.
    const { instance } = log({
      append: () => {
        throw new Error('EACCES')
      }
    })
    expect(() => instance.write('dzien dobry', 'pl', 2000)).not.toThrow()
  })
})
