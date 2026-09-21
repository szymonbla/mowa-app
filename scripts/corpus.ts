/**
 * Skaner korpusu dla J2a (`specs/jev-decisions/tickets/J2a-corpus.md`).
 *
 * Czyta `~/.mowa/transkrypty.jsonl` i wypisuje kazde wystapienie kandydata na
 * zamiane - osobno te, ktore dzisiejsza zamiana calego slowa naprawde zlapie,
 * i te, ktore lapie dopiero dopasowanie po rdzeniu (polska odmiana). Roznica
 * miedzy tymi dwoma liczbami jest cala decyzja o J2, wiec skrypt liczy ja
 * wprost zamiast zostawiac ja czytelnikowi.
 *
 *   npx tsx scripts/corpus.ts            # podsumowanie pomiaru
 *   npx tsx scripts/corpus.ts --tsv      # jeden wiersz na wystapienie
 *   npx tsx scripts/corpus.ts --log <sciezka>
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { nextWholeWord } from '../src/shared/replacements.js'

/** Litera lub cyfra - ta sama klasa, ktorej pilnuje `nextWholeWord`. */
const WORD = /[\p{L}\p{N}_]/u

/** Najdluzszy polski sufiks, jaki skaner po rdzeniu uzna jeszcze za odmiane. */
const MAX_SUFFIX = 4

/**
 * `exact` - alias nie jest zwyklym slowem, wiec zamiana bezwarunkowa jest
 * bezpieczna. `ambiguous` - alias jest tez legalnym slowem i tylko zdanie
 * rozstrzyga, czy zamiana ma sens. To jest populacja, dla ktorej powstalo J2.
 */
export type CandidateKind = 'exact' | 'ambiguous'

export interface Candidate {
  /** Forma bazowa tak, jak zapisuje ja STT. */
  alias: string
  /** Pisownia, ktora chce uzyskac uzytkownik. */
  target: string
  kind: CandidateKind
}

/**
 * Aliasy pochodza wylacznie z bledow zaobserwowanych w logu - raport dal
 * pierwsza polowe, reszta wyszla ze skanu 347 wpisow. Zadnych form
 * wymyslonych: spekulacyjna tabela produkuje spekulacyjne poprawki.
 */
export const CANDIDATES: readonly Candidate[] = [
  { alias: 'weryfajer', target: 'verifier', kind: 'exact' },
  { alias: 'promty', target: 'prompty', kind: 'exact' },
  { alias: 'brancz', target: 'branch', kind: 'exact' },
  { alias: 'Light LLM', target: 'LiteLLM', kind: 'exact' },
  { alias: 'grochbot', target: 'Grokbot', kind: 'exact' },
  { alias: 'dżid', target: 'JID', kind: 'exact' },
  { alias: 'pryta', target: 'PR', kind: 'exact' },
  { alias: 'klaud', target: 'Claude', kind: 'exact' },
  { alias: 'Potato', target: 'poteto', kind: 'ambiguous' },
  { alias: 'kursor', target: 'Cursor', kind: 'ambiguous' },
  { alias: 'bard', target: 'board', kind: 'ambiguous' },
  { alias: 'kodeks', target: 'Codex', kind: 'ambiguous' },
  { alias: 'kron', target: 'cron', kind: 'ambiguous' },
  { alias: 'flit', target: 'Fleet', kind: 'ambiguous' },
  { alias: 'piar', target: 'PR', kind: 'ambiguous' }
]

/** Jak skaner znalazl wystapienie. */
type MatchKind = 'whole-word' | 'inflected'

interface Occurrence {
  candidate: Candidate
  match: MatchKind
  /** Tekst faktycznie dopasowany, razem z polska koncowka. */
  surface: string
  /** Zdanie, w ktorym padl alias. */
  sentence: string
  at: number
}

interface LogEntry {
  raw?: unknown
}

export function readTranscripts(path: string): string[] {
  const out: string[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line) as LogEntry
    if (typeof entry.raw === 'string' && entry.raw.trim()) out.push(entry.raw)
  }
  return out
}

/**
 * Wystapienia aliasu jako calego slowa - dokladnie to, co zamieni dzisiejsza
 * regula, bo pyta o to ta sama funkcje.
 */
function wholeWordHits(text: string, alias: string): number[] {
  const hits: number[] = []
  for (let from = 0; from <= text.length;) {
    const at = nextWholeWord(text, alias, from)
    if (at === null) break
    hits.push(at)
    from = at + alias.length
  }
  return hits
}

