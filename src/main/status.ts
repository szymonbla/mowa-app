import type { AppError, AppStatus, KeyHealth, ProviderId } from '../shared/types.js'
import { describe, isKeyRejection, toFailure } from '../shared/failure.js'
import { getProvider } from './providers/index.js'
import { getApiKey, getModel } from './settings.js'
import { silentWav } from '../shared/wav.js'

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

/** Kto wypycha stan na zewnatrz, ustala warstwa startowa. Status nie zna okien. */
let listener: ((status: AppStatus) => void) | null = null

export function onStatusChanged(fn: (status: AppStatus) => void): void {
  listener = fn
}

export function getStatus(): AppStatus {
  return { keyHealth: { ...keyHealth }, lastError }
}

function broadcast(): void {
  listener?.(getStatus())
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
    // Enkoder jest wspolny i nie zna Buffera — owijamy dopiero tu, na krawedzi.
    await getProvider(provider).transcribe(Buffer.from(silentWav(500)), {
      apiKey,
      model: getModel(provider),
      language: 'en'
    })
    return setKeyHealth(provider, { state: 'ok' })
  } catch (err) {
    // Ta sama tresc, ktora zobaczylby uzytkownik w pigulce po nieudanym dyktowaniu.
    const failure = toFailure(err)
    const { message } = describe(failure)
    if (isKeyRejection(failure)) return setKeyHealth(provider, { state: 'invalid', message })
    // Brak sieci albo awaria dostawcy. Klucz moze byc dobry — nie oskarzamy go.
    return setKeyHealth(provider, { state: 'error', message })
  }
}
