import { createDictation } from './dictation.js'
import type { DictationHost } from './dictation.js'
import { getProvider } from './providers/index.js'
import { providerLabel } from '../shared/providers.js'
import { getApiKey, getModel, getSettings } from './settings.js'
import { pasteText } from './paste.js'
import { getPermissions, requestMicrophone } from './permissions.js'
import { setError, setKeyHealth } from './status.js'
import { getRecorderWindow, hideOverlay, showOverlay, updateOverlay } from './windows.js'
import { bindCancelKey, unbindCancelKey } from './shortcut.js'

/** Adapter na Electron. Drugi adapter tej samej krawedzi — pamieciowy — zyje w testach. */
const host: DictationHost = {
  settings() {
    const { provider, language } = getSettings()
    return {
      provider,
      providerLabel: providerLabel(provider),
      model: getModel(provider),
      language
    }
  },
  apiKey: getApiKey,
  microphoneGranted: () => getPermissions().microphone === 'granted',
  requestMicrophone: () => void requestMicrophone(),
  record: (command) => getRecorderWindow().webContents.send(`record:${command}`),
  bindCancelKey,
  unbindCancelKey,
  showOverlay,
  updateOverlay,
  hideOverlay,
  setError,
  setKeyHealth,
  transcribe: (provider, wav, opts) => getProvider(provider).transcribe(wav, opts),
  paste: pasteText,
  timer(ms, fn) {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  }
}

/** Jedno dyktowanie na aplikacje — skrot, tray i IPC mowia do tego samego obiektu. */
export const dictation = createDictation(host)
