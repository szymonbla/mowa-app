import type { AppError, AppStatus, KeyHealth, ProviderId } from '../shared/types.js'
import { getProvider } from './providers/index.js'
import { ProviderError } from './providers/types.js'
import { getApiKey, getModel } from './settings.js'
import { silentWav } from './wav.js'
import { getSettingsWindow } from './windows.js'

/**
 * Diagnostyka aplikacji: czy klucz dziala i co ostatnio poszlo zle.
 * Trzymana tylko w pamieci — po restarcie sprawdzamy klucz od nowa, bo mogl
 * wygasnac miedzy uruchomieniami.
 */
const keyHealth: Record<ProviderId, KeyHealth> = {
  xai: { state: 'unknown' },
  openai: { state: 'unknown' },
  elevenlabs: { state: 'unknown' }
}

let lastError: AppError | null = null

export function getStatus(): AppStatus {
  return { keyHealth: { ...keyHealth }, lastError }
}

function broadcast(): void {
  getSettingsWindow()?.webContents.send('status:changed', getStatus())
}

export function setError(err: Omit<AppError, 'at'> | null): void {
  lastError = err ? { ...err, at: Date.now() } : null
  broadcast()
}

export function setKeyHealth(provider: ProviderId, health: KeyHealth): KeyHealth {
  keyHealth[provider] = health
  broadcast()
  return health
}

/** True dla kodow, ktore znacza klucz jako zly, a nie chwilowa awarie. */
export function isKeyRejection(err: unknown): boolean {
  return err instanceof ProviderError && (err.status === 401 || err.status === 403)
}

/**
 * Wysyla 0,5 s ciszy do dostawcy. Pusty transkrypt jest oczekiwany — liczy sie
 * kod HTTP. To ta sama sciezka, ktorej uzywa przycisk "Test" w ustawieniach,
 * wiec oba miejsca nie moga sie rozjechac.
 */
export async function checkKey(provider: ProviderId): Promise<KeyHealth> {
  const apiKey = getApiKey(provider)
  // Brak klucza to nie jest zly klucz — o braku mowi juz osobne miejsce w UI.
  if (!apiKey) return setKeyHealth(provider, { state: 'unknown' })

  setKeyHealth(provider, { state: 'checking' })
  try {
    await getProvider(provider).transcribe(silentWav(500), {
      apiKey,
      model: getModel(provider),
      language: 'en'
    })
    return setKeyHealth(provider, { state: 'ok' })
  } catch (err) {
    if (isKeyRejection(err)) {
      return setKeyHealth(provider, { state: 'invalid', message: (err as ProviderError).message })
    }
    // Brak sieci albo awaria dostawcy. Klucz moze byc dobry — nie oskarzamy go.
    return setKeyHealth(provider, { state: 'error', message: describeCheckError(err) })
  }
}

function describeCheckError(err: unknown): string {
  if (err instanceof ProviderError) return err.message
  if (err instanceof TypeError) return 'Brak polaczenia'
  return err instanceof Error ? err.message.slice(0, 120) : 'Nieznany blad'
}
