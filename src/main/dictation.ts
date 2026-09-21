import { describe, isKeyRejection, isRetryable, toFailure } from '../shared/failure.js'
import { spokenLanguage } from '../shared/languages.js'
import { hasSpeech } from '../shared/wav.js'
import type { Failure, FailureText, RecorderFailure } from '../shared/failure.js'
import type { KeyHealth, LanguageId, OverlayPayload, ProviderId } from '../shared/types.js'
import type { TranscribeOptions } from './providers/index.js'
import type { AgentContext, AgentContextLog } from './agent-context.js'

type Phase = 'idle' | 'recording' | 'transcribing'

const DONE_HIDE_MS = 600
const ERROR_HIDE_MS = 2600
/** Blad, ktory wymaga dzialania, musi zdazyc sie przeczytac. */
const ACTION_HIDE_MS = 5200
/** Ponizej tego progu nagranie to zwykle przypadkowe dwuklikniecie skrotu. */
const MIN_RECORDING_MS = 350
/**
 * Odstep przed automatyczna powtorka. Dosc, zeby chwilowa awaria sieci minela,
 * i za malo, zeby uzytkownik zaczal mowic drugi raz.
 */
const RETRY_DELAY_MS = 1500
/**
 * Jak dlugo po wklejeniu skrot cofania odnosi sie jeszcze do tego wklejenia.
 * Dluzej niz ludzka reakcja na zly tekst, krocej niz powrot do pracy gdzie indziej —
 * po tym czasie Cmd+Z cofnelby cudza zmiane.
 */
const REDO_WINDOW_MS = 15_000

/** Co odsyla okno recordera: nagranie albo powod, dla ktorego go nie ma. */
export type Recording =
  { ok: true; wav: Buffer; durationMs: number } | { ok: false; failure: RecorderFailure }

export interface DictationSettings {
  provider: ProviderId
  /** Nazwa dostawcy do komunikatu o braku klucza. */
  providerLabel: string
  model: string
  language: LanguageId
  agentContext: boolean
}

/**
 * Jedyna krawedz dyktowania. Adapter na Electron siedzi w `dictation-host.ts`,
 * adapter pamieciowy — w testach; dzieki temu cala sciezka biegnie bez Electrona.
 * Odczyty sa synchroniczne, bo start nie moze na nic czekac.
 */
export interface DictationHost {
  settings(): DictationSettings
  apiKey(provider: ProviderId): string | null
  microphoneGranted(): boolean
  /** Monit systemowy. Idzie w tle — pigulka mowi od razu, czego brakuje. */
  requestMicrophone(): void
  /** Rozkaz dla okna recordera. */
  record(command: 'start' | 'stop' | 'cancel'): void
  bindCancelKey(onCancel: () => void): void
  unbindCancelKey(): void
  showOverlay(payload: OverlayPayload): void
  updateOverlay(payload: OverlayPayload): void
  hideOverlay(): void
  setError(error: FailureText | null): void
  setKeyHealth(provider: ProviderId, health: KeyHealth): void
  transcribe(provider: ProviderId, wav: Buffer, opts: TranscribeOptions): Promise<string>
  agentContext(text: string): Promise<AgentContext | null>
  /**
   * Log transkryptow — zapis surowego tekstu. Stoi obok dyktowania, wiec nie ma
   * prawa rzucic ani opoznic wklejenia.
   */
  log(raw: string, speechMs: number, agent?: AgentContextLog): void
  paste(text: string): Promise<void>
  /** Cmd+Z do aktywnej aplikacji. Cofa wklejenie, ktore wlasnie poszlo. */
  undoPaste(): Promise<void>
  /** Ocena ostatniego dyktowania. Lokalny sygnal, bez tresci. */
  feedback(verdict: 'good' | 'bad'): void
  /** Co tray ma czynne. Dyktowanie nie wie, jak wyglada menu. */
  setActions(actions: { retry: boolean; pasteLast: boolean }): void
  /** Zegar scienny. Okno na cofniecie liczy sie w czasie uzytkownika, nie w fazach. */
  now(): number
  /** Zegar pigulki. Zwraca funkcje kasujaca odliczanie. */
  timer(ms: number, fn: () => void): () => void
}

export interface Dictation {
  /** Skrot dyktowania. Pierwsze nacisniecie startuje, drugie konczy. */
  toggle(): void
  cancel(): void
  submit(recording: Recording): Promise<void>
  /** Wysyla zapamietane nagranie jeszcze raz. Bez nagrania — nic nie robi. */
  retry(): void
  /**
   * Skrot cofania. Zaraz po wklejeniu: Cmd+Z, ocena „bledne" i nowe nagranie.
   * Poza tym okresem — to samo co `toggle()`.
   */
  redo(): Promise<void>
  /** Wkleja ostatni tekst jeszcze raz, bez nagrywania. */
  pasteLast(): Promise<void>
}

/**
 * Cale dyktowanie: skrot → pigulka → mowa → skrot → wklejenie. Faza zyje tylko tutaj,
 * bo kazdy, kto moglby ja ustawic z zewnatrz, moglby ja tez rozjechac z pigulka.
 */
