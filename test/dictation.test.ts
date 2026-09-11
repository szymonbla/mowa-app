import { describe as suite, expect, it } from 'vitest'
import { createDictation } from '../src/main/dictation.js'
import type { Dictation, DictationHost, RecordStart } from '../src/main/dictation.js'
import { FailureError } from '../src/shared/failure.js'
import type { FailureText } from '../src/shared/failure.js'
import type { Attempt, Correction } from '../src/main/cleanup/index.js'
import type { KeyHealth, OverlayPayload, ProviderId } from '../src/shared/types.js'

const ATTEMPT: Attempt = { provider: 'xai', model: 'grok-test', ms: 120 }

interface Timer {
  ms: number
  fn: () => void
}

/**
 * Adapter pamieciowy — druga implementacja tej samej krawedzi co `dictation-host.ts`.
 * Zapisuje wszystko, co dyktowanie zrobilo na zewnatrz, i nie dotyka Electrona.
 */
interface Fake {
  host: DictationHost
  /** Rozkazy do recordera plus 'hide', w kolejnosci. */
  commands: string[]
  overlay: OverlayPayload[]
  errors: (FailureText | null)[]
  health: { provider: ProviderId; health: KeyHealth }[]
  timers: Timer[]
  pasted: string[]
  micRequests: number
  /** Esc podpiety przez `bindCancelKey`. Null = nie da sie anulowac. */
  cancelKey: (() => void) | null
  apiKey: string | null
  micGranted: boolean
  language: 'auto' | 'pl' | 'en'
  cleanup: boolean
  /** Mikrofon z ustawien; `''` = domyslne systemowe. */
  inputDevice: string
  /** Ladunki rozkazu `start`, w kolejnosci. */
  starts: RecordStart[]
  /** Przelacznik logu — osobny od korekty, tak samo jak w ustawieniach. */
  transcripts: boolean
  /** Co trafilo do logu transkryptow: zapis 1 i zapis 2, w kolejnosci. */
  log: { open: string[]; close: { id: string; correction: Correction | null }[] }
  warmed: number
  transcribe: () => Promise<string>
  correct: (text: string, speechMs: number) => Promise<Correction>
  /** Ostatnie zaplanowane odliczanie pigulki. */
  lastTimer(): Timer
}

function fake(): Fake {
  const f: Fake = {
    host: null as unknown as DictationHost,
    commands: [],
    overlay: [],
    errors: [],
    health: [],
    timers: [],
    pasted: [],
    micRequests: 0,
    cancelKey: null,
    apiKey: 'sk-test',
    micGranted: true,
    language: 'pl',
    cleanup: false,
    inputDevice: '',
    transcripts: true,
    starts: [],
    log: { open: [], close: [] },
    warmed: 0,
    transcribe: () => Promise.resolve('Dzien dobry'),
    correct: (text) => Promise.resolve<Correction>({ kind: 'corrected', text, attempt: ATTEMPT }),
    lastTimer: () => f.timers[f.timers.length - 1]
  }

  f.host = {
    settings: () => ({
      provider: 'xai',
      providerLabel: 'xAI Grok',
      model: '',
      language: f.language,
      cleanup: f.cleanup,
      inputDevice: f.inputDevice
    }),
    apiKey: () => f.apiKey,
    microphoneGranted: () => f.micGranted,
    requestMicrophone: () => {
      f.micRequests++
    },
    record: (command, start) => {
      f.commands.push(command)
      if (start) f.starts.push(start)
    },
    bindCancelKey: (onCancel) => {
      f.cancelKey = onCancel
    },
    unbindCancelKey: () => {
      f.cancelKey = null
    },
    showOverlay: (payload) => {
      f.overlay.push(payload)
    },
    updateOverlay: (payload) => {
      f.overlay.push(payload)
    },
    hideOverlay: () => {
      f.commands.push('hide')
    },
    setError: (error) => {
      f.errors.push(error)
    },
    setKeyHealth: (provider, health) => {
      f.health.push({ provider, health })
    },
    transcribe: () => f.transcribe(),
    correct: (text, speechMs) => f.correct(text, speechMs),
    warmCorrector: () => {
      f.warmed++
    },
    logRaw: (raw) => {
      if (!f.transcripts) return null
      f.log.open.push(raw)
      return `wpis-${f.log.open.length}`
    },
    logDone: (id, correction) => {
      f.log.close.push({ id, correction })
    },
    paste: (text) => {
      f.pasted.push(text)
      return Promise.resolve()
    },
    timer: (ms, fn) => {
      const timer = { ms, fn }
      f.timers.push(timer)
      return () => {
        f.timers = f.timers.filter((t) => t !== timer)
      }
    }
  }

  return f
}

