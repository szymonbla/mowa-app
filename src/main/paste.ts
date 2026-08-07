import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setAutomation } from './permissions.js'
import { FailureError } from '../shared/failure.js'
import type { Failure } from '../shared/failure.js'

const execFileAsync = promisify(execFile)

const PASTE_SCRIPT = 'tell application "System Events" to keystroke "v" using command down'

/** Monit TCC blokuje osascript, dopoki uzytkownik nie odpowie. */
const PASTE_TIMEOUT_MS = 5000

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
 * Zapisuje tekst do schowka i wysyla Cmd+V do aktywnej aplikacji.
 * Poprzednia zawartosc schowka nie jest przywracana — tak ustalono.
 *
 * Schowek zapisujemy przed kazdym sprawdzeniem, zeby awaria wklejania nie kosztowala
 * transkrypcji.
 */
export async function pasteText(text: string): Promise<void> {
  clipboard.writeText(text)

  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    throw new FailureError({ kind: 'paste', reason: 'accessibility' })
  }

  // Schowek systemowy potrzebuje chwili, zanim Cmd+V zobaczy nowa zawartosc.
  await new Promise((r) => setTimeout(r, 60))

  try {
    await execFileAsync('osascript', ['-e', PASTE_SCRIPT], { timeout: PASTE_TIMEOUT_MS })
  } catch (err) {
    const failure = pasteFailure(err)
    // Udana proba jest jedynym pewnym dowodem zgody — zapamietujemy oba wyniki.
    if (failure.reason === 'automation') setAutomation('denied')
    throw new FailureError(failure)
  }

  setAutomation('granted')
}
