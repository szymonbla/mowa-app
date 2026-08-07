import { afterEach, describe as suite, expect, it } from 'vitest'
import { transcribe } from '../src/main/providers/index.js'
import type { TranscribeOptions } from '../src/main/providers/index.js'
import type { ProviderId } from '../src/shared/types.js'
import { toFailure } from '../src/shared/failure.js'
import type { Failure } from '../src/shared/failure.js'

const WAV = Buffer.from([1, 2, 3, 4])
const OPTS: TranscribeOptions = { apiKey: 'klucz', model: 'model-x', language: 'pl' }

interface Sent {
  url: string
  headers: Record<string, string>
  fields: [string, string][]
}

let sent: Sent | null = null
const realFetch = globalThis.fetch

/** Podstawiony fetch: zapisuje zadanie i oddaje ustalona odpowiedz. */
function stubFetch(res: Response): void {
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const form = init?.body as FormData
    sent = {
      url: String(input),
      headers: init?.headers as Record<string, string>,
      // Plik zapisujemy jako nazwe typu — liczy sie kolejnosc i nazwy pol.
      fields: [...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : 'file'])
    }
    return Promise.resolve(res)
  }
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

/** Wynik jako fakty — to samo, co zobaczyloby dyktowanie w `catch`. */
async function failureOf(run: Promise<unknown>): Promise<Failure> {
  try {
    await run
    throw new Error('mialo rzucic')
  } catch (err) {
    return toFailure(err)
  }
}

afterEach(() => {
  globalThis.fetch = realFetch
  sent = null
})

suite('wspolne zadanie', () => {
  it('oddaje tekst z odpowiedzi', async () => {
    stubFetch(ok({ text: 'Dzien dobry' }))
    expect(await transcribe('openai', WAV, OPTS)).toBe('Dzien dobry')
  })

  it('rzuca, gdy odpowiedz nie ma pola z transkrypcja', async () => {
    stubFetch(ok({ result: 'Dzien dobry' }))
    expect(await failureOf(transcribe('openai', WAV, OPTS))).toEqual({
      kind: 'provider-response'
    })
  })

  for (const status of [401, 404, 413, 429, 500, 503]) {
    it(`zglasza HTTP ${status} z cala odpowiedzia`, async () => {
      stubFetch(new Response('tresc bledu', { status }))
      expect(await failureOf(transcribe('xai', WAV, OPTS))).toEqual({
        kind: 'provider-http',
        status,
        body: 'tresc bledu'
      })
    })
  }
})

interface Case {
  provider: ProviderId
  url: string
  header: string
  auth: string
  /** Pola w kolejnosci, jakiej wymaga dostawca. */
  fields: string[]
  /** Pola przy jezyku Auto, czyli bez `language` w opcjach. */
  withoutLanguage: string[]
}

const CASES: Case[] = [
  {
    provider: 'xai',
    url: 'https://api.x.ai/v1/stt',
    header: 'Authorization',
    auth: 'Bearer klucz',
    // `file` musi byc ostatnie, a pola `model` nie ma wcale.
    fields: ['language', 'format', 'file'],
    withoutLanguage: ['file']
  },
  {
    provider: 'openai',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    header: 'Authorization',
    auth: 'Bearer klucz',
    fields: ['file', 'model', 'response_format', 'language'],
    withoutLanguage: ['file', 'model', 'response_format']
  },
  {
    provider: 'elevenlabs',
    url: 'https://api.elevenlabs.io/v1/speech-to-text',
    header: 'xi-api-key',
    auth: 'klucz',
    fields: ['file', 'model_id', 'tag_audio_events', 'timestamps_granularity', 'language_code'],
    withoutLanguage: ['file', 'model_id', 'tag_audio_events', 'timestamps_granularity']
  }
]

suite('opisy dostawcow', () => {
  for (const c of CASES) {
    it(`${c.provider}: adres, naglowek klucza i kolejnosc pol`, async () => {
      stubFetch(ok({ text: '' }))
      await transcribe(c.provider, WAV, OPTS)
      expect(sent?.url).toBe(c.url)
      expect(sent?.headers).toEqual({ [c.header]: c.auth })
      expect(sent?.fields.map(([name]) => name)).toEqual(c.fields)
    })

    it(`${c.provider}: bez jezyka nie wysyla pol jezyka`, async () => {
      stubFetch(ok({ text: '' }))
      await transcribe(c.provider, WAV, { apiKey: 'klucz', model: 'model-x' })
      expect(sent?.fields.map(([name]) => name)).toEqual(c.withoutLanguage)
    })
  }

  it('xai: jezyk wlacza interpunkcje', async () => {
    stubFetch(ok({ text: '' }))
    await transcribe('xai', WAV, OPTS)
    expect(sent?.fields).toContainEqual(['format', 'true'])
    expect(sent?.fields).toContainEqual(['language', 'pl'])
  })

  it('openai: format odpowiedzi zawsze json, model z opcji', async () => {
    stubFetch(ok({ text: '' }))
    await transcribe('openai', WAV, OPTS)
    expect(sent?.fields).toContainEqual(['response_format', 'json'])
    expect(sent?.fields).toContainEqual(['model', 'model-x'])
  })

  it('elevenlabs: znaczniki dzwiekow i znaczniki czasu wylaczone', async () => {
    stubFetch(ok({ text: '' }))
    await transcribe('elevenlabs', WAV, OPTS)
    expect(sent?.fields).toContainEqual(['tag_audio_events', 'false'])
    expect(sent?.fields).toContainEqual(['timestamps_granularity', 'none'])
    expect(sent?.fields).toContainEqual(['language_code', 'pl'])
  })
})
