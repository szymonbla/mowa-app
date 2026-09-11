import { clipboard, ipcMain, shell } from 'electron'
import type { ProviderId, Settings, TestKeyResult } from '../shared/types.js'
import type { RecorderFailure } from '../shared/failure.js'
import type { AudioDevice } from '../shared/devices.js'
import { createDeviceQuery } from './device-query.js'
import { getAllKeyStatus, getKeyStatus, getSettings, patchSettings, setApiKey } from './settings.js'
import { providerMeta } from '../shared/providers.js'
import {
  getPermissions,
  requestAccessibility,
  requestAutomation,
  requestMicrophone
} from './permissions.js'
import { registerShortcut } from './shortcut.js'
import { dictation } from './dictation-host.js'
import { getRecorderWindow, sendOverlayLevel } from './windows.js'
import { setLaunchAtLogin } from './autostart.js'
import { refreshTrayMenu } from './tray.js'
import { checkKey, getStatus, setError } from './status.js'
import { clearTranscripts, deleteEntry, LOG_PATH, readEntries } from './transcripts.js'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:providers', () => providerMeta())
  ipcMain.handle('settings:keys', () => getAllKeyStatus())

  ipcMain.handle('settings:patch', (_e, patch: Partial<Settings>) => {
    if (typeof patch.launchAtLogin === 'boolean') setLaunchAtLogin(patch.launchAtLogin)
    // Nowy dostawca ma wlasny klucz — jego stan trzeba poznac przed dyktowaniem.
    if (patch.provider) void checkKey(patch.provider)
    return patchSettings(patch)
  })

  ipcMain.handle('settings:setShortcut', (_e, accelerator: string) => {
    const result = registerShortcut(accelerator, dictation.toggle)
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

  // Mikrofony zna tylko okno recordera (enumerateDevices). Okno ustawien pyta main,
  // main pyta recorder; po 2 s bez odpowiedzi pane dostaje pusta liste zamiast wisiec.
  const devices = createDeviceQuery(() => getRecorderWindow().webContents.send('record:devices'))
  ipcMain.handle('devices:list', () => devices.list())
  ipcMain.on('record:devices', (_e, list: AudioDevice[]) => devices.reply(list))

  // Panel historii. Renderer dostaje gotowe wpisy, nigdy sciezki ani surowego pliku.
  ipcMain.handle('transcripts:show', () => shell.showItemInFolder(LOG_PATH))
  ipcMain.handle('transcripts:clear', () => clearTranscripts())
  ipcMain.handle('transcripts:list', (_e, limit?: number) => readEntries(limit))
  ipcMain.handle('transcripts:delete', (_e, id: string) => deleteEntry(id))
  // Schowek zostaje w main — renderer nie ma i nie potrzebuje do niego dostepu.
  ipcMain.handle('transcripts:copy', (_e, text: string) => clipboard.writeText(text))

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
