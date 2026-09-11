import { createDictation } from './dictation.js'
import type { DictationHost } from './dictation.js'
import { transcribe } from './providers/index.js'
import { createCorrector } from './cleanup/index.js'
import { appendLine, createTranscriptLog } from './transcripts.js'
import { providerLabel } from '../shared/providers.js'
import { getApiKey, getModel, getSettings } from './settings.js'
import { pasteText } from './paste.js'
import { getPermissions, requestMicrophone } from './permissions.js'
import { setError, setKeyHealth } from './status.js'
import { getRecorderWindow, hideOverlay, showOverlay, updateOverlay } from './windows.js'
import { bindCancelKey, unbindCancelKey } from './shortcut.js'

/**
 * Korektor wie tylko, kto jest dostawca i czy ma klucz. Slownik wlasny to faza 2 —
 * na razie slot zwraca pusta liste, a prompt mowi wtedy wprost, ze nie ma czego podstawiac.
 */
const corrector = createCorrector({
  provider: () => getSettings().provider,
  apiKey: getApiKey,
  dictionary: () => []
})

/** Log stoi obok dyktowania: wlasny przelacznik, wlasne zycie, zero wplywu na wynik. */
const log = createTranscriptLog({
  enabled: () => getSettings().transcripts,
  append: appendLine
})

/** Adapter na Electron. Drugi adapter tej samej krawedzi — pamieciowy — zyje w testach. */
const host: DictationHost = {
  settings() {
    const { provider, language, cleanup, inputDevice } = getSettings()
    return {
      provider,
      providerLabel: providerLabel(provider),
      model: getModel(provider),
      language,
      cleanup,
      inputDevice
    }
  },
  apiKey: getApiKey,
  microphoneGranted: () => getPermissions().microphone === 'granted',
  requestMicrophone: () => void requestMicrophone(),
  record: (command, start) => getRecorderWindow().webContents.send(`record:${command}`, start),
  bindCancelKey,
  unbindCancelKey,
  showOverlay,
  updateOverlay,
  hideOverlay,
  setError,
  setKeyHealth,
  transcribe,
  correct: corrector.correct,
  warmCorrector: corrector.warm,
  logRaw: (raw, speechMs) => log.open(raw, getSettings().language, speechMs),
  logDone: log.close,
  paste: pasteText,
  timer(ms, fn) {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  }
}

/** Jedno dyktowanie na aplikacje — skrot, tray i IPC mowia do tego samego obiektu. */
export const dictation = createDictation(host)
