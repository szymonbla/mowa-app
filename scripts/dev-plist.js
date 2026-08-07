/**
 * Odblokowuje wklejanie w trybie dev.
 *
 * W dev nie dziala zbudowana appka, tylko `node_modules/electron/dist/Electron.app`.
 * Jej Info.plist nie ma `NSAppleEventsUsageDescription`, a bez tego wpisu macOS
 * odrzuca Apple Events bez pokazania monitu — osascript zwraca -1743 i Cmd+V
 * nigdy nie dochodzi. Zbudowana appka ma ten wpis z electron-builder.yml.
 *
 * Zmiana Info.plist lamie pieczec podpisu, wiec zaraz po niej podpisujemy appke
 * na nowo (ad-hoc). Na Apple Silicon bez podpisu Electron by sie nie uruchomil.
 *
 * Skrypt jest idempotentny i cichy, gdy nie ma nic do zrobienia. Uruchamiac
 * ponownie po kazdym `npm install` — pobiera on swiezy katalog `dist`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const APP = 'node_modules/electron/dist/Electron.app'
const PLIST = `${APP}/Contents/Info.plist`
const KEY = 'NSAppleEventsUsageDescription'
const VALUE = 'SimpleWhisper wysyla Cmd+V, aby wkleic transkrypcje.'

// Furtka: przywrocenie oryginalnego podpisu to `npm i electron --force`.
if (process.env.SW_SKIP_PLIST) {
  console.log('[dev-plist] SW_SKIP_PLIST — pomijam; Cmd+V nie zadziala w dev')
  process.exit(0)
}

if (!existsSync(PLIST)) {
  console.warn(`[dev-plist] brak ${APP} — pomijam`)
  process.exit(0)
}

// PlistBuddy konczy sie bledem, gdy klucza nie ma — to jedyny sposob na sprawdzenie.
try {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${KEY}`, PLIST], {
    stdio: ['ignore', 'ignore', 'ignore']
  })
  process.exit(0)
} catch {
  // Klucza nie ma. Dodajemy nizej.
}

execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${KEY} string ${VALUE}`, PLIST])
// --force, bo podpis juz istnieje; --deep, bo helpery maja wlasne podpisy.
execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP])

console.log(`[dev-plist] dodano ${KEY} i podpisano ${APP} na nowo`)
console.log('[dev-plist] macOS zapyta o zgode na sterowanie System Events przy 1. wklejeniu')
// Nowy podpis = inna tozsamosc dla macOS. Stare zgody i wpisy Keychain jej nie znaja.
console.log('[dev-plist] przy 1. starcie: kliknij "Zawsze zezwalaj" w monicie Keychain')
console.log('[dev-plist] nadaj tez Accessibility ponownie — podpis sie zmienil')
