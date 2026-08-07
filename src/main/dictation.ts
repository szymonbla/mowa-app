import type { ErrorFix } from '../shared/types.js'
import { getProvider } from './providers/index.js'
import { ProviderError } from './providers/types.js'
import { getApiKey, getModel, getSettings } from './settings.js'
import { PasteError, pasteText } from './paste.js'
import { getPermissions, requestMicrophone } from './permissions.js'
import { isKeyRejection, setError, setKeyHealth } from './status.js'
import {
  getRecorderWindow,
  hideOverlay,
  showOverlay,
  updateOverlay
} from './windows.js'
import { bindCancelKey, unbindCancelKey } from './shortcut.js'

type Phase = 'idle' | 'recording' | 'transcribing'

interface Failure {
  message: string
  detail?: string
  fix?: ErrorFix
}

let phase: Phase = 'idle'
let errorTimer: NodeJS.Timeout | null = null

const DONE_HIDE_MS = 600
const ERROR_HIDE_MS = 2600
/** Blad, ktory wymaga dzialania, musi zdazyc sie przeczytac. */
const ACTION_HIDE_MS = 5200

function clearTimer(): void {
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = null
}

/**
 * Pigulka pokazuje krotki komunikat i znika. Pelna tresc — z surowym stderr albo
 * odpowiedzia dostawcy — zostaje w oknie ustawien, bo tam da sie ja przeczytac.
 */
function fail(failure: Failure): void {
  phase = 'idle'
  unbindCancelKey()
  setError(failure)
  showOverlay({ state: 'error', message: failure.message })
  clearTimer()
  errorTimer = setTimeout(hideOverlay, failure.fix ? ACTION_HIDE_MS : ERROR_HIDE_MS)
}

/** Skrot dyktowania. Pierwsze nacisniecie startuje, drugie konczy. */
export function toggleDictation(): void {
  if (phase === 'recording') {
    stopRecording()
    return
  }
  if (phase === 'transcribing') return
  startRecording()
}

/**
 * Cala sciezka jest synchroniczna. Kazde `await` przed `showOverlay()` opoznialoby
 * pojawienie sie pigulki, a to jedyne potwierdzenie, ze skrot zadzialal.
 */
function startRecording(): void {
  const settings = getSettings()
  const provider = getProvider(settings.provider)

  if (!getApiKey(settings.provider)) {
    fail({ message: `Brak klucza ${provider.label}`, fix: 'key' })
    return
  }
  if (getPermissions().microphone !== 'granted') {
    // Monit systemowy pokazujemy w tle — pigulka mowi od razu, czego brakuje.
    void requestMicrophone()
    fail({ message: 'Brak zgody na mikrofon', fix: 'microphone' })
    return
  }

  clearTimer()
  phase = 'recording'
  showOverlay({ state: 'recording' })
  bindCancelKey(cancelDictation)
  getRecorderWindow().webContents.send('record:start')
}

function stopRecording(): void {
  phase = 'transcribing'
  unbindCancelKey()
  updateOverlay({ state: 'transcribing' })
  getRecorderWindow().webContents.send('record:stop')
}

export function cancelDictation(): void {
  if (phase === 'idle') return
  phase = 'idle'
  unbindCancelKey()
  getRecorderWindow().webContents.send('record:cancel')
  hideOverlay()
}

export function isRecording(): boolean {
  return phase === 'recording'
}

/** Wywolywane przez IPC, gdy renderer skonczyl kodowac WAV. */
export async function handleAudio(wav: Buffer, durationMs: number): Promise<void> {
  if (phase !== 'transcribing') return

  if (durationMs < 350) {
    fail({ message: 'Za krotkie nagranie' })
    return
  }

  const settings = getSettings()
  const provider = getProvider(settings.provider)
  const apiKey = getApiKey(settings.provider)
  if (!apiKey) {
    fail({ message: `Brak klucza ${provider.label}`, fix: 'key' })
    return
  }

  try {
    const text = await provider.transcribe(wav, {
      apiKey,
      model: getModel(settings.provider),
      language: settings.language === 'auto' ? undefined : settings.language
    })

    const trimmed = text.trim()
    if (!trimmed) {
      fail({ message: 'Nie wykryto mowy' })
      return
    }

    // Klucz przeszedl — kasujemy ewentualna czerwona lampke z wczesniejszej proby.
    setKeyHealth(settings.provider, { state: 'ok' })

    await pasteText(trimmed)
    phase = 'idle'
    setError(null)
    updateOverlay({ state: 'done' })
    clearTimer()
    errorTimer = setTimeout(hideOverlay, DONE_HIDE_MS)
  } catch (err) {
    // 401/403 zapala lampke przy kluczu, zanim uzytkownik otworzy ustawienia.
    if (isKeyRejection(err)) {
      setKeyHealth(settings.provider, { state: 'invalid', message: (err as Error).message })
    }
    fail(describeError(err))
  }
}

export function handleAudioError(message: string): void {
  fail({ message })
}

function describeError(err: unknown): Failure {
  if (err instanceof PasteError) {
    return {
      message: err.message,
      detail: err.detail,
      fix: err.kind === 'automation' || err.kind === 'accessibility' ? err.kind : undefined
    }
  }
  if (err instanceof ProviderError) {
    return {
      message: err.message,
      detail: err.status ? `HTTP ${err.status}: ${err.message}` : err.message,
      fix: err.status === 401 || err.status === 403 ? 'key' : undefined
    }
  }
  if (err instanceof TypeError) {
    return { message: 'Brak polaczenia z internetem', detail: err.message, fix: 'network' }
  }
  if (err instanceof Error) return { message: err.message.slice(0, 45), detail: err.stack }
  return { message: 'Nieznany blad', detail: String(err) }
}
