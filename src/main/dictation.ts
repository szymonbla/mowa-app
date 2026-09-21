import { describe, isKeyRejection, toFailure } from '../shared/failure.js'
import { spokenLanguage } from '../shared/languages.js'
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
      fail(failure)
    }
  }

  async function agentText(
    text: string
  ): Promise<{ text: string; context: AgentContext | null; log?: AgentContextLog }> {
    if (!host.settings().agentContext) return { text, context: null }
    try {
      const context = await host.agentContext(text)
      if (!context) return { text, context: null, log: { status: 'unavailable' } }
      return {
        text: `[voice: ${context.intent} | ${context.quality}]\n\n${text}`,
        context,
        log: { status: 'classified', ...context }
      }
    } catch {
      return { text, context: null, log: { status: 'failed' } }
    }
  }

  return { toggle, cancel, submit }
}
