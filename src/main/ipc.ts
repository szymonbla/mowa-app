import { ipcMain, shell } from 'electron'
import type { ProviderId, Settings, TestKeyResult } from '../shared/types.js'
import {
  getAllKeyStatus,
  getKeyStatus,
  getSettings,
  patchSettings,
  setApiKey
} from './settings.js'
import { getProviderMeta } from './providers/index.js'
import {
  getPermissions,
  requestAccessibility,
  requestAutomation,
  requestMicrophone
} from './permissions.js'
import { registerShortcut } from './shortcut.js'
import { handleAudio, handleAudioError, toggleDictation } from './dictation.js'
import { sendOverlayLevel } from './windows.js'
import { setLaunchAtLogin } from './autostart.js'
import { refreshTrayMenu } from './tray.js'
import { checkKey, getStatus, setError } from './status.js'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:providers', () => getProviderMeta())
  ipcMain.handle('settings:keys', () => getAllKeyStatus())

  ipcMain.handle('settings:patch', (_e, patch: Partial<Settings>) => {
    if (typeof patch.launchAtLogin === 'boolean') setLaunchAtLogin(patch.launchAtLogin)
    // Nowy dostawca ma wlasny klucz — jego stan trzeba poznac przed dyktowaniem.
    if (patch.provider) void checkKey(patch.provider)
    return patchSettings(patch)
  })

  ipcMain.handle('settings:setShortcut', (_e, accelerator: string) => {
    const result = registerShortcut(accelerator, toggleDictation)
    if (result.ok) {
      patchSettings({ shortcut: accelerator })
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

  ipcMain.handle('status:get', () => getStatus())
  ipcMain.handle('status:clearError', () => setError(null))

  ipcMain.handle('permissions:get', () => getPermissions())
  ipcMain.handle('permissions:requestMic', () => requestMicrophone())
  ipcMain.handle('permissions:requestAx', () => requestAccessibility())
  ipcMain.handle('permissions:requestAutomation', () => requestAutomation())
  ipcMain.handle('shell:open', (_e, url: string) => shell.openExternal(url))

  // Kanaly recordera (ukryte okno → main).
  ipcMain.on('record:level', (_e, level: number) => sendOverlayLevel(level))
  ipcMain.on('record:error', (_e, message: string) => handleAudioError(message))
  ipcMain.handle('record:audio', (_e, wav: ArrayBuffer, durationMs: number) =>
    handleAudio(Buffer.from(wav), durationMs)
  )
}
