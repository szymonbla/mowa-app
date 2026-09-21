import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { appendFile, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LanguageId } from '../shared/types.js'
import type { CorrectionLog } from './text-correction.js'

/**
 * Log transkryptow. Nie jest zrodlem odzyskiwania — tym jest zmienna w pamieci procesu
 * glownego. Skutek jest celowy: skoro nic od tego pliku nie zalezy, wolno go wylaczyc,
 * wyczyscic i skasowac bez psucia jakiejkolwiek funkcji.
 *
 * Zapis lezy **poza sciezka krytyczna**: nie jest oczekiwany, nie ma wariantu
 * `Failure` i nie zatrzymuje wklejenia. Cena tego jest znana i przyjeta — cichy,
 * martwy log poznac dopiero przy zagladnieciu do pliku.
 */

/**
 * Katalog wlasny, nie `userData`: tam plik ginie miedzy smieciami Chromium, a log
 * czyta sie recznie, wiec sciezka osiagalna z terminala ma realna wartosc.
 */
export const LOG_DIR = join(homedir(), '.mowa')
export const LOG_PATH = join(LOG_DIR, 'transkrypty.jsonl')

/** Jeden wpis — surowy tekst, natychmiast po odpowiedzi STT. */
export interface Line {
  t: string
  lang: LanguageId
  speechMs: number
  raw: string
  correction?: CorrectionLog
}

export interface LogDeps {
  enabled(): boolean
  /** Szew: produkcja dopisuje do pliku, testy do tablicy. Nie wolno mu blokowac. */
  append(line: string): void
  now?(): Date
}

export interface TranscriptLog {
  write(raw: string, lang: LanguageId, speechMs: number, correction?: CorrectionLog): void
}

export function createTranscriptLog(deps: LogDeps): TranscriptLog {
  const now = deps.now ?? ((): Date => new Date())

  return {
    write(raw, lang, speechMs, correction) {
      if (!deps.enabled()) return
      const entry: Line = {
        t: now().toISOString(),
        lang,
        speechMs: Math.round(speechMs),
        raw,
        ...(correction ? { correction } : {})
      }
      try {
        deps.append(`${JSON.stringify(entry)}\n`)
      } catch {
        // Zapis nigdy nie przeszkadza dyktowaniu — patrz naglowek pliku.
      }
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
