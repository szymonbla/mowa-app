import type { ProviderId } from '../../shared/types.js'
import type { TranscriptionProvider } from './types.js'
import { xai } from './xai.js'
import { openai } from './openai.js'
import { elevenlabs } from './elevenlabs.js'

/** Same implementacje. Zestaw dostawcow deklaruje katalog w `src/shared/providers.ts`. */
const transcribers: TranscriptionProvider[] = [xai, openai, elevenlabs]

export function getProvider(id: ProviderId): TranscriptionProvider {
  const found = transcribers.find((p) => p.id === id)
  // Wpis w katalogu bez implementacji to blad programisty, nie awaria do pokazania.
  if (!found) throw new Error(`Brak implementacji dostawcy: ${id}`)
  return found
}

export type { TranscriptionProvider }
