import { contextBridge, ipcRenderer } from 'electron'
import type { RecorderFailure } from '../shared/failure.js'
import type {
  AppStatus,
  AutomationStatus,
  KeyStatus,
  OverlayPayload,
  PermissionStatus,
  ProviderId,
  ProviderMeta,
  Settings,
  ShortcutName,
  TestKeyResult
} from '../shared/types.js'

const api = {
  // --- Ustawienia ---
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  patchSettings: (patch: Partial<Settings>): Promise<Settings> =>
    ipcRenderer.invoke('settings:patch', patch),
  getProviders: (): Promise<ProviderMeta[]> => ipcRenderer.invoke('settings:providers'),
  setShortcut: (
    name: ShortcutName,
    accelerator: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('settings:setShortcut', name, accelerator),

  // --- Klucze API. Renderer widzi tylko maske, nigdy klucza. ---
  getKeys: (): Promise<Record<ProviderId, KeyStatus>> => ipcRenderer.invoke('settings:keys'),
  setKey: (provider: ProviderId, key: string): Promise<KeyStatus> =>
    ipcRenderer.invoke('keys:set', provider, key),
  testKey: (provider: ProviderId): Promise<TestKeyResult> =>
    ipcRenderer.invoke('keys:test', provider),
  getOpenRouterKey: (): Promise<KeyStatus> => ipcRenderer.invoke('openrouter:key'),
  setOpenRouterKey: (key: string): Promise<KeyStatus> =>
    ipcRenderer.invoke('openrouter:setKey', key),

  /** Powtarza zapamietane nagranie. Bez nagrania nic sie nie dzieje. */
  retry: (): Promise<void> => ipcRenderer.invoke('dictation:retry'),

  // --- Diagnostyka: stan klucza i ostatni blad ---
  getStatus: (): Promise<AppStatus> => ipcRenderer.invoke('status:get'),
  clearError: (): Promise<void> => ipcRenderer.invoke('status:clearError'),
  onStatus: (cb: (status: AppStatus) => void): void => {
    ipcRenderer.on('status:changed', (_e, status: AppStatus) => cb(status))
  },

  // --- Uprawnienia ---
  getPermissions: (): Promise<PermissionStatus> => ipcRenderer.invoke('permissions:get'),
  requestMicrophone: (): Promise<boolean> => ipcRenderer.invoke('permissions:requestMic'),
  requestAccessibility: (): Promise<boolean> => ipcRenderer.invoke('permissions:requestAx'),
  requestAutomation: (): Promise<AutomationStatus> =>
    ipcRenderer.invoke('permissions:requestAutomation'),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),

  // --- Log transkryptow. Renderer nie czyta pliku, tylko go pokazuje albo kasuje. ---
  showTranscripts: (): Promise<void> => ipcRenderer.invoke('transcripts:show'),
  clearTranscripts: (): Promise<void> => ipcRenderer.invoke('transcripts:clear')
}

const overlayApi = {
  onState: (cb: (payload: OverlayPayload) => void): void => {
    ipcRenderer.on('overlay:state', (_e, payload: OverlayPayload) => cb(payload))
  },
  onLevel: (cb: (level: number) => void): void => {
    ipcRenderer.on('overlay:level', (_e, level: number) => cb(level))
  }
}

const recorderApi = {
  onStart: (cb: () => void): void => {
    ipcRenderer.on('record:start', () => cb())
  },
  onStop: (cb: () => void): void => {
    ipcRenderer.on('record:stop', () => cb())
  },
  onCancel: (cb: () => void): void => {
    ipcRenderer.on('record:cancel', () => cb())
  },
  sendLevel: (level: number): void => ipcRenderer.send('record:level', level),
  sendError: (failure: RecorderFailure): void => ipcRenderer.send('record:error', failure),
  sendAudio: (wav: ArrayBuffer, durationMs: number): Promise<void> =>
    ipcRenderer.invoke('record:audio', wav, durationMs)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('overlay', overlayApi)
contextBridge.exposeInMainWorld('recorder', recorderApi)

export type Api = typeof api
export type OverlayApi = typeof overlayApi
export type RecorderApi = typeof recorderApi
