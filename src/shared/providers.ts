/**
 * Katalog dostawcow transkrypcji. Jedyne miejsce, ktore zna ich zestaw: `ProviderId`,
 * domyslne modele, mapy stanu klucza i lista wysylana do renderera powstaja z tej tablicy.
 * Same dane — renderer importuje ten plik, nie siegajac po nic z procesu glownego.
 * Dodanie dostawcy to jeden wpis tutaj plus implementacja w `src/main/providers/`.
 */

/** Ksztalt wpisu. `id` zostaje `string`, inaczej `ProviderId` odwolywalby sie do siebie. */
interface ProviderEntry {
  id: string
  label: string
  /** Pusto = dostawca ma jeden model STT i UI nie pokazuje selektora. */
  models: readonly { id: string; label: string }[]
  keyHint: string
  keysUrl: string
}

export const PROVIDERS = [
  {
    id: 'xai',
    label: 'xAI Grok',
    // /v1/stt nie przyjmuje pola `model` — jest jeden model STT.
    models: [],
    keyHint: 'xai-…',
    keysUrl: 'https://console.x.ai/'
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-transcribe', label: 'gpt-transcribe' },
      { id: 'gpt-4o-transcribe', label: 'gpt-4o-transcribe' },
      { id: 'gpt-4o-mini-transcribe', label: 'gpt-4o-mini-transcribe' },
      { id: 'whisper-1', label: 'whisper-1' }
    ],
    keyHint: 'sk-…',
    keysUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    models: [{ id: 'scribe_v2', label: 'scribe_v2' }],
    keyHint: 'sk_…',
    keysUrl: 'https://elevenlabs.io/app/settings/api-keys'
  }
] as const satisfies readonly ProviderEntry[]

export type ProviderId = (typeof PROVIDERS)[number]['id']

/** Wpis katalogu widziany przez renderer. Bez `transcribe` — to zostaje w main. */
export interface ProviderMeta extends ProviderEntry {
  id: ProviderId
}

/** Jedyny sposob, w jaki w tym kodzie powstaje `Record<ProviderId, T>`. */
export function byProvider<T>(make: (provider: ProviderMeta) => T): Record<ProviderId, T> {
  return Object.fromEntries(PROVIDERS.map((p) => [p.id, make(p)] as const)) as Record<
    ProviderId,
    T
  >
}

/** Lista dla okna ustawien. Kopia, bo katalog jest tylko do odczytu. */
export function providerMeta(): ProviderMeta[] {
  return [...PROVIDERS]
}

/** Domyslny model to pierwszy z listy; dostawca bez modeli dostaje pusty string. */
export const DEFAULT_MODELS: Record<ProviderId, string> = byProvider(
  (p) => p.models[0]?.id ?? ''
)

export function providerLabel(id: ProviderId): string {
  return PROVIDERS.find((p) => p.id === id)?.label ?? id
}
