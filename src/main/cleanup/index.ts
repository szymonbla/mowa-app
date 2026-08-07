import { toFailure } from '../../shared/failure.js'
import type { Failure } from '../../shared/failure.js'
import type { ProviderId } from '../../shared/types.js'
import { pickCorrector, send, warm } from './chat.js'
import type { ChatSpec, SendOptions } from './chat.js'
import { guard } from './guard.js'
import { messages } from './prompt.js'
import { budgetMs, MAX_WORDS, maxOutputTokens, stripFillers, wordCount } from './text.js'

/**
 * Wynik korekty. Trzy stany, bo trzy roznie wygladaja dla uzytkownika:
 * poprawione, **pominiete** (wiadomo przed wyslaniem, nikt na nic nie czekal)
 * i **nieudane** (wiadomo po fakcie, uzytkownik czekal na darmo).
 * W dwoch ostatnich wkleja sie tekst surowy — zawsze.
 */
export type Correction =
  | { kind: 'corrected'; text: string }
  | { kind: 'skipped'; reason: SkipReason }
  | { kind: 'failed'; failure: Failure }

/** 'nothing' = po wycieciu wypelniaczy nie zostalo nic do poprawiania. */
export type SkipReason = 'too-long' | 'no-corrector' | 'nothing'

export interface CorrectorDeps {
  /** Dostawca STT z ustawien — pierwszy kandydat na korektora. */
  provider(): ProviderId
  apiKey(provider: ProviderId): string | null
  /**
   * Slownik wlasny. Faza 1 zwraca pusta liste; slot istnieje od poczatku, zeby
   * faza 2 byla wypelnieniem miejsca, a nie przeprojektowaniem.
   */
  dictionary?(): readonly string[]
  /** Szew do testow — realna implementacja siedzi w `chat.ts`. */
  send?(spec: ChatSpec, opts: SendOptions): Promise<string>
}

export interface Corrector {
  correct(text: string, speechMs: number): Promise<Correction>
  /** Wolane przy wcisnieciu skrotu, rownolegle z nagrywaniem. */
  warm(): void
}

export function createCorrector(deps: CorrectorDeps): Corrector {
  const transport = deps.send ?? send
  const hasKey = (provider: ProviderId): boolean => Boolean(deps.apiKey(provider))
  const spec = (): ChatSpec | null => pickCorrector(deps.provider(), hasKey)

  async function correct(text: string, speechMs: number): Promise<Correction> {
    // Prog jest znany **przed** wyslaniem, wiec jego przekroczenie nie kosztuje
    // ani sekundy czekania. Dlatego to pominiecie, a nie awaria.
    if (wordCount(text) > MAX_WORDS) return { kind: 'skipped', reason: 'too-long' }

    const chat = spec()
    if (!chat) return { kind: 'skipped', reason: 'no-corrector' }
    const apiKey = deps.apiKey(chat.id)
    if (!apiKey) return { kind: 'skipped', reason: 'no-corrector' }

    // Wypelniacze wycina lokalny regex, zanim cokolwiek pojdzie do modelu:
    // deterministycznie, za darmo i o jedna rzecz mniej, na ktorej model moze
    // przepisac tekst. Straz porownuje wyjscie wlasnie z tym tekstem.
    const cleaned = stripFillers(text)
    if (!cleaned) return { kind: 'skipped', reason: 'nothing' }

    const controller = new AbortController()
    // `AbortController` na calej sciezce, nie sam `setTimeout` — inaczej zadanie
    // leci dalej po uplywie budzetu i moze wrocic, gdy surowy tekst juz sie wkleil.
    const stop = setTimeout(() => controller.abort(), budgetMs(speechMs))
    try {
      const raw = await transport(chat, {
        apiKey,
        messages: messages(cleaned, deps.dictionary?.() ?? []),
        maxTokens: maxOutputTokens(cleaned),
        signal: controller.signal
      })
      const verdict = guard(cleaned, raw)
      if (!verdict.ok) return failed('guard', verdict.layer)
      return { kind: 'corrected', text: verdict.text }
    } catch (err) {
      if (controller.signal.aborted) return failed('budget', `${Math.round(budgetMs(speechMs))} ms`)
      return failed(...reason(err))
    } finally {
      clearTimeout(stop)
    }
  }

  return { correct, warm: () => warm(spec()) }
}

function failed(reason: 'budget' | 'guard' | 'provider' | 'network', detail: string): Correction {
  return { kind: 'failed', failure: { kind: 'cleanup', reason, detail } }
}

/**
 * Kazda awaria czatu wychodzi jako `cleanup`, nigdy jako `provider-http`. To nie jest
 * kosmetyka: klucz xAI ma zakres ACL, wiec waski klucz potrafi przejsc przy STT
 * i polec 401 przy czacie. Gdyby ten 401 wyszedl na wierzch, zapalilby czerwona
 * lampke przy kluczu, ktory dziala.
 */
function reason(err: unknown): ['provider' | 'network', string] {
  const failure = toFailure(err)
  if (failure.kind === 'provider-http') return ['provider', `HTTP ${failure.status}`]
  if (failure.kind === 'network') return ['network', failure.detail ?? '']
  if (failure.kind === 'provider-response') return ['provider', 'brak tekstu w odpowiedzi']
  return ['provider', failure.kind === 'unknown' ? (failure.detail ?? '') : failure.kind]
}
