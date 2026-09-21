import { ipcMain, shell } from 'electron'
import type { ProviderId, Settings, ShortcutName, TestKeyResult } from '../shared/types.js'
import type { RecorderFailure } from '../shared/failure.js'
import {
  getAllKeyStatus,
  getKeyStatus,
  getOpenRouterKeyStatus,
  getSettings,
  patchSettings,
  setApiKey,
  setOpenRouterKey
} from './settings.js'
import { providerMeta } from '../shared/providers.js'
import {
  getPermissions,
  requestAccessibility,
  requestAutomation,
  requestMicrophone
} from './permissions.js'
import { registerShortcut } from './shortcut.js'
import { SHORTCUT_ACTIONS, dictation } from './dictation-host.js'
import { sendOverlayLevel } from './windows.js'
import { setLaunchAtLogin } from './autostart.js'
import { refreshTrayMenu } from './tray.js'
import { checkKey, getStatus, setError } from './status.js'
import { clearTranscripts, LOG_PATH } from './transcripts.js'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:providers', () => providerMeta())
  ipcMain.handle('settings:keys', () => getAllKeyStatus())
  ipcMain.handle('openrouter:key', () => getOpenRouterKeyStatus())
  ipcMain.handle('openrouter:setKey', (_e, key: string) => {
    setOpenRouterKey(key)
    return getOpenRouterKeyStatus()
  })

  ipcMain.handle('settings:patch', (_e, patch: Partial<Settings>) => {
    if (typeof patch.launchAtLogin === 'boolean') setLaunchAtLogin(patch.launchAtLogin)
    // Nowy dostawca ma wlasny klucz — jego stan trzeba poznac przed dyktowaniem.
    if (patch.provider) void checkKey(patch.provider)
    return patchSettings(patch)
  })

  ipcMain.handle('settings:setShortcut', (_e, name: ShortcutName, accelerator: string) => {
    const result = registerShortcut(name, accelerator, SHORTCUT_ACTIONS[name])
    if (result.ok) {
      patchSettings(name === 'redo' ? { redoShortcut: accelerator } : { shortcut: accelerator })
      // Menu pokazuje oba skroty przy swoich pozycjach.
      refreshTrayMenu()
    }
    return result
  })

  ipcMain.handle('keys:set', (_e, provider: ProviderId, key: string) => {
    setApiKey(provider, key)
    // Nowy klucz sprawdzamy od razu — inaczej lampka zostalaby czerwona po naprawie.
    void checkKey(provider)
    return getKeyStatus(provider)
  })

  ipcMain.handle('keys:test', async (_e, provider: ProviderId): Promise<TestKeyResult> => {
    const health = await checkKey(provider)
    if (health.state === 'ok') return { ok: true }
    if (health.state === 'unknown') return { ok: false, error: 'Brak klucza' }
    return { ok: false, error: health.message ?? 'Blad' }
  })

  // Pasek w ustawieniach ma ten sam przycisk co tray — jedna droga do powtorki.
  ipcMain.handle('dictation:retry', () => dictation.retry())

  ipcMain.handle('status:get', () => getStatus())
  ipcMain.handle('status:clearError', () => setError(null))

  ipcMain.handle('permissions:get', () => getPermissions())
  ipcMain.handle('permissions:requestMic', () => requestMicrophone())
  ipcMain.handle('permissions:requestAx', () => requestAccessibility())
  ipcMain.handle('permissions:requestAutomation', () => requestAutomation())
  ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))

  // Zamiast przegladarki historii — dwa przyciski. Lista ostatnich transkryptow
  // w ustawieniach to juz przegladarka, tylko ubozsza, a ta jest poza zakresem.
  ipcMain.handle('transcripts:show', () => shell.showItemInFolder(LOG_PATH))
  ipcMain.handle('transcripts:clear', () => clearTranscripts())

  // Kanaly recordera (ukryte okno → main).
  ipcMain.on('record:level', (_e, level: number) => sendOverlayLevel(level))
  ipcMain.on(
    'record:error',
    (_e, failure: RecorderFailure) => void dictation.submit({ ok: false, failure })
  )
  ipcMain.handle('record:audio', (_e, wav: ArrayBuffer, durationMs: number) =>
    dictation.submit({ ok: true, wav: Buffer.from(wav), durationMs })
  )
}
