import { describe as suite, expect, it } from 'vitest'
import { createDictation } from '../src/main/dictation.js'
import type { Dictation, DictationHost } from '../src/main/dictation.js'
import { FailureError } from '../src/shared/failure.js'
import type { FailureText } from '../src/shared/failure.js'
import type { KeyHealth, OverlayPayload, ProviderId } from '../src/shared/types.js'

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
  /** Przelacznik logu — wlasny, tak samo jak w ustawieniach. */
  transcripts: boolean
  /** Co trafilo do logu transkryptow, w kolejnosci. */
  log: string[]
  transcribe: () => Promise<string>
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
    transcripts: true,
    log: [],
    transcribe: () => Promise.resolve('Dzien dobry'),
    lastTimer: () => f.timers[f.timers.length - 1]
  }

  f.host = {
    settings: () => ({
      provider: 'xai',
      providerLabel: 'xAI Grok',
      model: '',
      language: f.language
    }),
    apiKey: () => f.apiKey,
    microphoneGranted: () => f.micGranted,
    requestMicrophone: () => {
      f.micRequests++
    },
    record: (command) => {
      f.commands.push(command)
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
    log: (raw) => {
      if (!f.transcripts) return
      f.log.push(raw)
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

suite('log transkryptow w sciezce dyktowania', () => {
  it('zapisuje surowy tekst tak, jak przyszedl od dostawcy', async () => {
    const f = fake()
    const raw = 'Yyy, ja ja chce jutro, nie, w piatek wyslac ten tekst'
    f.transcribe = () => Promise.resolve(raw)
    await recorded(f).submit(audio())
    expect(f.pasted).toEqual([raw])
    expect(f.log).toEqual([raw])
    expect(f.overlay.map((o) => o.state)).toEqual(['recording', 'transcribing', 'done'])
  })

  it('nie zapisuje nic, gdy log wylaczony', async () => {
    const f = fake()
    f.transcripts = false
    await recorded(f).submit(audio())
    expect(f.log).toEqual([])
  })

  it('nie zapisuje niczego, gdy transkrypcja nie dala tekstu', async () => {
    const f = fake()
    f.transcribe = () => Promise.resolve('   ')
    await recorded(f).submit(audio())
    expect(f.log).toEqual([])
  })
})
