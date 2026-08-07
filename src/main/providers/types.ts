import { FailureError } from '../../shared/failure.js'
import type { ProviderId, SpokenLanguage } from '../../shared/types.js'

export interface TranscribeOptions {
  apiKey: string
  model: string
  /** Undefined = auto-detekcja jezyka. */
  language?: SpokenLanguage
}

/** Sama transkrypcja. Dane katalogowe dostawcy zyja w `src/shared/providers.ts`. */
export interface TranscriptionProvider {
  id: ProviderId
  transcribe(wav: Buffer, opts: TranscribeOptions): Promise<string>
}

export function wavBlob(wav: Buffer): Blob {
  // Buffer jest Uint8Array, ale TS nie widzi go jako BlobPart bez rzutowania.
  return new Blob([new Uint8Array(wav)], { type: 'audio/wav' })
}

/** Zglasza fakty: kod i cala odpowiedz. Komunikat powstaje dopiero w `describe()`. */
export async function readError(res: Response): Promise<never> {
  const body = await res.text().catch(() => '')
  throw new FailureError({ kind: 'provider-http', status: res.status, body })
}
