import { afterEach, describe as suite, expect, it, vi } from 'vitest'
import { refine } from '../src/main/refine.js'
import type { RefineOptions } from '../src/main/refine.js'

afterEach(() => vi.unstubAllGlobals())

const CHAT = 'https://openrouter.ai/api/v1/chat/completions'
const DECISIONS = 'https://openrouter.ai/api/alpha/decisions'

interface Calls {
  chat: number
  jev: number
}

/**
 * Dwa punkty sieciowe sciezki korekty. Test nie oglada zadan — liczy je i odpowiada
 * tak, jak odpowiedzialby OpenRouter.
 */
function stub(handlers: {
  chat: (prompt: string) => Response | Promise<Response>
  jev?: (body: string) => Response | Promise<Response>
}): Calls {
  const calls: Calls = { chat: 0, jev: 0 }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const body = init.body as string
      if (url === CHAT) {
        calls.chat++
        return Promise.resolve(handlers.chat(prompt(body)))
      }
      if (url === DECISIONS) {
        calls.jev++
        return Promise.resolve((handlers.jev ?? ((b: string) => noul(b, 0.99)))(body))
      }
      throw new Error(`nieoczekiwany URL: ${url}`)
    })
  )
  return calls
}

/** Tekst, ktory dostal korektor. Stad wiadomo, czy zamiany poszly przed nim. */
function prompt(body: string): string {
  const sent = JSON.parse(body) as { messages: { role: string; content: string }[] }
  return sent.messages[1].content
}

function candidate(text: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text }) } }] })
  )
}

/** Odpowiedz JEV na klucz, o ktory zapytano. `model: null` = odpowiedz bez pola `model`. */
function noul(body: string, value: number, model: string | null = 'typesafe/jev-1.13'): Response {
  const asked = JSON.parse(body) as { questions: Record<string, unknown> }
  const key = Object.keys(asked.questions)[0]
  return new Response(
    JSON.stringify({
      ...(model ? { model } : {}),
      answers: { [key]: { type: 'noul', noul: value } }
    })
  )
}

function opts(over: Partial<RefineOptions> = {}): RefineOptions {
  return {
    correction: true,
    apiKey: 'sk-or-test',
    model: 'openai/gpt-4o-mini',
    vocabulary: [],
    replacements: [],
    ...over
  }
}

const RAW = 'no to zrobmy to jutro'
const FIXED = 'No to zrobmy to jutro.'
const rule = { from: 'kursor', to: 'Cursor' }

suite('korekta przyjeta albo zawetowana', () => {
  it('powyzej progu wkleja poprawiony tekst', async () => {
    const calls = stub({ chat: () => candidate(FIXED), jev: (b) => noul(b, 0.92) })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(FIXED)
    expect(result.log).toEqual({
      status: 'applied',
      noul: 0.92,
      model: 'typesafe/jev-1.13',
      ms: expect.any(Number)
    })
    expect(calls).toEqual({ chat: 1, jev: 1 })
  })

  it('ponizej progu wkleja tekst sprzed korekty', async () => {
    const calls = stub({
      chat: () => candidate('Jutro nic nie robimy.'),
      jev: (b) => noul(b, 0.31)
    })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({
      status: 'vetoed',
      by: 'jev',
      noul: 0.31,
      model: 'typesafe/jev-1.13'
    })
    expect(calls).toEqual({ chat: 1, jev: 1 })
  })

  it('kandydat identyczny z tekstem nie idzie do JEV', async () => {
    const calls = stub({ chat: (sent) => candidate(sent) })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({ status: 'unchanged' })
    expect(calls).toEqual({ chat: 1, jev: 0 })
  })
})

suite('gwarancje sprawdzane bez pytania JEV', () => {
  const dropped: { what: string; text: string; answer: string; vocabulary: string[] }[] = [
    {
      what: 'URL',
      text: 'wejdz na https://example.com/raport teraz',
      answer: 'Wejdz tam teraz.',
      vocabulary: []
    },
    { what: 'liczbe', text: 'mamy 15 minut', answer: 'Mamy pietnascie minut.', vocabulary: [] },
    {
      what: 'termin ze slownika',
      text: 'mamy jeszcze LiteLLM',
      answer: 'Mamy jeszcze Light LLM.',
      vocabulary: ['LiteLLM']
    }
  ]

  it.each(dropped)('kandydat, ktory gubi $what, przepada zanim JEV odpowie', async (entry) => {
    const { text, answer, vocabulary } = entry
    const calls = stub({ chat: () => candidate(answer) })

    const result = await refine(text, opts({ vocabulary }))

    expect(result.text).toBe(text)
    expect(result.log).toMatchObject({ status: 'vetoed', by: 'guard' })
    expect(calls).toEqual({ chat: 1, jev: 0 })
  })

  it('samo skrocenie tekstu nie jest juz powodem odrzucenia', async () => {
    const long = 'no wiec yyy chcialbym zeby to bylo zrobione jutro rano, tak myslę'
    stub({ chat: () => candidate('Chce to jutro rano.'), jev: (b) => noul(b, 0.85) })

    const result = await refine(long, opts())

    expect(result.text).toBe('Chce to jutro rano.')
  })

  it('polaczenie zdan, ktore zmienia wielkosc litery, dochodzi do JEV', async () => {
    const two = 'Zrob to jutro. Moze byc rano'
    const merged = 'Zrob to jutro, moze byc rano.'
    const calls = stub({ chat: () => candidate(merged), jev: (b) => noul(b, 0.88) })

    const result = await refine(two, opts())

    expect(result.text).toBe(merged)
    expect(calls.jev).toBe(1)
  })
})

