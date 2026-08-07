import { clipboard, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setAutomation } from './permissions.js'

const execFileAsync = promisify(execFile)

const PASTE_SCRIPT = 'tell application "System Events" to keystroke "v" using command down'

/** Monit TCC blokuje osascript, dopoki uzytkownik nie odpowie. */
const PASTE_TIMEOUT_MS = 5000

export type PasteFailure = 'accessibility' | 'automation' | 'timeout' | 'unknown'

/**
 * Tekst jest juz w schowku, zanim ten blad powstanie — kazdy komunikat to mowi,
 * bo Cmd+V recznie zawsze ratuje sytuacje.
 */
export class PasteError extends Error {
  constructor(
    readonly kind: PasteFailure,
    message: string,
    /** Surowe stderr z osascript. Do okna ustawien, nie do pigulki. */
    readonly detail?: string
  ) {
    super(message)
    this.name = 'PasteError'
  }
}

const MESSAGES: Record<PasteFailure, string> = {
  accessibility: 'Brak zgody Accessibility — tekst w schowku',
  automation: 'Brak zgody Automatyzacja — tekst w schowku',
  timeout: 'Potwierdz monit macOS — tekst w schowku',
  unknown: 'Nie udalo sie wkleic — tekst w schowku'
}

/**
 * osascript nie zwraca kodu wyjscia per rodzaj odmowy — rozroznia je tylko stderr.
 *   -1743  Not authorised to send Apple events (zgoda Automatyzacja)
 *   -1719  proces nie jest zaufanym klientem Accessibility
 *   -25211 blad instalacji hooka klawiatury, ta sama przyczyna
 */
function classify(err: unknown): PasteError {
  const e = err as { stderr?: string; killed?: boolean; message?: string }
  const stderr = (e.stderr ?? '').trim()
  const detail = stderr || e.message

  if (e.killed) return new PasteError('timeout', MESSAGES.timeout, detail)
  if (stderr.includes('-1743') || /apple event/i.test(stderr)) {
    return new PasteError('automation', MESSAGES.automation, detail)
  }
  if (stderr.includes('-1719') || stderr.includes('-25211') || /assistive/i.test(stderr)) {
    return new PasteError('accessibility', MESSAGES.accessibility, detail)
  }
  return new PasteError('unknown', MESSAGES.unknown, detail)
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
    throw new PasteError('accessibility', MESSAGES.accessibility)
  }

  // Schowek systemowy potrzebuje chwili, zanim Cmd+V zobaczy nowa zawartosc.
  await new Promise((r) => setTimeout(r, 60))

  try {
    await execFileAsync('osascript', ['-e', PASTE_SCRIPT], { timeout: PASTE_TIMEOUT_MS })
  } catch (err) {
    const failure = classify(err)
    // Udana proba jest jedynym pewnym dowodem zgody — zapamietujemy oba wyniki.
    if (failure.kind === 'automation') setAutomation('denied')
    throw failure
  }

  setAutomation('granted')
}