function audio(durationMs = 1200): { ok: true; wav: Buffer; durationMs: number } {
  return { ok: true, wav: Buffer.alloc(64), durationMs }
}

/** Nagrywa i konczy — stan wyjsciowy dla testow transkrypcji. */
function recorded(f: Fake): Dictation {
  const dictation = createDictation(f.host)
  dictation.toggle()
  dictation.toggle()
  return dictation
}

function lastOverlay(f: Fake): OverlayPayload {
  return f.overlay[f.overlay.length - 1]
}

suite('dyktowanie', () => {
  it('startuje przy pierwszym skrocie i konczy przy drugim', () => {
    const f = fake()
    const dictation = createDictation(f.host)

    dictation.toggle()
    expect(f.commands).toEqual(['start'])
    expect(f.overlay[0]).toEqual({ state: 'recording' })
    // Esc dziala tylko w trakcie nagrywania.
    expect(f.cancelKey).not.toBeNull()

    dictation.toggle()
    expect(f.commands).toEqual(['start', 'stop'])
    expect(lastOverlay(f)).toEqual({ state: 'transcribing' })
    expect(f.cancelKey).toBeNull()
  })

  it('rozkaz start niesie mikrofon z ustawien, bo recorder sam ich nie zna', () => {
    const f = fake()
    f.inputDevice = 'usb-1'
    const dictation = createDictation(f.host)

    dictation.toggle()
    expect(f.starts).toEqual([{ inputDevice: 'usb-1' }])
  })

  it('trzeci skrot w trakcie transkrypcji nic nie robi', () => {
    const f = fake()
    const dictation = recorded(f)

    dictation.toggle()
    expect(f.commands).toEqual(['start', 'stop'])
  })

  it('bez klucza nie zaczyna nagrywac', () => {
    const f = fake()
    f.apiKey = null

    createDictation(f.host).toggle()

    expect(f.commands).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Brak klucza xAI Grok' })
    expect(f.errors[0]?.fix).toBe('key')
  })

  it('bez zgody na mikrofon prosi o nia i nie zaczyna nagrywac', () => {
    const f = fake()
    f.micGranted = false

    createDictation(f.host).toggle()

    expect(f.micRequests).toBe(1)
    expect(f.commands).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Brak zgody na mikrofon' })
  })

  it('odrzuca nagranie ponizej progu dlugosci', async () => {
    const f = fake()
    await recorded(f).submit(audio(200))

    expect(f.pasted).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Za krotkie nagranie' })
  })

  it('odrzuca pusty transkrypt', async () => {
    const f = fake()
    f.transcribe = () => Promise.resolve('   ')

    await recorded(f).submit(audio())

    expect(f.pasted).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Nie wykryto mowy' })
  })

  it('wkleja transkrypt i kasuje ostatni blad', async () => {
    const f = fake()
    f.transcribe = () => Promise.resolve('  Dzien dobry  ')

    await recorded(f).submit(audio())

    expect(f.pasted).toEqual(['Dzien dobry'])
    expect(f.errors[f.errors.length - 1]).toBeNull()
    expect(f.health).toEqual([{ provider: 'xai', health: { state: 'ok' } }])
    expect(lastOverlay(f)).toEqual({ state: 'done' })
  })

  it('jezyk auto idzie do dostawcy jako brak jezyka', async () => {
    const f = fake()
    f.language = 'auto'
    let seen: string | undefined = 'pl'
    f.host.transcribe = (_provider, _wav, opts) => {
      seen = opts.language
      return Promise.resolve('tekst')
    }

    await recorded(f).submit(audio())
    expect(seen).toBeUndefined()
  })

  it('odpowiedz 401 znaczy klucz jako zly', async () => {
    const f = fake()
    f.transcribe = () =>
      Promise.reject(new FailureError({ kind: 'provider-http', status: 401, body: 'nope' }))

    await recorded(f).submit(audio())

    expect(f.health).toEqual([
      { provider: 'xai', health: { state: 'invalid', message: 'Nieprawidlowy klucz API' } }
    ])
    expect(f.pasted).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Nieprawidlowy klucz API' })
  })

  it('awaria recordera konczy dyktowanie', async () => {
    const f = fake()
    const dictation = createDictation(f.host)
    dictation.toggle()

    await dictation.submit({ ok: false, failure: { kind: 'no-input' } })

    expect(f.cancelKey).toBeNull()
    expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Nie mozna otworzyc mikrofonu' })
  })

  it('Esc w trakcie nagrywania nie wkleja niczego', () => {
    const f = fake()
    createDictation(f.host).toggle()

    f.cancelKey?.()

    expect(f.commands).toEqual(['start', 'cancel', 'hide'])
    expect(f.pasted).toEqual([])
    expect(f.errors).toEqual([])
  })

  it('transkrypt, ktory przyszedl po anulowaniu, przepada', async () => {
    const f = fake()
    let finish = (_text: string): void => {}
    f.transcribe = () => new Promise((resolve) => (finish = resolve))

    const dictation = recorded(f)
    const pending = dictation.submit(audio())
    dictation.cancel()
    finish('Dzien dobry')
    await pending

    expect(f.pasted).toEqual([])
    expect(f.errors).toEqual([])
    expect(f.health).toEqual([])
  })

  it('blad, ktory przyszedl po anulowaniu, nie zapala pigulki', async () => {
    const f = fake()
    let fail = (_err: unknown): void => {}
    f.transcribe = () => new Promise((_resolve, reject) => (fail = reject))

    const dictation = recorded(f)
    const pending = dictation.submit(audio())
    dictation.cancel()
    fail(new FailureError({ kind: 'provider-http', status: 401, body: '' }))
    await pending

    expect(f.errors).toEqual([])
    expect(f.health).toEqual([])
  })
})

