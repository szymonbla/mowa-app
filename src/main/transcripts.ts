import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { appendFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Correction } from './cleanup/index.js'
import type { GuardLayer } from './cleanup/guard.js'
import { wordCount } from './cleanup/text.js'
import type { LanguageId, ProviderId } from '../shared/types.js'

/**
 * Log transkryptow. Istnieje **wylacznie** po to, zeby powstal zestaw oceny korekty —
 * nie jest zrodlem odzyskiwania, bo tym jest zmienna w pamieci procesu glownego.
 * Skutek jest celowy: skoro nic od tego pliku nie zalezy, wolno go wylaczyc,
 * wyczyscic i skasowac bez psucia jakiejkolwiek funkcji.
 *
 * Zapis lezy **poza sciezka krytyczna**: nie jest oczekiwany, nie ma wariantu
 * `Failure` i nie zatrzymuje wklejenia. Cena tego jest znana i przyjeta — cichy,
 * martwy log poznac dopiero przy zbieraniu materialu.
 */

/**
 * Katalog wlasny, nie `userData`: tam plik ginie miedzy smieciami Chromium, a material
 * do oceny zbiera sie recznie, wiec sciezka osiagalna z terminala ma realna wartosc.
 */
export const LOG_DIR = join(homedir(), '.mowa')
export const LOG_PATH = join(LOG_DIR, 'transkrypty.jsonl')

/**
 * Co sie stalo z korekta. Prefiks `skip:` kontra `fail:` jest tresciowy, nie
 * kosmetyczny: przy pominieciu nikt nie czekal ani chwili, przy awarii uzytkownik
 * czekal na darmo. Osobne `off` odroznia wylaczona korekte od nieudanej — bez tego
 * wpis z pustym `clean` znaczylby dwie rozne rzeczy naraz.
 */
export type Outcome =
  | 'corrected'
  | 'off'
  | 'skip:too-long'
  | 'skip:no-corrector'
  | 'skip:nothing'
  | 'fail:budget'
  | 'fail:guard'
  | 'fail:provider'
  | 'fail:network'

/** Zapis 1 — surowy tekst, natychmiast po odpowiedzi STT. */
export interface OpenLine {
  id: string
  t: string
  lang: LanguageId
  /** Ten sam licznik, ktory pilnuje progu 150 slow — inaczej wpis klamalby o progu. */
  words: number
  speechMs: number
  raw: string
}

/** Zapis 2 — domkniecie wpisu po korekcie. */
export interface CloseLine {
  id: string
  /** Pusty, gdy poprawiona wersja nie powstala. Wpis, nie para. */
  clean: string
  outcome: Outcome
  cleanupMs: number
  provider?: ProviderId
  model?: string
  rejectedBy?: GuardLayer
}

export function outcomeOf(correction: Correction | null): Outcome {
  if (!correction) return 'off'
  if (correction.kind === 'corrected') return 'corrected'
  if (correction.kind === 'skipped') return `skip:${correction.reason}`
  return `fail:${correction.failure.reason}`
}

function closeLine(id: string, correction: Correction | null): CloseLine {
  const attempt = correction && correction.kind !== 'skipped' ? correction.attempt : null
  return {
    id,
    clean: correction?.kind === 'corrected' ? correction.text : '',
    outcome: outcomeOf(correction),
    cleanupMs: attempt?.ms ?? 0,
    ...(attempt ? { provider: attempt.provider, model: attempt.model } : {}),
    ...(attempt?.rejectedBy ? { rejectedBy: attempt.rejectedBy } : {})
  }
}

export interface LogDeps {
  enabled(): boolean
  /** Szew: produkcja dopisuje do pliku, testy do tablicy. Nie wolno mu blokowac. */
  append(line: string): void
  now?(): Date
  id?(): string
}

export interface TranscriptLog {
  /** Zapis 1. Zwraca `id` wpisu albo `null`, gdy log jest wylaczony. */
  open(raw: string, lang: LanguageId, speechMs: number): string | null
  /** Zapis 2. `null` w miejscu korekty znaczy, ze w ogole nie startowala. */
  close(id: string, correction: Correction | null): void
}

export function createTranscriptLog(deps: LogDeps): TranscriptLog {
  const now = deps.now ?? ((): Date => new Date())
  const nextId = deps.id ?? randomUUID

  function write(entry: OpenLine | CloseLine): void {
    try {
      deps.append(`${JSON.stringify(entry)}\n`)
    } catch {
      // Zapis nigdy nie przeszkadza dyktowaniu — patrz naglowek pliku.
    }
  }

  return {
    open(raw, lang, speechMs) {
      if (!deps.enabled()) return null
      const id = nextId()
      const t = now().toISOString()
      write({ id, t, lang, words: wordCount(raw), speechMs: Math.round(speechMs), raw })
      return id
    },
    close(id, correction) {
      // Bez sprawdzania przelacznika: wolamy to tylko dla wpisu, ktory juz sie zaczal,
      // a przelacznik mogl zgasnac w trakcie dyktowania. Polowka wpisu jest gorsza
      // niz wpis, ktorego uzytkownik juz nie chcial.
      write(closeLine(id, correction))
    }
  }
}

/** Dopisanie do pliku. Nie `await` i nie wersja `Sync` — zapis stoi obok, nie na drodze. */
export function appendLine(line: string): void {
  // `mode` dziala tylko przy tworzeniu pliku, czyli dokladnie wtedy, kiedy trzeba.
  void appendFile(LOG_PATH, line, { mode: 0o600 }).catch(() => {})
}

/**
 * Katalog powstaje raz, przy starcie — synchronicznie, zeby pierwsze dyktowanie
 * nie scigalo sie z `mkdir` i nie zgubilo wpisu.
 */
export function initTranscripts(): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 })
  } catch {
    return
  }
  // Node nie ma API do rozszerzonych atrybutow. `tmutil` ustawia dokladnie ten
  // atrybut, ktory wyklucza katalog z Time Machine — bez niego log wychodzi
  // z komputera w kazdej kopii zapasowej. Wynik nas nie obchodzi.
  execFile('tmutil', ['addexclusion', LOG_DIR], () => {})
}

/** „Wyczysc historie". Plik wraca sam przy nastepnym dyktowaniu, juz z `0600`. */
export async function clearTranscripts(): Promise<void> {
  await rm(LOG_PATH, { force: true })
}
