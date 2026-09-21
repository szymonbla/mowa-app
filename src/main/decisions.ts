/**
 * Klient Decisions OpenRoutera. Jedno pytanie, jedna liczba, twardy limit czasu — odpowiedz,
 * ktora nie zdazyla, nie ma prawa opoznic wklejenia.
 */

const MODEL = '~typesafe/jev-latest'
const URL = 'https://openrouter.ai/api/alpha/decisions'
const TIMEOUT_MS = 700
/** Klucz pytania. Wraca w odpowiedzi, wiec musi byc ten sam po obu stronach. */
const ANSWER = 'answer'

export interface Noul {
  noul: number
  /**
   * Model z odpowiedzi, nie z zapytania: `~typesafe/jev-latest` to alias, ktory sie przesuwa.
   * `null`, gdy endpoint go nie poda — to brak telemetrii, nie brak decyzji.
   */
  model: string | null
}

export interface NoulQuestion {
  /** Dane, o ktore pytamy. Zostaja trescia, nie instrukcja. */
  state: { description: string; records: { id: string; record: string }[] }
  instructions: string
  criteria: string
}

export async function askNoul(question: NoulQuestion, apiKey: string): Promise<Noul> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: question.state,
      questions: {
        [ANSWER]: {
          type: 'noul',
          instructions: question.instructions,
          criteria: question.criteria
        }
      }
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`OpenRouter HTTP ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`)
  }
  const json = (await res.json()) as {
    model?: unknown
    answers?: Record<string, { type?: unknown; noul?: unknown } | undefined>
  }
  const answer = json.answers?.[ANSWER]
  if (answer?.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) {
    throw new Error('OpenRouter: zla odpowiedz')
  }
  return { noul: answer.noul, model: typeof json.model === 'string' ? json.model : null }
}