suite('awaria zostawia tekst deterministyczny', () => {
  const timeout = (): Promise<Response> =>
    Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))

  it('JEV nie zdazyl', async () => {
    stub({ chat: () => candidate(FIXED), jev: timeout })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({ status: 'unavailable', stage: 'verify', reason: 'TimeoutError' })
  })

  it('JEV odpowiedzial 500', async () => {
    stub({ chat: () => candidate(FIXED), jev: () => new Response('boom', { status: 500 }) })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toMatchObject({ status: 'unavailable', stage: 'verify' })
  })

  it('odpowiedz JEV bez pola model nadal decyduje', async () => {
    stub({ chat: () => candidate(FIXED), jev: (b) => noul(b, 0.95, null) })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(FIXED)
    expect(result.log).toEqual({
      status: 'applied',
      noul: 0.95,
      model: null,
      ms: expect.any(Number)
    })
  })

  it('odpowiedz JEV bez noula zostawia tekst sprzed korekty', async () => {
    stub({
      chat: () => candidate(FIXED),
      jev: () => new Response(JSON.stringify({ model: 'typesafe/jev-1.13', answers: {} }))
    })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({
      status: 'unavailable',
      stage: 'verify',
      reason: 'OpenRouter: zla odpowiedz'
    })
  })

  it('puste pole modelu nie wychodzi w siec', async () => {
    const calls = stub({ chat: () => candidate(FIXED) })

    const result = await refine(RAW, opts({ model: '  ' }))

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({ status: 'unavailable', stage: 'correct', reason: 'brak modelu' })
    expect(calls).toEqual({ chat: 0, jev: 0 })
  })

  it('korektor oddal pusty tekst', async () => {
    const calls = stub({ chat: () => candidate('') })

    const result = await refine(RAW, opts())

    expect(result.text).toBe(RAW)
    expect(result.log).toEqual({ status: 'unavailable', stage: 'correct', reason: 'pusty tekst' })
    expect(calls.jev).toBe(0)
  })

  it('korektor odpowiedzial 500', async () => {
    const calls = stub({ chat: () => new Response('boom', { status: 500 }) })

    const result = await refine('jak to robi kursor', opts({ replacements: [rule] }))

    expect(result.text).toBe('jak to robi Cursor')
    expect(result.log).toEqual({ status: 'unavailable', stage: 'correct', reason: 'HTTP 500' })
    expect(calls.jev).toBe(0)
  })

  it('korektor nie zdazyl', async () => {
    const calls = stub({ chat: timeout })

    const result = await refine('jak to robi kursor', opts({ replacements: [rule] }))

    expect(result.text).toBe('jak to robi Cursor')
    expect(result.log).toEqual({ status: 'unavailable', stage: 'correct', reason: 'TimeoutError' })
    expect(calls.jev).toBe(0)
  })

  it('brak klucza OpenRouter nie wywraca dyktowania', async () => {
    const calls = stub({ chat: () => candidate(FIXED) })

    const result = await refine('jak to robi kursor', opts({ apiKey: null, replacements: [rule] }))

    expect(result.text).toBe('jak to robi Cursor')
    expect(result.log).toEqual({ status: 'unavailable', stage: 'correct', reason: 'brak klucza' })
    expect(calls).toEqual({ chat: 0, jev: 0 })
  })
})

suite('zamiany wokol korekty', () => {
  it('idzie do korektora po zamianach i wraca przez nie drugi raz', async () => {
    // Korektor oddaje to, co dostal, i dokłada nowe wystapienie terminu.
    const calls = stub({
      chat: (sent) => candidate(`${sent} i znowu kursor`),
      jev: (b) => noul(b, 0.9)
    })

    const result = await refine('jak to robi kursor', opts({ replacements: [rule] }))

    expect(result.text).toBe('jak to robi Cursor i znowu Cursor')
    expect(calls).toEqual({ chat: 1, jev: 1 })
  })

  it('wylaczona korekta nie wysyla zadnego zadania', async () => {
    const calls = stub({ chat: () => candidate(FIXED) })

    const result = await refine(
      'jak to robi kursor',
      opts({ correction: false, replacements: [rule] })
    )

    expect(result.text).toBe('jak to robi Cursor')
    expect(result.log).toEqual({ status: 'off' })
    expect(calls).toEqual({ chat: 0, jev: 0 })
  })
})
