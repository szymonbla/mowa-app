import { createDictation } from './dictation.js'
import type { DictationHost } from './dictation.js'
import { transcribe } from './providers/index.js'
import { appendLine, createTranscriptLog } from './transcripts.js'
import { providerLabel } from '../shared/providers.js'
import { getApiKey, getModel, getSettings } from './settings.js'
import { pasteText, undoPaste } from './paste.js'
import { getPermissions, requestMicrophone } from './permissions.js'
import { setError, setKeyHealth } from './status.js'
import { getRecorderWindow, hideOverlay, showOverlay, updateOverlay } from './windows.js'
import { bindCancelKey, unbindCancelKey } from './shortcut.js'
import { classifyAgentContext } from './agent-context.js'
import { getOpenRouterKey } from './settings.js'
import { frontmostIsAgent } from './agent-app.js'
import { markLastDictation, rememberLastDictation } from './feedback.js'
import type { ShortcutName } from '../shared/types.js'

/** Log stoi obok dyktowania: wlasny przelacznik, wlasne zycie, zero wplywu na wynik. */
const log = createTranscriptLog({
  enabled: () => getSettings().transcripts,
  append: appendLine
})

/**
 * Co tray ma czynne. Tray o dyktowaniu wie, ale dyktowanie o tray nie: kto odswieza
 * menu, ustala warstwa startowa — tak samo jak w `status.ts`.
 */
let actions = { retry: false, pasteLast: false }
let onActions: (() => void) | null = null

export function onActionsChanged(fn: () => void): void {
  onActions = fn
}

export function trayActions(): { retry: boolean; pasteLast: boolean } {
  return actions
}

/** Adapter na Electron. Drugi adapter tej samej krawedzi — pamieciowy — zyje w testach. */
const host: DictationHost = {
  settings() {
    const { provider, language, agentContext } = getSettings()
    return {
      provider,
      providerLabel: providerLabel(provider),
      model: getModel(provider),
      language,
      agentContext
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
  transcribe,
  agentContext: async (text) => {
    if (!(await frontmostIsAgent())) return null
    const key = getOpenRouterKey()
    return key ? classifyAgentContext(text, key) : null
  },
  log: (raw, speechMs, agent) => {
    log.write(raw, getSettings().language, speechMs, agent)
    rememberLastDictation()
  },
  paste(text) {
    // Oba przelaczniki czytamy przy kazdym wklejeniu — zmiana dziala bez restartu.
    const { pasteMode, restoreClipboard } = getSettings()
    return pasteText(text, { mode: pasteMode, restore: restoreClipboard })
  },
  undoPaste,
  feedback: markLastDictation,
  setActions(next) {
    actions = next
    onActions?.()
  },
  now: Date.now,
  timer(ms, fn) {
    const id = setTimeout(fn, ms)
    return () => clearTimeout(id)
  }
}

/** Jedno dyktowanie na aplikacje — skrot, tray i IPC mowia do tego samego obiektu. */
export const dictation = createDictation(host)

/**
 * Co robi kazdy z dwoch skrotow. Jedno miejsce, wiec rejestracja przy starcie
 * i zmiana skrotu z ustawien nie moga podpiac dwoch roznych akcji.
 */
export const SHORTCUT_ACTIONS: Record<ShortcutName, () => void> = {
  dictate: () => dictation.toggle(),
  redo: () => void dictation.redo()
}