suite('czas zycia pigulki', () => {
  it('po wklejeniu znika szybko', async () => {
    const f = fake()
    await recorded(f).submit(audio())

    expect(f.lastTimer().ms).toBe(600)
    f.lastTimer().fn()
    expect(f.commands[f.commands.length - 1]).toBe('hide')
  })

  it('blad bez naprawy zostaje dluzej', async () => {
    const f = fake()
    await recorded(f).submit(audio(200))

    expect(f.lastTimer().ms).toBe(2600)
  })

  it('blad z przyciskiem naprawy zostaje najdluzej', () => {
    const f = fake()
    f.apiKey = null

    createDictation(f.host).toggle()

    expect(f.errors[0]?.fix).toBe('key')
    expect(f.lastTimer().ms).toBe(5200)
  })

  it('nowe nagranie kasuje odliczanie poprzedniej pigulki', async () => {
    const f = fake()
    const dictation = recorded(f)
    await dictation.submit(audio())
    expect(f.timers).toHaveLength(1)

    dictation.toggle()
    expect(f.timers).toEqual([])
  })
})

suite('korekta w sciezce dyktowania', () => {
  /** Nagrywa i konczy z wlaczona korekta. */
  function withCleanup(f: Fake): Dictation {
    f.cleanup = true
    return recorded(f)
  }

  it('wkleja wersje poprawiona i pokazuje faze korekty', async () => {
    const f = fake()
    f.correct = (text) =>
      Promise.resolve<Correction>({ kind: 'corrected', text: `${text}.`, attempt: ATTEMPT })

    await withCleanup(f).submit(audio())

    expect(f.overlay.map((o) => o.state)).toContain('correcting')
    expect(f.pasted).toEqual(['Dzien dobry.'])
    expect(lastOverlay(f)).toEqual({ state: 'done' })
  })

  it('rozgrzewa polaczenie przy wcisnieciu skrotu, nie po nagraniu', () => {
    const f = fake()
    f.cleanup = true

    createDictation(f.host).toggle()

    expect(f.warmed).toBe(1)
  })

  it('wylaczona korekta nie rusza tekstu ani nie rozgrzewa', async () => {
    const f = fake()
    f.correct = () => Promise.reject(new Error('nie wolno wolac'))

    await recorded(f).submit(audio())

    expect(f.warmed).toBe(0)
    expect(f.pasted).toEqual(['Dzien dobry'])
    expect(f.overlay.map((o) => o.state)).not.toContain('correcting')
  })

  it('awaria korekty wkleja tekst surowy i ostrzega', async () => {
    const f = fake()
    f.correct = () =>
      Promise.resolve<Correction>({
        kind: 'failed',
        failure: { kind: 'cleanup', reason: 'budget' },
        attempt: ATTEMPT
      })

    await withCleanup(f).submit(audio())

    // Tekst nie ginie nigdy — to jest cala roznica miedzy ostrzezeniem a bledem.
    expect(f.pasted).toEqual(['Dzien dobry'])
    expect(lastOverlay(f).state).toBe('warning')
    expect(f.lastTimer().ms).toBe(2000)
  })

  it('awaria korekty nie zapala czerwonego paska w ustawieniach', async () => {
    const f = fake()
    f.correct = () =>
      Promise.resolve<Correction>({
        kind: 'failed',
        failure: { kind: 'cleanup', reason: 'provider', detail: 'HTTP 401' },
        attempt: ATTEMPT
      })

    await withCleanup(f).submit(audio())

    expect(f.errors[f.errors.length - 1]).toBeNull()
    expect(f.health.every((h) => h.health.state === 'ok')).toBe(true)
  })

  it('pominiecie z powodu dlugosci mowi o tym wprost', async () => {
    const f = fake()
    f.correct = () => Promise.resolve<Correction>({ kind: 'skipped', reason: 'too-long' })

    await withCleanup(f).submit(audio())

    expect(f.pasted).toEqual(['Dzien dobry'])
    expect(lastOverlay(f)).toEqual({ state: 'warning', message: 'Za dlugi tekst — bez korekty' })
  })

  it('brak czego poprawiac konczy sie zwyklym potwierdzeniem', async () => {
    const f = fake()
    f.correct = () => Promise.resolve<Correction>({ kind: 'skipped', reason: 'nothing' })

    await withCleanup(f).submit(audio())

    expect(lastOverlay(f)).toEqual({ state: 'done' })
  })

  it('Esc w trakcie korekty porzuca wynik i nie wkleja nic', async () => {
    const f = fake()
    const dictation = withCleanup(f)
    f.correct = (text) =>
      new Promise<Correction>((resolve) => {
        dictation.cancel()
        resolve({ kind: 'corrected', text, attempt: ATTEMPT })
      })

    await dictation.submit(audio())

    expect(f.pasted).toEqual([])
  })
})

