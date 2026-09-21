import { askNoul } from './decisions.js'
import type { NoulQuestion } from './decisions.js'

const URL = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 1500
/**
 * Prog przyjecia korekty. Nieskalibrowany — liczbe ustala pytanie otwarte w
 * `specs/jev-decisions/README.md`, na korpusie, nie na wyczuciu.
 */
const ACCEPT_NOUL = 0.7

/**
 * Co sie stalo z tekstem miedzy STT a wklejeniem. `noul` istnieje tylko w wariantach,
 * w ktorych JEV naprawde odpowiedzial.
 */
export type CorrectionLog =
  | { status: 'off' }
  | { status: 'unchanged' }
  | { status: 'applied'; noul: number; model: string | null; ms: number }
  | { status: 'vetoed'; by: 'guard'; reason: string }
  | { status: 'vetoed'; by: 'jev'; noul: number; model: string | null }
  | { status: 'unavailable'; stage: 'correct' | 'verify'; reason: string }

export interface CorrectionResult {
  text: string
  log: CorrectionLog
}

interface Options {
  apiKey: string
  model: string
  vocabulary: readonly string[]
}

/** Kandydat od modelu albo powod, dla ktorego go nie ma. */
type Proposal = { ok: true; candidate: string } | { ok: false; reason: string }

export async function correctText(text: string, options: Options): Promise<CorrectionResult> {
  const proposal = await propose(text, options)
  if (!proposal.ok) {
    return { text, log: { status: 'unavailable', stage: 'correct', reason: proposal.reason } }
  }
  const { candidate } = proposal
  // Korekta, ktora niczego nie zmienila, nie ma czego weryfikowac. JEV nie widzi jej wcale.
  if (candidate === text) return { text, log: { status: 'unchanged' } }

  const reason = rejectReason(text, candidate, options.vocabulary)
  if (reason) return { text, log: { status: 'vetoed', by: 'guard', reason } }

  const started = Date.now()
  try {
    const { noul, model } = await askNoul(preservesMeaning(text, candidate), options.apiKey)
    return noul >= ACCEPT_NOUL
      ? { text: candidate, log: { status: 'applied', noul, model, ms: Date.now() - started } }
      : { text, log: { status: 'vetoed', by: 'jev', noul, model } }
  } catch (err) {
    return { text, log: { status: 'unavailable', stage: 'verify', reason: failureReason(err) } }
  }
}

async function propose(text: string, options: Options): Promise<Proposal> {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        messages: [
          { role: 'system', content: instruction(options.vocabulary) },
          { role: 'user', content: text }
        ]
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` }
    const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string') return { ok: false, reason: 'brak tekstu' }
    const candidate = parseText(content)
    return candidate ? { ok: true, candidate } : { ok: false, reason: 'pusty tekst' }
  } catch (err) {
    return { ok: false, reason: failureReason(err) }
  }
}

function instruction(vocabulary: readonly string[]): string {
  const terms = vocabulary.length
    ? `Chronione terminy: ${vocabulary.join(', ')}.`
    : 'Brak chronionych terminow.'
  return [
    'Popraw tylko interpunkcje, oczywiste bledy rozpoznawania mowy i pisownie.',
    'Nie zmieniaj sensu, nie streszczaj, nie dodawaj informacji.',
    'Zachowaj liczby, URL-e, adresy e-mail, sciezki, identyfikatory i nazwy wlasne.',
    terms,
    'Odpowiedz wylacznie JSON-em: {"text":"..."}.'
  ].join(' ')
}

function parseText(content: string): string {
  const parsed = JSON.parse(content) as { text?: unknown }
  if (typeof parsed.text !== 'string') throw new Error('zly JSON')
  return parsed.text.trim()
}

function preservesMeaning(original: string, candidate: string): NoulQuestion {
  return {
    state: {
      description: 'A dictated transcript and one corrected candidate for the same utterance.',
      records: [
        { id: 'original', record: original },
        { id: 'candidate', record: candidate }
      ]
    },
    instructions:
      'Decide whether candidate preserves the meaning, facts and terms of original. Punctuation, casing, spelling and removed disfluencies are expected corrections. Polish mixed with English technical terms is normal.',
    criteria:
      'The probability that candidate says the same thing as original: no changed or invented facts, numbers, names or technical terms, and nothing dropped.'
  }
}

/**
 * Gwarancje, nie oceny. Te fragmenty musza przezyc korekte co do znaku; o sens pyta dopiero JEV.
 */
function rejectReason(
  original: string,
  candidate: string,
  vocabulary: readonly string[]
): string | null {
  for (const token of protectedTokens(original, vocabulary)) {
    if (!candidate.includes(token)) return `brak chronionego fragmentu: ${token.slice(0, 32)}`
  }
  return null
}

function protectedTokens(text: string, vocabulary: readonly string[]): string[] {
  const found =
    text.match(
      /https?:\/\/\S+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?:~\/|\/)[^\s]+|\b\d+(?:[.,]\d+)?\b/g
    ) ?? []
  return [...new Set([...found, ...vocabulary.filter((term) => text.includes(term))])]
}

/** W logu ma zostac nazwa awarii — 'TimeoutError' czyta sie lepiej niz zdanie od fetcha. */
function failureReason(err: unknown): string {
  if (!(err instanceof Error)) return 'blad'
  return err.name === 'Error' ? err.message.slice(0, 120) : err.name
}
