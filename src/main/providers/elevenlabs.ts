import type { TranscribeOptions, TranscriptionProvider } from './types.js'
import { FailureError } from '../../shared/failure.js'
import { readError, wavBlob } from './types.js'

export const elevenlabs: TranscriptionProvider = {
  id: 'elevenlabs',

  async transcribe(wav: Buffer, opts: TranscribeOptions): Promise<string> {
    const form = new FormData()
    form.append('file', wavBlob(wav), 'audio.wav')
    form.append('model_id', opts.model)
    // Domyslnie true — wstawialoby znaczniki typu "(laughs)" w dyktowanym tekscie.
    form.append('tag_audio_events', 'false')
    form.append('timestamps_granularity', 'none')
    if (opts.language) form.append('language_code', opts.language)

    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': opts.apiKey },
      body: form
    })
    if (!res.ok) await readError(res)

    const json = (await res.json()) as { text?: string }
    if (typeof json.text !== 'string') throw new FailureError({ kind: 'provider-response' })
    return json.text
  }
}