export function createDictation(host: DictationHost): Dictation {
  let phase: Phase = 'idle'
  let stopTimer: (() => void) | null = null
  /** Rosnie przy anulowaniu. Transkrypcja ze starego biegu jest juz niczyja. */
  let run = 0
  /**
   * Ostatnie nagranie, ktore przeszlo progi dlugosci i mowy. Zyje w pamieci do
   * udanego wklejenia albo do nastepnego nagrania — na dysk nie trafia nigdy.
   */
  let pending: { wav: Buffer; durationMs: number } | null = null
  /** Jedna automatyczna powtorka na nagranie. Dalej decyduje uzytkownik. */
  let autoRetried = false
  /** Trwa, dopoki widac pigulke z podpowiedzia — wtedy skrot powtarza, nie nagrywa. */
  let retryArmed = false
  /** Odliczanie do automatycznej powtorki. Osobne od zegara pigulki. */
  let retryTimer: (() => void) | null = null
  /** Ostatni wklejony tekst i chwila wklejenia. Z tego zyja `redo()` i `pasteLast()`. */
  let lastText: string | null = null
  let lastPasteAt: number | null = null
  /** Co tray ma czynne. Wysylamy tylko zmiany — menu nie ma sie przebudowywac bez powodu. */
  let actions = { retry: false, pasteLast: false }

  function setActions(next: Partial<typeof actions>): void {
    const merged = { ...actions, ...next }
    if (merged.retry === actions.retry && merged.pasteLast === actions.pasteLast) return
    actions = merged
    host.setActions(merged)
  }

  function clearTimer(): void {
    stopTimer?.()
    stopTimer = null
  }

  function clearRetryTimer(): void {
    retryTimer?.()
    retryTimer = null
  }

  /** Zniknieciu pigulki towarzyszy koniec okna, w ktorym skrot powtarzal. */
  function hideAfter(ms: number): void {
    clearTimer()
    stopTimer = host.timer(ms, () => {
      retryArmed = false
      host.hideOverlay()
    })
  }

  /** Nagranie przestaje byc czymkolwiek: ani skrot, ani tray nie maja co powtarzac. */
  function forgetPending(): void {
    pending = null
    autoRetried = false
    clearRetryTimer()
  }

  /**
   * Pigulka pokazuje krotki komunikat i znika. Pelna tresc — z surowym stderr albo
   * odpowiedzia dostawcy — zostaje w oknie ustawien, bo tam da sie ja przeczytac.
   * Oba miejsca biora tresc z jednego `describe()`, wiec nie moga sie rozjechac.
   */
  function fail(failure: Failure, opts?: { retry?: boolean }): void {
    phase = 'idle'
    host.unbindCancelKey()
    const text = describe(failure, opts)
    host.setError(text)
    host.showOverlay({ state: 'error', message: text.message })
    hideAfter(text.fix ? ACTION_HIDE_MS : ERROR_HIDE_MS)
    if (!opts?.retry) return
    retryArmed = true
    setActions({ retry: true })
  }

  /**
   * Cala sciezka startu jest synchroniczna. Kazde `await` przed `showOverlay()`
   * opoznialoby pojawienie sie pigulki, a to jedyne potwierdzenie, ze skrot zadzialal.
   */
  function start(): void {
    const { provider, providerLabel } = host.settings()

    if (!host.apiKey(provider)) {
      fail({ kind: 'no-key', provider: providerLabel })
      return
    }
    if (!host.microphoneGranted()) {
      host.requestMicrophone()
      fail({ kind: 'microphone' })
      return
    }

    clearTimer()
    // Nowe nagranie zastepuje poprzednie: stare nie ma juz gdzie wrocic.
    forgetPending()
    setActions({ retry: false })
    phase = 'recording'
    host.showOverlay({ state: 'recording' })
    host.bindCancelKey(cancel)
    host.record('start')
  }

  function stop(): void {
    phase = 'transcribing'
    host.unbindCancelKey()
    host.updateOverlay({ state: 'transcribing' })
    host.record('stop')
  }

  function toggle(): void {
    if (phase === 'recording') {
      stop()
      return
    }
    // Transkrypcja nie jest przerywalna skrotem — drugie nacisniecie milczy.
    if (phase !== 'idle') return
    // Skrot przy widocznym bledzie znaczy „jeszcze raz", nie „nagraj od nowa".
    if (retryArmed && pending) {
      retry()
      return
    }
    start()
  }

  function cancel(): void {
    if (phase === 'idle') return
    phase = 'idle'
    run++
    // Esc w trakcie odliczania do powtorki tez znaczy „zapomnij o tym nagraniu".
    forgetPending()
    setActions({ retry: false })
    host.unbindCancelKey()
    host.record('cancel')
    host.hideOverlay()
  }

  /**
   * Zle wklejenie kosztuje jeden gest: Cmd+Z, ocena i nowe nagranie. Poza oknem
   * `REDO_WINDOW_MS` uzytkownik jest juz gdzie indziej — cofalibysmy cudza zmiane,
   * wiec skrot znaczy wtedy dokladnie to samo co skrot dyktowania.
   */
  async function redo(): Promise<void> {
    if (phase !== 'idle') {
      toggle()
      return
    }
    if (lastPasteAt === null || host.now() - lastPasteAt > REDO_WINDOW_MS) {
      start()
      return
    }

    try {
      await host.undoPaste()
    } catch (err) {
      // Cmd+Z nie dochodzi np. w terminalu. Blad melduje sie w ustawieniach, ale
      // nagranie startuje tak samo: uzytkownik juz zaczyna mowic.
      host.setError(describe(toFailure(err)))
    }
    host.feedback('bad')
    start()
  }

  /** Ten sam tekst jeszcze raz — gdy pierwsze wklejenie poszlo w zle okno. */
  async function pasteLast(): Promise<void> {
    if (!lastText) return
    try {
      await host.paste(lastText)
    } catch (err) {
      fail(toFailure(err))
      return
    }
    host.showOverlay({ state: 'done' })
    hideAfter(DONE_HIDE_MS)
  }

  /** Powtorka z tray, paska w ustawieniach albo skrotu przy widocznej pigulce. */
  function retry(): void {
    if (phase !== 'idle' || !pending) return
    retryArmed = false
    clearTimer()
    phase = 'transcribing'
    host.showOverlay({ state: 'transcribing' })
    void process(pending)
  }

  async function submit(recording: Recording): Promise<void> {
    // Awaria recordera nie zalezy od fazy — mikrofon potrafi odmowic juz przy starcie.
    if (!recording.ok) {
      fail(recording.failure)
      return
    }
    if (phase !== 'transcribing') return

    if (recording.durationMs < MIN_RECORDING_MS) {
      fail({ kind: 'too-short' })
      return
    }
    if (!hasSpeech(recording.wav)) {
      fail({ kind: 'no-speech' })
      return
    }

    // Od tej chwili nagranie jest dobre. Cokolwiek padnie dalej, mowa nie przepada.
    pending = { wav: recording.wav, durationMs: recording.durationMs }
    autoRetried = false
    await process(pending)
  }

  /**
   * Wszystko po nagraniu: transkrypcja → JEV → log → wklejenie. Osobno od `submit()`,
   * bo powtorka wchodzi dokladnie tutaj — z tym samym nagraniem i bez progow.
   */
  async function process(recording: { wav: Buffer; durationMs: number }): Promise<void> {
    const { provider, providerLabel, model, language } = host.settings()
    const apiKey = host.apiKey(provider)
    if (!apiKey) {
      fail({ kind: 'no-key', provider: providerLabel })
      return
    }

    const mine = run
    try {
      const text = await host.transcribe(provider, recording.wav, {
        apiKey,
        model,
        language: spokenLanguage(language)
      })
      // Esc w trakcie transkrypcji: wynik jest juz niczyj, nie wolno go wkleic.
      if (mine !== run) return

      const trimmed = text.trim()
      if (!trimmed) {
        fail({ kind: 'no-speech' })
        return
      }

      // Klucz przeszedl — kasujemy ewentualna czerwona lampke z wczesniejszej proby.
      host.setKeyHealth(provider, { state: 'ok' })

      const agent = await agentText(trimmed)
      host.log(trimmed, recording.durationMs, agent.log)
      await host.paste(agent.text)
      phase = 'idle'
      // Tekst doszedl: nie ma juz czego powtarzac, ale jest co cofnac i co wkleic.
      forgetPending()
      lastText = agent.text
      lastPasteAt = host.now()
      setActions({ retry: false, pasteLast: true })
      host.setError(null)

      host.updateOverlay({ state: 'done', agentQuality: agent.context?.quality })
      hideAfter(DONE_HIDE_MS)
    } catch (err) {
      if (mine !== run) return
      const failure = toFailure(err)
      // 401/403 zapala lampke przy kluczu, zanim uzytkownik otworzy ustawienia.
      if (isKeyRejection(failure)) {
        host.setKeyHealth(provider, { state: 'invalid', message: describe(failure).message })
      }

      // Pierwsza awaria, ktora mija sama, nie zasluguje na uwage uzytkownika:
      // pigulka zostaje w transkrypcji, a nagranie idzie drugi raz samo.
      if (isRetryable(failure) && !autoRetried && pending) {
        autoRetried = true
        host.updateOverlay({ state: 'transcribing', message: 'Powtarzam…' })
        clearRetryTimer()
        retryTimer = host.timer(RETRY_DELAY_MS, () => {
          retryTimer = null
          if (pending) void process(pending)
        })
        return
      }

      fail(failure, { retry: isRetryable(failure) })
    }
  }

  async function agentText(
    text: string
  ): Promise<{ text: string; context: AgentContext | null; log?: AgentContextLog }> {
    if (!host.settings().agentContext) return { text, context: null }
    try {
      const context = await host.agentContext(text)
      if (!context) return { text, context: null, log: { status: 'unavailable' } }
      return { text, context, log: { status: 'classified', ...context } }
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 240) : 'unknown error'
      return { text, context: null, log: { status: 'failed', reason } }
    }
  }

  return { toggle, cancel, submit, retry, redo, pasteLast }
}