suite('log transkryptow w sciezce dyktowania', () => {
  function withCleanup(f: Fake): Dictation {
    f.cleanup = true
    return recorded(f)
  }

  it('zapisuje surowy tekst, zanim zawola korekte', async () => {
    const f = fake()
    const order: string[] = []
    f.correct = () => {
      order.push('correct')
      const text = 'Dzień dobry.'
      return Promise.resolve<Correction>({ kind: 'corrected', text, attempt: ATTEMPT })
    }
    const dictation = withCleanup(f)
    const logRaw = f.host.logRaw
    f.host.logRaw = (raw, speechMs) => {
      order.push('logRaw')
      return logRaw(raw, speechMs)
    }

    await dictation.submit(audio())

    // Kolejnosc jest cala wartoscia tego zapisu: awaria w trakcie korekty nie ma
    // prawa zabrac materialu, ktory juz istnieje.
    expect(order).toEqual(['logRaw', 'correct'])
    expect(f.log.open).toEqual(['Dzien dobry'])
  })

  it('domyka wpis takze wtedy, gdy korekta w ogole nie startowala', async () => {
    const f = fake()

    // Przelacznik korekty wylaczony: zapis 2 idzie natychmiast po zapisie 1.
    await recorded(f).submit(audio())

    expect(f.log.open).toEqual(['Dzien dobry'])
    expect(f.log.close).toEqual([{ id: 'wpis-1', correction: null }])
  })

  it('domyka wpis po Esc w trakcie korekty', async () => {
    const f = fake()
    const dictation = withCleanup(f)
    f.correct = (text) =>
      new Promise<Correction>((resolve) => {
        dictation.cancel()
        resolve({ kind: 'corrected', text, attempt: ATTEMPT })
      })

    await dictation.submit(audio())

    // Tekst przepadl, ale wpis nie: niedomkniety nie nadaje sie do niczego,
    // a anulowane dyktowanie jest dla oceny tak samo dobre jak kazde inne.
    expect(f.pasted).toEqual([])
    expect(f.log.close).toHaveLength(1)
  })

  it('nie domyka wpisu, ktory nie powstal', async () => {
    const f = fake()
    f.transcripts = false

    await withCleanup(f).submit(audio())

    expect(f.log.open).toEqual([])
    expect(f.log.close).toEqual([])
  })

  it('nie zapisuje niczego, gdy transkrypcja nie dala tekstu', async () => {
    const f = fake()
    f.transcribe = () => Promise.resolve('   ')

    await withCleanup(f).submit(audio())

    expect(f.log.open).toEqual([])
  })
})
