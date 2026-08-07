import { describe, isKeyRejection, toFailure } from '../shared/failure.js'
import type { Failure, RecorderFailure } from '../shared/failure.js'
import { getProvider } from './providers/index.js'
import { getApiKey, getModel, getSettings } from './settings.js'
import { pasteText } from './paste.js'
import { getPermissions, requestMicrophone } from './permissions.js'
import { setError, setKeyHealth } from './status.js'
import {
  getRecorderWindow,
  hideOverlay,
  showOverlay,
  updateOverlay
} from './windows.js'
import { bindCancelKey, unbindCancelKey } from './shortcut.js'

type Phase = 'idle' | 'recording' | 'transcribing'

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
 * Oba miejsca biora tresc z jednego `describe()`, wiec nie moga sie rozjechac.
 */
function fail(failure: Failure): void {
  phase = 'idle'
  unbindCancelKey()
  const text = describe(failure)
  setError(text)
  showOverlay({ state: 'error', message: text.message })
  clearTimer()
  errorTimer = setTimeout(hideOverlay, text.fix ? ACTION_HIDE_MS : ERROR_HIDE_MS)
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
    fail({ kind: 'no-key', provider: provider.label })
    return
  }
  if (getPermissions().microphone !== 'granted') {
    // Monit systemowy pokazujemy w tle — pigulka mowi od razu, czego brakuje.
    void requestMicrophone()
    fail({ kind: 'microphone' })
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
    fail({ kind: 'too-short' })
    return
  }

  const settings = getSettings()
  const provider = getProvider(settings.provider)
  const apiKey = getApiKey(settings.provider)
  if (!apiKey) {
    fail({ kind: 'no-key', provider: provider.label })
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
      fail({ kind: 'no-speech' })
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
    const failure = toFailure(err)
    // 401/403 zapala lampke przy kluczu, zanim uzytkownik otworzy ustawienia.
    if (isKeyRejection(failure)) {
      setKeyHealth(settings.provider, { state: 'invalid', message: describe(failure).message })
    }
    fail(failure)
  }
}

/** Okno recordera zglasza fakty, nie tresc — pigulka bierze ja stad, co reszta. */
export function handleAudioError(failure: RecorderFailure): void {
  fail(failure)
}