/**
 * Wystapienia aliasu jako poczatku slowa z krotka koncowka (`branczu`,
 * `Kodeksie`). Tego dzisiejsza zamiana nie widzi, a to wlasnie tak mowi
 * uzytkownik po polsku.
 */
function inflectedHits(text: string, alias: string): { at: number; surface: string }[] {
  const hits: { at: number; surface: string }[] = []
  const matcher = new RegExp(escapeRegExp(alias) + '(\\p{L}{1,' + MAX_SUFFIX + '})', 'giu')
  for (let match = matcher.exec(text); match; match = matcher.exec(text)) {
    const at = match.index
    const before = at === 0 ? '' : text[at - 1]
    const after = text[at + match[0].length] ?? ''
    if (before && WORD.test(before)) continue
    if (after && WORD.test(after)) continue
    hits.push({ at, surface: match[0] })
  }
  return hits
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Zdanie wokol pozycji. Log jest mowa, wiec kropek bywa malo i zdania sa dlugie. */
function sentenceAt(text: string, at: number): string {
  let start = 0
  let end = text.length
  for (let i = at; i > 0; i -= 1) {
    if (/[.?!]/.test(text[i - 1]) && /\s/.test(text[i] ?? '')) {
      start = i
      break
    }
  }
  for (let i = at; i < text.length; i += 1) {
    if (/[.?!]/.test(text[i])) {
      end = i + 1
      break
    }
  }
  return text.slice(start, end).trim()
}

export function scan(transcripts: readonly string[]): Occurrence[] {
  const found: Occurrence[] = []
  for (const text of transcripts) {
    for (const candidate of CANDIDATES) {
      for (const at of wholeWordHits(text, candidate.alias)) {
        found.push({
          candidate,
          match: 'whole-word',
          surface: text.slice(at, at + candidate.alias.length),
          sentence: sentenceAt(text, at),
          at
        })
      }
      for (const hit of inflectedHits(text, candidate.alias)) {
        found.push({
          candidate,
          match: 'inflected',
          surface: hit.surface,
          sentence: sentenceAt(text, hit.at),
          at: hit.at
        })
      }
    }
  }
  return found
}

function summarise(transcripts: readonly string[], found: readonly Occurrence[]): string {
  const lines: string[] = []
  lines.push(`transkrypty: ${transcripts.length}`)
  lines.push(`wystapienia: ${found.length}`)
  lines.push('')
  lines.push('alias\t->\trodzaj\tcale slowo\todmienione\tformy')
  for (const candidate of CANDIDATES) {
    const mine = found.filter((hit) => hit.candidate.alias === candidate.alias)
    if (mine.length === 0) continue
    const whole = mine.filter((hit) => hit.match === 'whole-word').length
    const inflected = mine.filter((hit) => hit.match === 'inflected')
    const forms = [...new Set(inflected.map((hit) => hit.surface.toLowerCase()))].join(' ')
    lines.push(
      `${candidate.alias}\t->\t${candidate.target}\t${candidate.kind}\t${whole}\t${inflected.length}\t${forms}`
    )
  }
  const whole = found.filter((hit) => hit.match === 'whole-word').length
  lines.push('')
  lines.push(`zlapane dzisiejsza zamiana calego slowa: ${whole}`)
  lines.push(`widoczne dopiero po rdzeniu: ${found.length - whole}`)
  return lines.join('\n')
}

function tsv(found: readonly Occurrence[]): string {
  const lines = ['alias\tcel\trodzaj\tdopasowanie\tforma\tzdanie']
  for (const hit of found) {
    lines.push(
      [
        hit.candidate.alias,
        hit.candidate.target,
        hit.candidate.kind,
        hit.match,
        hit.surface,
        hit.sentence.replace(/\s+/g, ' ')
      ].join('\t')
    )
  }
  return lines.join('\n')
}

/**
 * Log jest prywatna mowa uzytkownika i nie ma go w repo, wiec skrypt czyta
 * dysk tylko uruchomiony wprost. Testy importuja `CANDIDATES` i `scan`.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const logFlag = args.indexOf('--log')
  const path = logFlag === -1 ? join(homedir(), '.mowa', 'transkrypty.jsonl') : args[logFlag + 1]
  const transcripts = readTranscripts(path)
  const found = scan(transcripts)
  console.log(args.includes('--tsv') ? tsv(found) : summarise(transcripts, found))
}
