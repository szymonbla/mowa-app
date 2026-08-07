import type { ProviderId } from '../../shared/types.js'
import { specFor } from './spec.js'
import { transcribeWith } from './request.js'
import type { TranscribeOptions } from './spec.js'

/**
 * Transkrypcja przez wybranego dostawce. Dostawca jest opisany (`spec.ts`), nie
 * zaimplementowany — zadanie robi jeden wspolny kod (`request.ts`).
 */
export function transcribe(
  provider: ProviderId,
  wav: Buffer,
  opts: TranscribeOptions
): Promise<string> {
  return transcribeWith(specFor(provider), wav, opts)
}

export type { TranscribeOptions }
