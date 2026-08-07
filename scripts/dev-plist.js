/**
 * Krok awaryjny, nie czesc `npm run dev`. Uruchamiac recznie: `npm run dev:plist`.
 *
 * Dopisuje `NSAppleEventsUsageDescription` do `node_modules/electron/dist/Electron.app`
 * i podpisuje ja na nowo (zmiana Info.plist lamie pieczec podpisu, a bez podpisu
 * Electron nie wystartuje na Apple Silicon).
 *
 * UWAGA: przy starcie z terminala macOS przypisuje Apple Events **terminalowi**,
 * a nie Electronowi — to terminal jest procesem odpowiedzialnym za cale drzewo.
 * Wtedy ten skrypt nic nie zmienia, a zgode trzeba nadac terminalowi. Ma sens
 * tylko, gdy TCC wskazuje na sam Electron — np. przy starcie przez `open -a`.
 *
 * Koszt: nowy podpis to dla macOS nowa aplikacja. Zgody TCC i wpisy Keychain
 * przypisane staremu podpisowi przepadaja.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const APP = 'node_modules/electron/dist/Electron.app'
const PLIST = `${APP}/Contents/Info.plist`
const KEY = 'NSAppleEventsUsageDescription'
const VALUE = 'Aplikacja mowa wysyla Cmd+V, aby wkleic transkrypcje.'

// Cofniecie podpisu: skasuj `node_modules/electron/dist` i uruchom
// `node node_modules/electron/install.js` — samo `npm install` nie pobiera `dist`.
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
