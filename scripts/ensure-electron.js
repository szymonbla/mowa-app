/**
 * Uruchamiane automatycznie przed `npm run dev` i `npm start` (hooki `pre*`).
 *
 * `npm install` nie pobiera binarki Electrona, jesli postinstall paczki nie
 * wykonal sie (np. instalacja z `--ignore-scripts` albo przerwane pobieranie).
 * Zostaje wtedy sam katalog `node_modules/electron` bez `dist/`, a electron-vite
 * konczy sie zagadkowym `Error: Electron uninstall`.
 *
 * Ten skrypt sprawdza, czy binarka jest na miejscu, i dociaga ja raz.
 * Gdy `path.txt` i `dist/` istnieja, nie robi nic — nie nadpisuje wiec podpisu
 * zalozonego przez `npm run dev:plist`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const DIR = 'node_modules/electron'
const INSTALLED = existsSync(`${DIR}/path.txt`) && existsSync(`${DIR}/dist`)

if (INSTALLED) {
  process.exit(0)
}

if (!existsSync(`${DIR}/install.js`)) {
  console.error('[ensure-electron] brak node_modules/electron — uruchom `npm install`')
  process.exit(1)
}

console.log('[ensure-electron] brak binarki Electrona, pobieram...')
execFileSync(process.execPath, ['install.js'], { cwd: DIR, stdio: 'inherit' })
