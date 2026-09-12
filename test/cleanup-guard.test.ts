import { describe as suite, expect, it } from 'vitest'
import { MAX_RATIO, MIN_COVERAGE, MIN_ORDER, diagnose, guard } from '../src/main/cleanup/guard.js'

/** Wejscie po lokalnym wycieciu wypelniaczy — z tym straz porownuje wyjscie. */
const INPUT = 'no wiec ja mysle ze to jest dobry pomysl tylko trzeba to sprawdzic'
const FIXED = 'No więc ja myślę, że to jest dobry pomysł, tylko trzeba to sprawdzić.'

suite('straz przepuszcza korekte', () => {
  it('przyjmuje interpunkcje, wielkie litery i diakrytyki', () => {
    expect(guard(INPUT, FIXED)).toEqual({ ok: true, text: FIXED })
  })

  it('przyjmuje tekst zwrocony bez zmiany', () => {
    const same = 'Spotkanie przesuwamy na czwartek.'
    expect(guard(same, same)).toEqual({ ok: true, text: same })
  })

  it('przyjmuje bardzo krotkie wejscie bez zmiany', () => {
    expect(guard('ok', 'ok')).toEqual({ ok: true, text: 'ok' })
  })

  it('przyjmuje usuniete powtorzenie mimo skrocenia', () => {
    const v = guard('ja ja mysle ze tak', 'Ja myślę, że tak.')
    expect(v.ok).toBe(true)
  })

  it('obcina preambule zamiast odrzucac wynik', () => {
    const v = guard(INPUT, `Oto poprawiona wersja tekstu:\n${FIXED}`)
    expect(v).toEqual({ ok: true, text: FIXED })
  })

  it('obcina blok kodu', () => {
    expect(guard(INPUT, '```\n' + FIXED + '\n```')).toEqual({ ok: true, text: FIXED })
  })

  it('cofa akapity, o ktore prompt nie prosil', () => {
    // grok-4.20 dolozyl podzial na akapity na dlugiej probce (ticket 12).
    const v = guard('pierwsze zdanie drugie zdanie', 'Pierwsze zdanie.\n\nDrugie zdanie.')
    expect(v).toEqual({ ok: true, text: 'Pierwsze zdanie. Drugie zdanie.' })
  })
})

suite('straz odrzuca nadgorliwosc', () => {
  it('odrzuca puste wyjscie', () => {
    expect(guard(INPUT, '   ')).toEqual({ ok: false, layer: 'empty' })
  })

  it('odrzuca rozwiniecie krotkiego tekstu w zdanie', () => {
    // Model 1.5B kontynuowal dyktowanie zamiast je naprawic (ticket 02).
    const v = guard('ok', 'Ok, w takim razie zabieram się do pracy i dam znać wieczorem.')
    expect(v).toEqual({ ok: false, layer: 'bloat' })
  })

  it('odrzuca odpowiedz na tresc zamiast korekty', () => {
    const v = guard(
      'napisz mi maila do Jana ze spotkanie sie przesuwa',
      'Cześć Janie, piszę z informacją, że nasze spotkanie zaplanowane na jutro musi zostać przesunięte na inny termin. Daj znać, kiedy Ci pasuje.'
    )
    expect(v.ok).toBe(false)
  })

  it('odrzuca obciety wynik', () => {
    expect(guard(INPUT, 'No więc ja myślę,')).toEqual({ ok: false, layer: 'truncation' })
  })

  it('odrzuca parafraze, ktora zachowuje sens i lamie szyk', () => {
    // Model 4.5B sparafrazowal tekst zamiast go poprawic (ticket 02). Dlugosc sie
    // zgadza, slowa czesciowo tez — rozjezdza sie dopiero kolejnosc.
    const v = guard(
      'trzeba to sprawdzic zanim wyslemy to do klienta w piatek',
      'W piątek, zanim do klienta to wyślemy, sprawdzić to trzeba.'
    )
    expect(v).toEqual({ ok: false, layer: 'order' })
  })

  it('odrzuca podmienione slowa mimo zachowanej dlugosci', () => {
    const v = guard(
      'zakomitowales to na branczu ficzer login czy jeszcze nie',
      'Wysłałeś te zmiany do gałęzi funkcji logowania czy jeszcze nie?'
    )
    expect(v.ok).toBe(false)
  })

  it('odrzuca zgadniety adres', () => {
    // `examply.com/ценник` jest oczywisty dla czlowieka i zgadywaniem dla modulu.
    const v = guard(
      'wejdz na examply.com/ценник i sprawdz cene',
      'Wejdź na example.com/cennik i sprawdź cenę.'
    )
    expect(v).toEqual({ ok: false, layer: 'literal' })
  })

  it('przepuszcza zdanie z zepsutym adresem, gdy adres zostal nietkniety', () => {
    const v = guard(
      'wejdz na examply.com/ценник i sprawdz cene',
      'Wejdź na examply.com/ценник i sprawdź cenę.'
    )
    expect(v.ok).toBe(true)
  })
})

suite('diagnose liczy metryki bez progow', () => {
  it('zwraca liczby zgodne z przyjeta korekta', () => {
    const { text, metrics } = diagnose(INPUT, FIXED)
    expect(text).toBe(FIXED)
    expect(metrics.before).toBe(13)
    expect(metrics.after).toBe(13)
    expect(metrics.ratio).toBe(1)
    expect(metrics.missingLiterals).toEqual([])
    expect(metrics.coverage).toBe(1)
    expect(metrics.order).toBe(1)
  })

  it('nie odrzuca — sam raportuje niski wskaznik dla bloatu', () => {
    const { metrics } = diagnose(
      'ok',
      'Ok, w takim razie zabieram się do pracy i dam znać wieczorem.'
    )
    expect(metrics.ratio).toBeGreaterThan(MAX_RATIO)
  })

  it('wypisuje brakujacy literal zamiast tylko odrzucic', () => {
    const { metrics } = diagnose(
      'wejdz na examply.com/ценник i sprawdz cene',
      'Wejdź na example.com/cennik i sprawdź cenę.'
    )
    expect(metrics.missingLiterals).toEqual(['examply.com/ценник'])
  })

  it('mowi "o ile" tam, gdzie guard mowi tylko "nie" — parafraza', () => {
    const input = 'trzeba to sprawdzic zanim wyslemy to do klienta w piatek'
    const raw = 'W piątek, zanim do klienta to wyślemy, sprawdzić to trzeba.'
    expect(guard(input, raw)).toEqual({ ok: false, layer: 'order' })
    const { metrics } = diagnose(input, raw)
    expect(metrics.order).toBeLessThan(MIN_ORDER)
  })

  it('metryki przyjetej korekty spelniaja wszystkie progi guard', () => {
    const { metrics } = diagnose(INPUT, FIXED)
    expect(metrics.ratio).toBeLessThanOrEqual(MAX_RATIO)
    expect(metrics.coverage).toBeGreaterThanOrEqual(MIN_COVERAGE)
    expect(metrics.order).toBeGreaterThanOrEqual(MIN_ORDER)
  })
})
