import { FailureError } from '../../shared/failure.js'
import { PROVIDERS } from '../../shared/providers.js'
import type { ProviderId } from '../../shared/types.js'
import type { Message } from './prompt.js'

/**
 * Opis dostawcy czatu — adres, model, ksztalt zadania i miejsce, w ktorym siedzi
 * odpowiedz. Ten sam podzial co przy transkrypcji: tu roznice miedzy dostawcami,
 * w `send()` jeden wspolny kod bez `if` po nazwie.
 *
 * Klucz jest ten sam co do STT — korekta nie dodaje pola w ustawieniach.
 */
export interface ChatSpec {
  id: ProviderId
  url: string
  model: string
  auth: { header: string; prefix?: string }
  body(messages: readonly Message[], maxTokens: number): unknown
  read(json: unknown): string | null
}

const SPECS: readonly ChatSpec[] = [
  {
    id: 'xai',
    url: 'https://api.x.ai/v1/chat/completions',
    // Deklaruje `reasoning: No`, wiec nie ma nieprzewidywalnej latencji rozumowania.
    // Nie brac `grok-4.5`: domyslny effort `high`, rozumowania nie da sie wylaczyc.
    model: 'grok-4.20-0309-non-reasoning',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    body: (messages, maxTokens) => ({
      model: 'grok-4.20-0309-non-reasoning',
      messages,
      temperature: 0,
      top_p: 1,
      max_tokens: maxTokens
    }),
    read: (json) => {
      const res = json as { choices?: { message?: { content?: unknown } }[] }
      const content = res.choices?.[0]?.message?.content
      return typeof content === 'string' ? content : null
    }
  },
  {
    id: 'openai',
    // gpt-5.x idzie przez /v1/responses, nie /v1/chat/completions.
    url: 'https://api.openai.com/v1/responses',
    model: 'gpt-5.6-luna',
    auth: { header: 'Authorization', prefix: 'Bearer ' },
    body: (messages, maxTokens) => ({
      model: 'gpt-5.6-luna',
      input: messages,
      // Dokumentacja sama nazywa `none` punktem odniesienia dla latencji.
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
      // Bez `temperature`: ticket 01 zostawil jako otwarte pytanie, czy GPT-5.6 je
      // przyjmuje na `/v1/responses`. Nieznany parametr to 400 przy **kazdej** korekcie,
      // a `effort: none` i tak zbija losowosc. Dolozyc, gdy sie potwierdzi.
      max_output_tokens: maxTokens
    }),
    read: (json) => {
      const res = json as { output?: { content?: { type?: string; text?: unknown }[] }[] }
      for (const item of res.output ?? []) {
        for (const part of item.content ?? []) {
          if (part.type === 'output_text' && typeof part.text === 'string') return part.text
        }
      }
      return null
    }
  }
]

/** `null` = dostawca nie ma ogolnego API czatu (ElevenLabs). */
export function chatSpecFor(id: ProviderId): ChatSpec | null {
  return SPECS.find((s) => s.id === id) ?? null
}

/**
 * Kto poprawia. Najpierw dostawca STT — to ten sam host, wiec polaczenie z zapytania
 * o transkrypcje jest jeszcze cieple. Gdy dostawca czatu nie ma (ElevenLabs), szukamy
 * pierwszego innego z zapisanym kluczem, w kolejnosci katalogu.
 */
export function pickCorrector(
  stt: ProviderId,
  hasKey: (provider: ProviderId) => boolean
): ChatSpec | null {
  const own = chatSpecFor(stt)
  if (own && hasKey(own.id)) return own
  for (const provider of PROVIDERS) {
    const spec = chatSpecFor(provider.id)
    if (spec && hasKey(spec.id)) return spec
  }
  return null
}

export interface SendOptions {
  apiKey: string
  messages: readonly Message[]
  maxTokens: number
  signal: AbortSignal
}

export async function send(spec: ChatSpec, opts: SendOptions): Promise<string> {
  const res = await fetch(spec.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [spec.auth.header]: `${spec.auth.prefix ?? ''}${opts.apiKey}`
    },
    body: JSON.stringify(spec.body(opts.messages, opts.maxTokens)),
    signal: opts.signal
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new FailureError({ kind: 'provider-http', status: res.status, body: text })
  }
  const text = spec.read(await res.json())
  if (text === null) throw new FailureError({ kind: 'provider-response' })
  return text
}

/**
 * Rozgrzewka polaczenia przy wcisnieciu skrotu, rownolegle z nagrywaniem. Zero danych.
 *
 * Uwaga na zasieg: dla dostawcy, ktory robi i STT, i korekte (przypadek domyslny),
 * polaczenie i tak jest cieple po zapytaniu o transkrypcje — ten sam host. Rozgrzewka
 * ratuje przypadek zapasowy, gdy korekte robi **inny** dostawca niz STT. Domyslny
 * dyspozytor Node trzyma polaczenie ~4 s bez ruchu, a mediana mowienia to 16,6 s,
 * wiec przy dlugim dyktowaniu i tak wygasnie — pelna kontrola wymaga wlasnej instancji
 * `undici.Agent` i to jest osobna zmiana, nie ta.
 */
export function warm(spec: ChatSpec | null): void {
  if (!spec) return
  const origin = new URL(spec.url).origin
  // Bledy sa bez znaczenia — to tylko uzgodnienie TCP i TLS.
  void fetch(origin, { method: 'HEAD', signal: AbortSignal.timeout(2000) }).catch(() => {})
}
