import type { TranscribeOptions, TranscriptionProvider } from './types.js'
import { FailureError } from '../../shared/failure.js'
import { readError, wavBlob } from './types.js'

/** xAI Grok STT. Endpoint nie przyjmuje pola `model`, wiec `opts.model` jest tu pusty. */
export const xai: TranscriptionProvider = {
  id: 'xai',

  async transcribe(wav: Buffer, opts: TranscribeOptions): Promise<string> {
    const form = new FormData()
    // `format=true` wlacza interpunkcje, ale wymaga jawnego jezyka.
    if (opts.language) {
      form.append('language', opts.language)
      form.append('format', 'true')
    }
    // xAI wymaga, aby `file` byl ostatnim polem multipart.
    form.append('file', wavBlob(wav), 'audio.wav')

    const res = await fetch('https://api.x.ai/v1/stt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: form
    })
    if (!res.ok) await readError(res)

    const json = (await res.json()) as { text?: string }
    if (typeof json.text !== 'string') throw new FailureError({ kind: 'provider-response' })
    return json.text
  }
}
