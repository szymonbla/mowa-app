import { describe as suite, expect, it, vi } from 'vitest'
import { createDictation } from '../src/main/dictation.js'
import type { Dictation, DictationHost } from '../src/main/dictation.js'
import { FailureError } from '../src/shared/failure.js'
import type { FailureText } from '../src/shared/failure.js'
import type { KeyHealth, OverlayPayload, ProviderId } from '../src/shared/types.js'
import type { CorrectionLog } from '../src/main/text-correction.js'
import { encodeWav, silentWav } from '../src/shared/wav.js'

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
  /** Kolejne stany menu: co tray ma miec czynne. */
  actions: { retry: boolean; pasteLast: boolean }[]
  /** Sama powtorka z `actions`, w kolejnosci — czy tray ma pokazac „Powtorz". */
  retryAvailable: boolean[]
  /** Ile razy poszlo Cmd+Z. */
  undos: number
  undoPaste: () => Promise<void>
  /** Oceny dyktowania zapisane przez `feedback()`. */
  verdicts: string[]
  /** Zegar pod kontrola testu — okno na cofniecie liczy sie w milisekundach. */
  now: number
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
  /** Los korekty zapisany przy kazdym wpisie logu. */
  corrections: CorrectionLog[]
  transcribe: () => Promise<string>
  refine: (text: string) => Promise<{ text: string; log: CorrectionLog }>
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
    actions: [],
    retryAvailable: [],
    undos: 0,
    undoPaste: () => Promise.resolve(),
    verdicts: [],
    now: 1_700_000_000_000,
    micRequests: 0,
    cancelKey: null,
    apiKey: 'sk-test',
    micGranted: true,
    language: 'pl',
    transcripts: true,
    log: [],
    corrections: [],
    transcribe: () => Promise.resolve('Dzien dobry'),
    refine: (text) => Promise.resolve({ text, log: { status: 'off' } }),
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
    refine: (text) => f.refine(text),
    log: (raw, _speechMs, correction) => {
      if (!f.transcripts) return
      f.log.push(raw)
      f.corrections.push(correction)
    },
    paste: (text) => {
      f.pasted.push(text)
      return Promise.resolve()
    },
    setActions: (actions) => {
      f.actions.push(actions)
      f.retryAvailable.push(actions.retry)
    },
    now: () => f.now,
    undoPaste: () => {
      f.undos++
      return f.undoPaste()
    },
    feedback: (verdict) => {
      f.verdicts.push(verdict)
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
  return { ok: true, wav: Buffer.from(encodeWav([new Float32Array([0.02, -0.02])])), durationMs }
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

/** Udane dyktowanie od skrotu do wklejenia. */
async function pastedOnce(f: Fake): Promise<Dictation> {
  const dictation = recorded(f)
  await dictation.submit(audio())
  return dictation
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

  it('nie wysyla ciszy do dostawcy STT', async () => {
    const f = fake()
    let calls = 0
    f.host.transcribe = () => {
      calls++
      return Promise.resolve('Napisy stworzone przez społeczność Amara.org')
    }

    const dictation = recorded(f)
    await dictation.submit({ ok: true, wav: Buffer.from(silentWav(1200)), durationMs: 1200 })

    expect(calls).toBe(0)
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

suite('korekta tekstu w sciezce dyktowania', () => {
  it('wkleja tekst po korekcie, a do logu idzie surowy transkrypt', async () => {
    const f = fake()
    const log: CorrectionLog = {
      status: 'applied',
      noul: 0.91,
      model: 'typesafe/jev-1.13',
      ms: 120
    }
    f.refine = (text) => Promise.resolve({ text: `${text}.`, log })

    const dictation = await pastedOnce(f)
    await dictation.pasteLast()

    expect(f.pasted).toEqual(['Dzien dobry.', 'Dzien dobry.'])
    expect(f.log).toEqual(['Dzien dobry'])
    expect(f.corrections).toEqual([log])
  })

  it('awaria korekty wkleja tekst z transkrypcji', async () => {
    const f = fake()
    f.refine = () => Promise.reject(new Error('OpenRouter padl'))

    await pastedOnce(f)

    expect(f.pasted).toEqual(['Dzien dobry'])
    expect(f.corrections).toEqual([
      { status: 'unavailable', stage: 'correct', reason: 'OpenRouter padl' }
    ])
    expect(lastOverlay(f)).toEqual({ state: 'done' })
  })

  it('Esc w trakcie korekty nie wkleja niczego', async () => {
    const f = fake()
    let finish = (_result: { text: string; log: CorrectionLog }): void => {}
    let entered = (): void => {}
    const inCorrection = new Promise<void>((resolve) => (entered = resolve))
    f.refine = () => {
      entered()
      return new Promise((resolve) => (finish = resolve))
    }

    const dictation = recorded(f)
    const pending = dictation.submit(audio())
    await inCorrection
    dictation.cancel()
    finish({ text: 'Dzien dobry.', log: { status: 'unchanged' } })
    await pending

    expect(f.pasted).toEqual([])
    expect(f.log).toEqual([])
  })
})

suite('powtorka po awarii dostawcy', () => {
  const network = (): Promise<string> => Promise.reject(new TypeError('fetch failed'))

  /** Dostawca pada `failures` razy, potem odpowiada. */
  function flaky(f: Fake, failures: number): () => number {
    let calls = 0
    f.transcribe = () => {
      calls++
      return calls <= failures ? network() : Promise.resolve('Dzien dobry')
    }
    return () => calls
  }

  /** Odliczanie automatycznej powtorki — jedyny zegar poza zegarem pigulki. */
  function retryTimer(f: Fake): Timer {
    const found = f.timers.find((t) => t.ms === 1500)
    if (!found) throw new Error('brak zegara powtorki')
    return found
  }

  it('pierwsza awaria sieci powtarza transkrypcje sama', async () => {
    const f = fake()
    const calls = flaky(f, 1)

    await recorded(f).submit(audio())

    expect(lastOverlay(f)).toEqual({ state: 'transcribing', message: 'Powtarzam…' })
    expect(f.errors).toEqual([])
    retryTimer(f).fn()
    await vi.waitFor(() => expect(f.pasted).toEqual(['Dzien dobry']))
    expect(calls()).toBe(2)
    expect(lastOverlay(f)).toEqual({ state: 'done' })
    expect(f.retryAvailable).toEqual([false])
  })

  it('po drugiej awarii skrot powtarza zamiast nagrywac', async () => {
    const f = fake()
    const calls = flaky(f, 2)
    const dictation = recorded(f)

    await dictation.submit(audio())
    retryTimer(f).fn()
    await vi.waitFor(() =>
      expect(lastOverlay(f)).toEqual({ state: 'error', message: 'Brak sieci — skrot powtorzy' })
    )
    expect(f.errors.at(-1)?.fix).toBe('retry')
    expect(f.retryAvailable).toEqual([true])

    dictation.toggle()
    expect(f.commands).toEqual(['start', 'stop'])
    expect(lastOverlay(f)).toEqual({ state: 'transcribing' })
    await vi.waitFor(() => expect(f.pasted).toEqual(['Dzien dobry']))
    expect(calls()).toBe(3)
    expect(f.retryAvailable).toEqual([true, false])
  })

  it('po zniknieciu pigulki skrot nagrywa od nowa, a retry() wciaz powtarza', async () => {
    const f = fake()
    flaky(f, 2)
    const dictation = recorded(f)
    await dictation.submit(audio())
    retryTimer(f).fn()
    await vi.waitFor(() => expect(lastOverlay(f).state).toBe('error'))

    f.lastTimer().fn()
    expect(f.commands.at(-1)).toBe('hide')

    dictation.retry()
    expect(f.commands).toEqual(['start', 'stop', 'hide'])
    await vi.waitFor(() => expect(f.pasted).toEqual(['Dzien dobry']))
  })

  it('nowe nagranie kasuje oczekujaca powtorke', async () => {
    const f = fake()
    flaky(f, 2)
    const dictation = recorded(f)
    await dictation.submit(audio())
    retryTimer(f).fn()
    await vi.waitFor(() => expect(lastOverlay(f).state).toBe('error'))
    f.lastTimer().fn()

    dictation.toggle()
    expect(f.commands.at(-1)).toBe('start')
    expect(f.retryAvailable).toEqual([true, false])

    dictation.cancel()
    dictation.retry()
    expect(f.pasted).toEqual([])
    expect(lastOverlay(f)).toEqual({ state: 'recording' })
  })

  it('Esc w trakcie automatycznej powtorki porzuca nagranie', async () => {
    const f = fake()
    flaky(f, 1)
    const dictation = recorded(f)
    await dictation.submit(audio())
    expect(f.timers).toHaveLength(1)

    dictation.cancel()
    expect(f.timers).toEqual([])
    expect(f.commands.at(-1)).toBe('hide')
    dictation.retry()
    expect(f.pasted).toEqual([])
  })

  it('limit 429 i 5xx sa powtarzalne, 401 nie', async () => {
    for (const status of [429, 503]) {
      const f = fake()
      f.transcribe = () =>
        Promise.reject(new FailureError({ kind: 'provider-http', status, body: '' }))
      await recorded(f).submit(audio())
      expect(lastOverlay(f)).toEqual({ state: 'transcribing', message: 'Powtarzam…' })
    }
    const f = fake()
    f.transcribe = () =>
      Promise.reject(new FailureError({ kind: 'provider-http', status: 401, body: '' }))
    await recorded(f).submit(audio())
    expect(lastOverlay(f).state).toBe('error')
    expect(f.timers.map((t) => t.ms)).toEqual([5200])
  })
})

/**
 * Jeden gest zamiast trzech: cofnij zle wklejenie, powiedz, ze bylo zle, i mow dalej.
 * Okno 15 s jest tu cala trescia — poza nim ten sam skrot to zwykle dyktowanie.
 */
suite('cofnij i powtorz', () => {
  it('w oknie po wklejeniu cofa, zglasza bledne i nagrywa od nowa', async () => {
    const f = fake()
    const dictation = await pastedOnce(f)

    f.now += 3000
    await dictation.redo()

    expect(f.undos).toBe(1)
    expect(f.verdicts).toEqual(['bad'])
    expect(f.commands).toEqual(['start', 'stop', 'start'])
    expect(lastOverlay(f)).toEqual({ state: 'recording' })
  })

  it('po oknie 15 s nie cofa niczego, tylko nagrywa', async () => {
    const f = fake()
    const dictation = await pastedOnce(f)

    f.now += 15_001
    await dictation.redo()

    expect(f.undos).toBe(0)
    expect(f.verdicts).toEqual([])
    expect(f.commands.at(-1)).toBe('start')
  })

  it('bez wczesniejszego wklejenia dziala jak skrot dyktowania', async () => {
    const f = fake()
    const dictation = createDictation(f.host)

    await dictation.redo()

    expect(f.undos).toBe(0)
    expect(f.commands).toEqual(['start'])
  })

  it('w trakcie nagrywania konczy nagranie, jak drugie nacisniecie skrotu', async () => {
    const f = fake()
    const dictation = createDictation(f.host)
    dictation.toggle()

    await dictation.redo()

    expect(f.commands).toEqual(['start', 'stop'])
    expect(f.undos).toBe(0)
    expect(lastOverlay(f)).toEqual({ state: 'transcribing' })
  })

  it('nieudane Cmd+Z melduje blad, ale nagranie i tak startuje', async () => {
    const f = fake()
    const dictation = await pastedOnce(f)
    f.undoPaste = () => Promise.reject(new FailureError({ kind: 'paste', reason: 'accessibility' }))

    await dictation.redo()

    expect(f.errors.at(-1)?.message).toBe('Brak zgody Accessibility — tekst w schowku')
    expect(f.verdicts).toEqual(['bad'])
    expect(f.commands.at(-1)).toBe('start')
  })

  it('drugie cofniecie tego samego wklejenia nie rusza juz cudzego tekstu', async () => {
    const f = fake()
    const dictation = await pastedOnce(f)

    f.now += 2000
    await dictation.redo()
    // Uzytkownik rezygnuje z nagrania. Wklejenie jest juz cofniete.
    dictation.cancel()

    f.now += 3000
    await dictation.redo()

    expect(f.undos).toBe(1)
    expect(f.verdicts).toEqual(['bad'])
    expect(f.commands.at(-1)).toBe('start')
  })

  it('wkleja ostatni tekst jeszcze raz', async () => {
    const f = fake()
    const dictation = await pastedOnce(f)

    await dictation.pasteLast()

    expect(f.pasted).toEqual(['Dzien dobry', 'Dzien dobry'])
    expect(lastOverlay(f)).toEqual({ state: 'done' })
    expect(f.lastTimer().ms).toBe(600)
  })

  it('bez wklejonego tekstu nie robi nic', async () => {
    const f = fake()

    await createDictation(f.host).pasteLast()

    expect(f.pasted).toEqual([])
    expect(f.overlay).toEqual([])
  })

  it('po udanym wklejeniu tray ma czynne „Wklej ostatni tekst"', async () => {
    const f = fake()
    await pastedOnce(f)

    expect(f.actions.at(-1)).toEqual({ retry: false, pasteLast: true })
  })
})
