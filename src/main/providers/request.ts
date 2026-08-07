import { FailureError } from '../../shared/failure.js'
import type { ProviderSpec, TranscribeOptions } from './spec.js'

/**
 * Jedyne miejsce, ktore wysyla nagranie i czyta odpowiedz. Roznice miedzy dostawcami
 * przychodza w `spec` — tu nie ma zadnego `if` po nazwie dostawcy.
 */
export async function transcribeWith(
  spec: ProviderSpec,
  wav: Buffer,
  opts: TranscribeOptions
): Promise<string> {
  const res = await fetch(spec.url, {
    method: 'POST',
    headers: { [spec.auth.header]: `${spec.auth.prefix ?? ''}${opts.apiKey}` },
    body: body(spec, wav, opts)
  })
  // Zglaszamy fakty: kod i cala odpowiedz. Komunikat powstaje dopiero w `describe()`.
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new FailureError({ kind: 'provider-http', status: res.status, body: text })
  }

  const json = (await res.json()) as { text?: string }
  if (typeof json.text !== 'string') throw new FailureError({ kind: 'provider-response' })
  return json.text
}

function body(spec: ProviderSpec, wav: Buffer, opts: TranscribeOptions): FormData {
  const form = new FormData()
  for (const field of spec.fields(opts)) {
    if ('file' in field) form.append(field.name, wavBlob(wav), 'audio.wav')
    else form.append(field.name, field.value)
  }
  return form
}

function wavBlob(wav: Buffer): Blob {
  // Buffer jest Uint8Array, ale TS nie widzi go jako BlobPart bez rzutowania.
  return new Blob([new Uint8Array(wav)], { type: 'audio/wav' })
}
