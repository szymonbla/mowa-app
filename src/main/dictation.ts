import { describe, isKeyRejection, toFailure } from '../shared/failure.js'
import { spokenLanguage } from '../shared/languages.js'
import type { Failure, FailureText, RecorderFailure } from '../shared/failure.js'
import type { KeyHealth, LanguageId, OverlayPayload, ProviderId } from '../shared/types.js'
import type { TranscribeOptions } from './providers/index.js'
import type { Correction, SkipReason } from './cleanup/index.js'

type Phase = 'idle' | 'recording' | 'transcribing' | 'correcting'

const DONE_HIDE_MS = 600
/** Ostrzezenie: tekst jest juz wklejony, wiec ma sie przeczytac, a nie zatrzymywac. */
const NOTICE_HIDE_MS = 2000
const ERROR_HIDE_MS = 2600
/** Blad, ktory wymaga dzialania, musi zdazyc sie przeczytac. */
const ACTION_HIDE_MS = 5200
/** Ponizej tego progu nagranie to zwykle przypadkowe dwuklikniecie skrotu. */
const MIN_RECORDING_MS = 350

/**
 * Co pigulka mowi, gdy korekta sie nie odbyla. `null` znaczy "nic" — po wycieciu
 * wypelniaczy nie bylo czego poprawiac, wiec nie ma o czym informowac.
 * Wszystkie mieszcza sie w `PILL_MAX`.
 */
const SKIP_NOTICE: Record<SkipReason, string | null> = {
  'too-long': 'Za dlugi tekst — bez korekty',
  'no-corrector': 'Brak modelu do korekty',
  nothing: null
}

function noticeFor(correction: Correction): string | null {
  if (correction.kind === 'corrected') return null
  if (correction.kind === 'skipped') return SKIP_NOTICE[correction.reason]
  return describe(correction.failure).message
}

/** Co odsyla okno recordera: nagranie albo powod, dla ktorego go nie ma. */
export type Recording =
  | { ok: true; wav: Buffer; durationMs: number }
  | { ok: false; failure: RecorderFailure }

export interface DictationSettings {
  provider: ProviderId
  /** Nazwa dostawcy do komunikatu o braku klucza. */
  providerLabel: string
  model: string
  language: LanguageId
  /** Przelacznik korekty z ustawien. */
  cleanup: boolean
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
  /** Korekta tekstu. Nigdy nie rzuca — awaria wraca jako `Correction`. */
  correct(text: string, speechMs: number): Promise<Correction>
  /** Rozgrzewka polaczenia do korekty. Idzie w tle, nikt na nia nie czeka. */
  warmCorrector(): void
  /**
   * Log transkryptow — zapis surowego tekstu. Zwraca `id` wpisu albo `null`, gdy log
   * jest wylaczony. Stoi obok dyktowania, wiec nie ma prawa rzucic ani opoznic.
   */
  logRaw(raw: string, speechMs: number): string | null
  /** Domkniecie wpisu. `null` = korekta w ogole nie startowala. */
  logDone(id: string, correction: Correction | null): void
  paste(text: string): Promise<void>
  /** Zegar pigulki. Zwraca funkcje kasujaca odliczanie. */
  timer(ms: number, fn: () => void): () => void
}

export interface Dictation {
  /** Skrot dyktowania. Pierwsze nacisniecie startuje, drugie konczy. */
  toggle(): void
  cancel(): void
  submit(recording: Recording): Promise<void>
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

  function clearTimer(): void {
    stopTimer?.()
    stopTimer = null
  }

  function hideAfter(ms: number): void {
    clearTimer()
    stopTimer = host.timer(ms, host.hideOverlay)
  }

  /**
   * Pigulka pokazuje krotki komunikat i znika. Pelna tresc — z surowym stderr albo
   * odpowiedzia dostawcy — zostaje w oknie ustawien, bo tam da sie ja przeczytac.
   * Oba miejsca biora tresc z jednego `describe()`, wiec nie moga sie rozjechac.
   */
  function fail(failure: Failure): void {
    phase = 'idle'
    host.unbindCancelKey()
    const text = describe(failure)
    host.setError(text)
    host.showOverlay({ state: 'error', message: text.message })
    hideAfter(text.fix ? ACTION_HIDE_MS : ERROR_HIDE_MS)
  }

  /**
   * Cala sciezka startu jest synchroniczna. Kazde `await` przed `showOverlay()`
   * opoznialoby pojawienie sie pigulki, a to jedyne potwierdzenie, ze skrot zadzialal.
   */
  function start(): void {
    const { provider, providerLabel, cleanup } = host.settings()

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
    phase = 'recording'
    host.showOverlay({ state: 'recording' })
    host.bindCancelKey(cancel)
    host.record('start')
    // Uzgodnienie TCP i TLS biegnie rownolegle z mowieniem, wiec nie kosztuje czasu.
    if (cleanup) host.warmCorrector()
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
    // Transkrypcja i korekta nie sa przerywalne skrotem — drugie nacisniecie milczy.
    if (phase !== 'idle') return
    start()
  }

  function cancel(): void {
    if (phase === 'idle') return
    phase = 'idle'
    run++
    host.unbindCancelKey()
    host.record('cancel')
    host.hideOverlay()
  }

  /**
   * Korekta nigdy nie zabiera tekstu — kazde jej niepowodzenie konczy sie wklejeniem
   * wersji surowej. Dlatego nie idzie przez `fail()`, ktore tekst porzuca, i dlatego
   * `host.correct()` nie ma prawa rzucic.
   */
  async function correct(text: string, speechMs: number): Promise<Correction> {
    phase = 'correcting'
    host.updateOverlay({ state: 'correcting' })
    return host.correct(text, speechMs)
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

    const { provider, providerLabel, model, language, cleanup } = host.settings()
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

      // Zapis surowego idzie **przed** korekta, wiec awaria w jej trakcie nie kasuje
      // materialu. Wpis zaczyna sie dopiero tutaj: przerwana transkrypcja nie zostawia
      // w logu niczego, bo nie ma jeszcze tekstu, ktory bylby czegokolwiek warty.
      const entry = host.logRaw(trimmed, recording.durationMs)

      const correction = cleanup ? await correct(trimmed, recording.durationMs) : null
      // Domkniecie przed sprawdzeniem Esc — anulowane dyktowanie ma taki sam wpis jak
      // kazde inne, a wpis niedomkniety nie nadaje sie do niczego.
      if (entry) host.logDone(entry, correction)
      // Esc w trakcie korekty: wynik jest juz niczyj, tak samo jak transkrypcja.
      if (mine !== run) return

      await host.paste(correction?.kind === 'corrected' ? correction.text : trimmed)
      phase = 'idle'
      host.setError(null)

      const notice = correction && noticeFor(correction)
      host.updateOverlay(notice ? { state: 'warning', message: notice } : { state: 'done' })
      hideAfter(notice ? NOTICE_HIDE_MS : DONE_HIDE_MS)
    } catch (err) {
      if (mine !== run) return
      const failure = toFailure(err)
      // 401/403 zapala lampke przy kluczu, zanim uzytkownik otworzy ustawienia.
      if (isKeyRejection(failure)) {
        host.setKeyHealth(provider, { state: 'invalid', message: describe(failure).message })
      }
      fail(failure)
    }
  }

  return { toggle, cancel, submit }
}
