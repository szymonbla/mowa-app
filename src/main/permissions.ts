import { shell, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AutomationStatus, PermissionStatus } from '../shared/types.js'

const execFileAsync = promisify(execFile)

const ACCESSIBILITY_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
const MICROPHONE_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
const AUTOMATION_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'

/**
 * Sonda musi pytac o prawdziwa wlasciwosc celu. AppleScript odpowiada sam na
 * `return 1`, `return name` i `return version` — nie wysyla wtedy zadnego Apple
 * Eventu, wiec taka sonda zawsze "przechodzi". `UI elements enabled` to jedno
 * pole, ale po nie trzeba juz pojsc do System Events.
 */
const PROBE_SCRIPT = 'tell application "System Events" to return UI elements enabled'

/**
 * Sonda pokazuje monit TCC, wiec nie wolno jej uruchamiac przy starcie —
 * uzytkownik dostalby okno dialogowe bez zwiazku z tym, co robi.
 * Do pierwszej proby stan jest nieznany.
 */
let automation: AutomationStatus = 'unknown'

export function getPermissions(): PermissionStatus {
  return {
    microphone: systemPreferences.getMediaAccessStatus('microphone'),
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    automation
  }
}

/** Zapamietuje wynik prawdziwego wklejenia — ono wie wiecej niz sonda. */
export function setAutomation(status: AutomationStatus): void {
  automation = status
}

/** Pokazuje systemowy monit. Zwraca true, gdy zgoda jest nadana. */
export async function requestMicrophone(): Promise<boolean> {
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true
  const granted = await systemPreferences.askForMediaAccess('microphone')
  // Po odmowie monit nie pojawi sie ponownie. Kierujemy do Ustawien systemowych.
  if (!granted) await shell.openExternal(MICROPHONE_PANE)
  return granted
}

/**
 * macOS nie ma API do proszenia o Accessibility.
 * `isTrustedAccessibilityClient(true)` dodaje aplikacje do listy i otwiera panel.
 */
export async function requestAccessibility(): Promise<boolean> {
  const trusted = systemPreferences.isTrustedAccessibilityClient(true)
  if (!trusted) await shell.openExternal(ACCESSIBILITY_PANE)
  return trusted
}

/**
 * Zgoda "Automatyzacja" jest osobna od Accessibility i bez niej osascript zwraca
 * blad -1743. macOS nie ma API do jej sprawdzenia — jedyny sposob to wyslac
 * Apple Event i zobaczyc, co wroci.
 *
 * Pierwsze wywolanie pokazuje monit i czeka na odpowiedz uzytkownika, dlatego
 * limit czasu jest hojny. Warunek monitu: `NSAppleEventsUsageDescription`
 * w Info.plist. Bez tego wpisu macOS odmawia bez pytania.
 */
export async function requestAutomation(): Promise<AutomationStatus> {
  if (await probe()) {
    automation = 'granted'
    return automation
  }

  // Zapytanie, ktore wywolalo monit, konczy sie bledem -1743 takze wtedy, gdy
  // uzytkownik wlasnie kliknal "Zezwol". Dopiero druga proba mowi prawde.
  if (await probe()) {
    automation = 'granted'
    return automation
  }

  automation = 'denied'
  // Po odmowie monit juz nie wroci — zgode wlacza sie recznie.
  await shell.openExternal(AUTOMATION_PANE)
  return automation
}

async function probe(): Promise<boolean> {
  try {
    await execFileAsync('osascript', ['-e', PROBE_SCRIPT], { timeout: 120_000 })
    return true
  } catch {
    return false
  }
}
