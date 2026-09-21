import { appendLine } from './transcripts.js'

type Verdict = 'good' | 'bad'

let hasLastDictation = false

export function rememberLastDictation(): void {
  hasLastDictation = true
}

/** Lokalny sygnal do pozniejszej poprawy klasyfikacji, bez tresci dyktowania. */
export function markLastDictation(verdict: Verdict): void {
  if (!hasLastDictation) return
  appendLine(`${JSON.stringify({ t: new Date().toISOString(), kind: 'feedback', verdict })}\n`)
}
