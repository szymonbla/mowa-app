import type { ProviderId, ProviderMeta } from '../../shared/types.js'

export interface TranscribeOptions {
  apiKey: string
  model: string
  /** Undefined = auto-detekcja jezyka. */
  language?: 'pl' | 'en'
}

export interface TranscriptionProvider extends ProviderMeta {
  id: ProviderId
  transcribe(wav: Buffer, opts: TranscribeOptions): Promise<string>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Zamienia kod HTTP na komunikat, ktory zmiesci sie w pigulce. */
export function httpMessage(status: number, body: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Nieprawidlowy klucz API'
    case 404:
      return 'Nieznany model'
    case 413:
      return 'Nagranie za dlugie'
    case 429:
      return 'Limit zapytan — poczekaj'
    default:
      if (status >= 500) return 'Blad serwera dostawcy'
      return `Blad ${status}: ${body.slice(0, 80)}`
  }
}

export function wavBlob(wav: Buffer): Blob {
  // Buffer jest Uint8Array, ale TS nie widzi go jako BlobPart bez rzutowania.
  return new Blob([new Uint8Array(wav)], { type: 'audio/wav' })
}

export async function readError(res: Response): Promise<never> {
  const body = await res.text().catch(() => '')
  throw new ProviderError(httpMessage(res.status, body), res.status)
}
