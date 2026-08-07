import { describe as suite, expect, it, vi } from 'vitest'
import { createCorrector } from '../src/main/cleanup/index.js'
import type { Correction } from '../src/main/cleanup/index.js'
import { pickCorrector } from '../src/main/cleanup/chat.js'
import { messages, systemPrompt } from '../src/main/cleanup/prompt.js'
import { FailureError } from '../src/shared/failure.js'
import type { ProviderId } from '../src/shared/types.js'

interface Options {
  provider?: ProviderId
  keys?: ProviderId[]
  reply?: (text: string, signal: AbortSignal) => Promise<string>
  dictionary?: string[]
}

function corrector(opts: Options = {}) {
  const keys = new Set<ProviderId>(opts.keys ?? ['xai'])
  const sent: string[] = []
  const instance = createCorrector({
    provider: () => opts.provider ?? 'xai',
    apiKey: (p) => (keys.has(p) ? 'sk-test' : null),
    dictionary: () => opts.dictionary ?? [],
    send: async (_spec, o) => {
      const last = o.messages[o.messages.length - 1].content
      sent.push(last)
      return opts.reply ? opts.reply(last, o.signal) : 'Dzień dobry.'
    }
  })
  return { instance, sent }
}

suite('wybor korektora', () => {
  const has = (list: ProviderId[]) => (p: ProviderId) => list.includes(p)

  it('bierze dostawce STT, gdy ma czat i klucz', () => {
    expect(pickCorrector('xai', has(['xai', 'openai']))?.id).toBe('xai')
  })

  it('szuka zapasowego, gdy dostawca STT nie ma czatu', () => {
    // ElevenLabs nie ma ogolnego API LLM — zalozenie "ten sam dostawca" tu peka.
    expect(pickCorrector('elevenlabs', has(['elevenlabs', 'openai']))?.id).toBe('openai')
  })

  it('nie znajduje nikogo, gdy zaden klucz do czatu nie istnieje', () => {
    expect(pickCorrector('elevenlabs', has(['elevenlabs']))).toBeNull()
  })
})

suite('pominiecie', () => {
  it('nie startuje powyzej progu dlugosci', async () => {
    const { instance, sent } = corrector()
    const long = 'slowo '.repeat(151)
    // Wiadomo **przed** wyslaniem, wiec uzytkownik nie czeka ani chwili.
    await expect(instance.correct(long, 90_000)).resolves.toEqual({
      kind: 'skipped',
      reason: 'too-long'
    })
    expect(sent).toHaveLength(0)
  })

  it('startuje przy dyktowaniu krotszym niz dziesiec slow', async () => {
    // Dolnego progu nie ma — cwierc realnych dyktowan miesci sie ponizej 10 slow.
    const { instance, sent } = corrector({ reply: async () => 'Tak jest.' })
    const out = await instance.correct('tak jest', 2000)
    expect(out.kind).toBe('corrected')
    expect(sent).toHaveLength(1)
  })

  it('nie wysyla nic, gdy nie ma klucza do zadnego czatu', async () => {
    const { instance, sent } = corrector({ provider: 'elevenlabs', keys: ['elevenlabs'] })
    await expect(instance.correct('cokolwiek', 2000)).resolves.toEqual({
      kind: 'skipped',
      reason: 'no-corrector'
    })
    expect(sent).toHaveLength(0)
  })

  it('nie wysyla samego wahania', async () => {
    const { instance, sent } = corrector()
    await expect(instance.correct('yyy eee', 1200)).resolves.toEqual({
      kind: 'skipped',
      reason: 'nothing'
    })
    expect(sent).toHaveLength(0)
  })
})

suite('budzet', () => {
  it('przerywa zadanie, ktore nie zmiescilo sie w czasie', async () => {
    vi.useFakeTimers()
    try {
      const { instance } = corrector({
        reply: (_text, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason))
          })
      })
      const pending = instance.correct('krotkie zdanie do poprawy', 2000)
      await vi.advanceTimersByTimeAsync(1600)
      const out = (await pending) as Extract<Correction, { kind: 'failed' }>
      expect(out.kind).toBe('failed')
      expect(out.failure).toMatchObject({ kind: 'cleanup', reason: 'budget' })
    } finally {
      vi.useRealTimers()
    }
  })
})

suite('awaria', () => {
  it('nie wypuszcza 401 z czatu jako odrzucenia klucza', async () => {
    // Klucz xAI ma zakres ACL: waski klucz przechodzi przy STT i pada przy czacie.
    // Gdyby ten 401 wyszedl na wierzch, zapalilby lampke przy dzialajacym kluczu.
    const { instance } = corrector({
      reply: async () => {
        throw new FailureError({ kind: 'provider-http', status: 401, body: 'no acl' })
      }
    })
    const out = (await instance.correct('zdanie do poprawy', 2000)) as Extract<
      Correction,
      { kind: 'failed' }
    >
    expect(out.failure).toMatchObject({ kind: 'cleanup', reason: 'provider' })
  })

  it('zglasza odrzucenie przez straz jako awarie korekty', async () => {
    const { instance } = corrector({
      reply: async () => 'Zupełnie inne zdanie o czymś innym, napisane od nowa.'
    })
    const out = (await instance.correct('tak jest zrobione', 2000)) as Extract<
      Correction,
      { kind: 'failed' }
    >
    expect(out.failure).toMatchObject({ kind: 'cleanup', reason: 'guard' })
  })
})

suite('prompt', () => {
  it('otacza wejscie ogranicznikiem i nie wysyla wypelniaczy', async () => {
    const { instance, sent } = corrector({ reply: async () => 'Trzeba to zrobić.' })
    await instance.correct('yyy trzeba to zrobic', 2000)
    expect(sent[0]).toContain('<<<TEKST')
    expect(sent[0]).toContain('trzeba to zrobic')
    expect(sent[0]).not.toContain('yyy')
  })

  it('pusty slownik mowi wprost, ze nie ma czego podstawiac', () => {
    expect(systemPrompt([])).toContain('SŁOWNIK WŁASNY: pusty')
    expect(systemPrompt([])).toContain('nie wolno')
  })

  it('slownik wchodzi w gotowy slot, bez zmiany reszty promptu', () => {
    const filled = systemPrompt(['Havenfort', 'Anvero'])
    expect(filled).toContain('- Havenfort')
    expect(filled).toContain('jedyny')
  })

  it('daje modelowi tylko poprawne przyklady, w tym jeden bez zmiany', () => {
    const list = messages('cokolwiek')
    const noop = list.find((m) => m.role === 'assistant' && m.content === 'ok')
    expect(noop).toBeDefined()
    expect(list[0].role).toBe('system')
    expect(list[list.length - 1].content).toContain('cokolwiek')
  })
})
