import { clipboard, systemPreferences } from 'electron'
import type { NativeImage } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setAutomation } from './permissions.js'
import { FailureError } from '../shared/failure.js'
import type { Failure } from '../shared/failure.js'
import type { PasteMode } from '../shared/types.js'

const execFileAsync = promisify(execFile)

/** Monit TCC blokuje osascript, dopoki uzytkownik nie odpowie. */
const PASTE_TIMEOUT_MS = 5000

/**
 * Ile czekamy po Cmd+V, zanim schowek wroci do wlasciciela. Wklejenie jest
 * asynchroniczne — osascript wraca, gdy zdarzenie poszlo, nie gdy aplikacja je
 * obsluzyla. Za krotki odstep oddaje schowek, zanim tekst z niego wyjdzie.
 */
const RESTORE_DELAY_MS = 400

export interface PasteOptions {
  mode: PasteMode
  /** Czy po udanym Cmd+V oddac schowek temu, co bylo w nim wczesniej. */
  restore: boolean
}

/** Zawartosc schowka w formatach, ktore da sie odlozyc z powrotem. */
type Snapshot = Pick<Electron.Data, 'text' | 'html' | 'rtf'> & { image?: NativeImage }

/**
 * Formaty, ktorych `clipboard.write` nie odtworzy. Plik skopiowany w Finderze wroci
 * jako sciezka w tekscie, a to nie jest ten sam schowek — wtedy lepiej nie ruszac go
 * wcale. Tak samo ustalono w specyfikacji: listy plikow nie przywracamy.
 */
const FILE_FORMATS = ['public.file-url', 'NSFilenamesPboardType']

/**
 * Zdjecie schowka sprzed wklejenia. Null = nie ma czego przywracac: schowek jest
 * pusty albo trzyma cos, czego nie umiemy odlozyc z powrotem.
 */
function snapshot(): Snapshot | null {
  const formats = clipboard.availableFormats()
  if (formats.length === 0) return null
  if (formats.some((format) => FILE_FORMATS.includes(format))) return null

  const image = clipboard.readImage()
  const snap: Snapshot = {
    text: clipboard.readText() || undefined,
    html: clipboard.readHTML() || undefined,
    rtf: clipboard.readRTF() || undefined,
    image: image.isEmpty() ? undefined : image
  }
  return Object.values(snap).some((value) => value !== undefined) ? snap : null
}

type PasteFailure = Extract<Failure, { kind: 'paste' }>

/**
 * osascript nie zwraca kodu wyjscia per rodzaj odmowy — rozroznia je tylko stderr.
 *   -1743  Not authorised to send Apple events (zgoda Automatyzacja)
 *   -1719  proces nie jest zaufanym klientem Accessibility
 *   -25211 blad instalacji hooka klawiatury, ta sama przyczyna
 *
 * Wynikiem sa same fakty — surowe stderr wedruje do okna ustawien jako `detail`.
 */
function pasteFailure(err: unknown): PasteFailure {
  const e = err as { stderr?: string; killed?: boolean; message?: string }
  const stderr = (e.stderr ?? '').trim()
  const detail = stderr || e.message

  if (e.killed) return { kind: 'paste', reason: 'timeout', detail }
  if (stderr.includes('-1743') || /apple event/i.test(stderr)) {
    return { kind: 'paste', reason: 'automation', detail }
  }
  if (stderr.includes('-1719') || stderr.includes('-25211') || /assistive/i.test(stderr)) {
    return { kind: 'paste', reason: 'accessibility', detail }
  }
  return { kind: 'paste', reason: 'unknown', detail }
}

/**
 * Wysyla jeden skrot z klawisza Command do aktywnej aplikacji. Jedyna droga, ktora
 * mowa ma do cudzego okna — i jedyne miejsce, w ktorym powstaja awarie zgod.
 */
async function keystroke(key: string): Promise<void> {
  const script = `tell application "System Events" to keystroke "${key}" using command down`
  try {
    await execFileAsync('osascript', ['-e', script], { timeout: PASTE_TIMEOUT_MS })
  } catch (err) {
    const failure = pasteFailure(err)
    // Udana proba jest jedynym pewnym dowodem zgody — zapamietujemy oba wyniki.
    if (failure.reason === 'automation') setAutomation('denied')
    throw new FailureError(failure)
  }
  setAutomation('granted')
}

/**
 * Cofa ostatnie wklejenie. Dziala w polach tekstowych; w terminalu Cmd+Z nie ma
 * znaczenia, wiec wynik zalezy od aplikacji na wierzchu.
 */
export async function undoPaste(): Promise<void> {
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    throw new FailureError({ kind: 'paste', reason: 'accessibility' })
  }
  await keystroke('z')
}

/**
 * Zapisuje tekst do schowka i wysyla Cmd+V do aktywnej aplikacji, a potem oddaje
 * schowek temu, co bylo w nim wczesniej.
 *
 * Schowek zapisujemy przed kazdym sprawdzeniem, zeby awaria wklejania nie kosztowala
 * transkrypcji.
 */
export async function pasteText(text: string, opts: PasteOptions): Promise<void> {
  // Zdjecie musi powstac przed zapisem — po nim nie ma juz czego czytac.
  const previous = opts.restore && opts.mode === 'paste' ? snapshot() : null

  clipboard.writeText(text)

  // Tryb tylko do schowka konczy sie tutaj: bez Cmd+V nie ma po co pytac o zgody,
  // a przywracac nie ma czego — schowek jest calym produktem dyktowania.
  if (opts.mode === 'clipboard') return

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    throw new FailureError({ kind: 'paste', reason: 'accessibility' })
  }

  // Schowek systemowy potrzebuje chwili, zanim Cmd+V zobaczy nowa zawartosc.
  await new Promise((r) => setTimeout(r, 60))

  await keystroke('v')

  /*
   * Tylko udane Cmd+V znaczy, ze tekst doszedl na miejsce. Po awarii transkrypt
   * zostaje w schowku, bo dokladnie to obiecuje kazdy komunikat bledu wklejania.
   *
   * Na przywrocenie nie czekamy: dyktowanie jest skonczone, pigulka ma zniknac,
   * a schowek wraca w tle.
   */
  if (previous) setTimeout(() => clipboard.write(previous), RESTORE_DELAY_MS)
}
