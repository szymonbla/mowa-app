import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import type { KeyStatus, ProviderId, Settings } from '../shared/types.js'
import { byProvider, DEFAULT_MODELS } from '../shared/providers.js'

interface StoreFile extends Settings {
  /** Zaszyfrowane safeStorage, zapisane jako base64. */
  apiKeys: Partial<Record<ProviderId, string>>
  openRouterKey?: string
}

const DEFAULTS: Settings = {
  shortcut: 'Alt+Space',
  provider: 'xai',
  models: { ...DEFAULT_MODELS },
  language: 'pl',
  launchAtLogin: false,
  transcripts: true,
  agentContext: false
}

let filePath = ''
let store: StoreFile = { ...DEFAULTS, apiKeys: {} }

export function initSettings(): void {
  filePath = join(app.getPath('userData'), 'settings.json')
  try {
    // Migracja: `cleanup` to klucz po usunietej korekcie wypowiedzi. Odrzucamy go,
    // zeby stary plik ustawien nie wracal na dysk z martwym polem.
    const { cleanup: _cleanup, ...raw } = JSON.parse(
      readFileSync(filePath, 'utf8')
    ) as Partial<StoreFile> & { cleanup?: unknown }
    store = {
      ...DEFAULTS,
      ...raw,
      models: { ...DEFAULTS.models, ...(raw.models ?? {}) },
      apiKeys: raw.apiKeys ?? {}
    }
  } catch {
    // Pierwsze uruchomienie albo uszkodzony plik. Zostajemy na domyslnych.
    store = { ...DEFAULTS, apiKeys: {} }
  }
}

function persist(): void {
  const tmp = `${filePath}.tmp`
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
  renameSync(tmp, filePath)
}

export function getSettings(): Settings {
  const { apiKeys: _apiKeys, ...rest } = store
  return rest
}

export function patchSettings(patch: Partial<Settings>): Settings {
  store = { ...store, ...patch, models: { ...store.models, ...(patch.models ?? {}) } }
  persist()
  return getSettings()
}

export function getModel(provider: ProviderId): string {
  return store.models[provider] ?? DEFAULTS.models[provider]
}

function mask(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

export function setApiKey(provider: ProviderId, key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    delete store.apiKeys[provider]
  } else if (safeStorage.isEncryptionAvailable()) {
    store.apiKeys[provider] = safeStorage.encryptString(trimmed).toString('base64')
  } else {
    // Keychain niedostepny. Zapis w plaintext byloby cicha degradacja bezpieczenstwa.
    throw new Error('Keychain niedostepny — nie moge bezpiecznie zapisac klucza')
  }
  persist()
}

export function getApiKey(provider: ProviderId): string | null {
  const enc = store.apiKeys[provider]
  if (!enc) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return null
  }
}

export function getKeyStatus(provider: ProviderId): KeyStatus {
  const key = getApiKey(provider)
  return key ? { hasKey: true, masked: mask(key) } : { hasKey: false, masked: '' }
}

export function getAllKeyStatus(): Record<ProviderId, KeyStatus> {
  return byProvider((p) => getKeyStatus(p.id))
}

export function setOpenRouterKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) delete store.openRouterKey
  else if (safeStorage.isEncryptionAvailable())
    store.openRouterKey = safeStorage.encryptString(trimmed).toString('base64')
  else throw new Error('Keychain niedostepny — nie moge bezpiecznie zapisac klucza')
  persist()
}

export function getOpenRouterKey(): string | null {
  if (!store.openRouterKey) return null
  try {
    return safeStorage.decryptString(Buffer.from(store.openRouterKey, 'base64'))
  } catch {
    return null
  }
}

export function getOpenRouterKeyStatus(): KeyStatus {
  const key = getOpenRouterKey()
  return key ? { hasKey: true, masked: mask(key) } : { hasKey: false, masked: '' }
}
