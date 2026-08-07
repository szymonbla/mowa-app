import type { ProviderId, SpokenLanguage } from '../../shared/types.js'

export interface TranscribeOptions {
  apiKey: string
  model: string
  /** Undefined = auto-detekcja jezyka. */
  language?: SpokenLanguage
}

/**
 * Pole multipart. Kolejnosc w tablicy to kolejnosc w zadaniu — xAI odrzuca nagranie,
 * jesli `file` nie jest ostatnie.
 */
export type Field = { name: string; value: string } | { name: string; file: true }

/**
 * Opis dostawcy transkrypcji: adres, naglowek klucza i pola multipart. Zadanie,
 * kody HTTP i odczyt odpowiedzi robi jeden wspolny kod w `request.ts` — tutaj sa
 * tylko roznice miedzy dostawcami.
 */
export interface ProviderSpec {
  id: ProviderId
  url: string
  /** `prefix` doklejany przed kluczem, np. `Bearer `. */
  auth: { header: string; prefix?: string }
  fields(opts: TranscribeOptions): readonly Field[]
}

const SPECS: readonly ProviderSpec[] = [
  {
    id: 'xai',
    url: 'https://api.x.ai/v1/stt',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    // Endpoint nie przyjmuje pola `model` — jest jeden model STT.
    fields: ({ language }) => [
      // `format=true` wlacza interpunkcje, ale wymaga jawnego jezyka.
      ...(language
        ? [
            { name: 'language', value: language },
            { name: 'format', value: 'true' }
          ]
        : []),
      // xAI wymaga, aby `file` bylo ostatnim polem multipart.
      { name: 'file', file: true }
    ]
  },
  {
    id: 'openai',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    fields: ({ model, language }) => [
      { name: 'file', file: true },
      { name: 'model', value: model },
      // Modele gpt-4o-* przyjmuja tylko `json` albo `text`.
      { name: 'response_format', value: 'json' },
      ...(language ? [{ name: 'language', value: language }] : [])
    ]
  },
  {
    id: 'elevenlabs',
    url: 'https://api.elevenlabs.io/v1/speech-to-text',
    auth: { header: 'xi-api-key' },
    fields: ({ model, language }) => [
      { name: 'file', file: true },
      { name: 'model_id', value: model },
      // Domyslnie true — wstawialoby znaczniki typu "(laughs)" w dyktowanym tekscie.
      { name: 'tag_audio_events', value: 'false' },
      { name: 'timestamps_granularity', value: 'none' },
      ...(language ? [{ name: 'language_code', value: language }] : [])
    ]
  }
]

/** Zestaw dostawcow deklaruje katalog w `src/shared/providers.ts`. */
export function specFor(id: ProviderId): ProviderSpec {
  const found = SPECS.find((s) => s.id === id)
  // Wpis w katalogu bez specyfikacji to blad programisty, nie awaria do pokazania.
  if (!found) throw new Error(`Brak specyfikacji dostawcy: ${id}`)
  return found
}
