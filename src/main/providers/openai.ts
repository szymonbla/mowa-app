import type { TranscribeOptions, TranscriptionProvider } from './types.js'
import { FailureError } from '../../shared/failure.js'
import { readError, wavBlob } from './types.js'

export const openai: TranscriptionProvider = {
  id: 'openai',

  async transcribe(wav: Buffer, opts: TranscribeOptions): Promise<string> {
    const form = new FormData()
    form.append('file', wavBlob(wav), 'audio.wav')
    form.append('model', opts.model)
    // Modele gpt-4o-* przyjmuja tylko `json` albo `text`.
    form.append('response_format', 'json')
    if (opts.language) form.append('language', opts.language)

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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
