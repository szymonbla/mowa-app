import type { ProviderId, ProviderMeta } from '../../shared/types.js'
import type { TranscriptionProvider } from './types.js'
import { xai } from './xai.js'
import { openai } from './openai.js'
import { elevenlabs } from './elevenlabs.js'

const providers: Record<ProviderId, TranscriptionProvider> = { xai, openai, elevenlabs }

export function getProvider(id: ProviderId): TranscriptionProvider {
  return providers[id]
}

export function getProviderMeta(): ProviderMeta[] {
  return [xai, openai, elevenlabs].map(({ id, label, models, keyHint, keysUrl }) => ({
    id,
    label,
    models,
    keyHint,
    keysUrl
  }))
}

export type { TranscriptionProvider }
