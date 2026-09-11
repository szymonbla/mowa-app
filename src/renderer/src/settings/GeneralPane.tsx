import type { LanguageId, PermissionStatus, Settings } from '../../../shared/types.js'
import { LANGUAGES } from '../../../shared/languages.js'
import { DEFAULT_DEVICE } from '../../../shared/devices.js'
import type { AudioDevice } from '../../../shared/devices.js'
import { Glyph } from './Icon.js'

interface Props {
  settings: Settings
  permissions: PermissionStatus
  /** Wejscia audio z okna recordera. Pusta lista, gdy recorder milczy. */
  devices: AudioDevice[]
  onPatch: (part: Partial<Settings>) => void
  onRequestMicrophone: () => void
  onRequestAccessibility: () => void
  onRequestAutomation: () => void
}

/** Opis stanu zgody na Apple Events. 'unknown' trwa do pierwszej proby wklejenia. */
const AUTOMATION_DESC: Record<PermissionStatus['automation'], string> = {
  granted: 'Cmd+V dochodzi do aktywnej aplikacji.',
  denied: 'macOS blokuje Cmd+V. Bez tego tekst trafi tylko do schowka.',
  unknown: 'Jeszcze niesprawdzone. Nacisnij Sprawdz — macOS pokaze monit.'
}

export function GeneralPane({
  settings,
  permissions,
  devices,
  onPatch,
  onRequestMicrophone,
  onRequestAccessibility,
  onRequestAutomation
}: Props): React.JSX.Element {
  const language = LANGUAGES.find((l) => l.id === settings.language)
  const missing =
    settings.inputDevice !== DEFAULT_DEVICE &&
    !devices.some((d) => d.deviceId === settings.inputDevice)

  return (
    <>
      <div className="group-title">Jezyk</div>

      <div className="card">
        <div className="row">
          <Glyph name="globe" />
          <div className="row-main">
            <div className="row-title">Jezyk mowy</div>
            <div className="row-desc">{language?.desc}</div>
          </div>
          <div className="row-tail">
            <select
              value={settings.language}
              onChange={(e) => onPatch({ language: e.target.value as LanguageId })}
            >
              {/* Przypiete osobno — reszta to 55 pozycji, bez podzialu Polski ginie w srodku. */}
              <optgroup label="Najczesciej">
                {LANGUAGES.filter((l) => l.pinned).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Pozostale">
                {LANGUAGES.filter((l) => !l.pinned).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      <div className="group-title">Tekst</div>

      {/*
        Jeden podpis ustawia oczekiwania na cala funkcje. Alternatywa — sygnal przy
        kazdym dyktowaniu — bylaby halasem: modul nie wie, kiedy sie pomylil.
      */}
      <div className="card">
        <div className="row">
          <Glyph name="text" />
          <div className="row-main">
            <div className="row-title">Poprawiaj podyktowany tekst</div>
            <div className="row-desc">
              Interpunkcja, gramatyka i literowki. Slowa i szyk zostaja Twoje. Nazw przekreconych
              przez rozpoznawanie mowy nie prostuje.
            </div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.cleanup}
              role="switch"
              aria-checked={settings.cleanup}
              aria-label="Poprawiaj podyktowany tekst"
              onClick={() => onPatch({ cleanup: !settings.cleanup })}
            />
          </div>
        </div>
      </div>

      <div className="group-title">Transkrypty</div>

      {/*
        Przelacznik **osobny** od korekty. Sklejenie ich odbieraloby wybor: to dwie
        rozne decyzje i inaczej wazy je prywatnosc. Przegladanie i kasowanie wpisow
        jest w zakladce Historia — tu zostaje tylko decyzja, czy zapisywac.
      */}
      <div className="card">
        <div className="row">
          <Glyph name="record" />
          <div className="row-main">
            <div className="row-title">Zapisuj transkrypty na dysku</div>
            <div className="row-desc">
              Kazde dyktowanie laduje w <code>~/.mowa/transkrypty.jsonl</code> — po to, zeby dalo
              sie sprawdzic, czy korekta pomaga. Plik nie idzie do kopii zapasowej. Nic go nie
              kasuje samo. Przegladasz i kasujesz wpisy w zakladce Historia.
            </div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.transcripts}
              role="switch"
              aria-checked={settings.transcripts}
              aria-label="Zapisuj transkrypty na dysku"
              onClick={() => onPatch({ transcripts: !settings.transcripts })}
            />
          </div>
        </div>
      </div>

      <div className="group-title">Mikrofon</div>

      {/*
        Odlaczony mikrofon zostaje na liscie jako osobna opcja. Bez tego select pokazalby
        pierwsza pozycje i uzytkownik myslalby, ze wybor przepadl — a nagranie i tak idzie
        na domyslny, dopoki urzadzenie nie wroci.
      */}
      <div className="card">
        <div className="row">
          <Glyph name="mic" />
          <div className="row-main">
            <div className="row-title">Mikrofon</div>
            <div className="row-desc">
              {permissions.microphone !== 'granted'
                ? 'Nazwy mikrofonow pojawia sie po nadaniu zgody ponizej.'
                : missing
                  ? 'Wybrany mikrofon jest odlaczony. Do jego powrotu nagrywa domyslny.'
                  : 'Domyslny systemowy to ten z Ustawien systemowych → Dzwiek.'}
            </div>
          </div>
          <div className="row-tail">
            <select
              value={settings.inputDevice}
              aria-label="Mikrofon"
              onChange={(e) => onPatch({ inputDevice: e.target.value })}
            >
              <option value={DEFAULT_DEVICE}>Domyslny systemowy</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Mikrofon bez nazwy'}
                </option>
              ))}
              {missing && <option value={settings.inputDevice}>Odlaczony mikrofon</option>}
            </select>
          </div>
        </div>
      </div>

      <div className="group-title">Uprawnienia</div>

      <div className="card">
        <div className="row">
          <Glyph name="mic" />
          <div className="row-main">
            <div className="row-title">Mikrofon</div>
            <div className="row-desc">Potrzebny do nagrywania.</div>
          </div>
          <div className="row-tail">
            {permissions.microphone === 'granted' ? (
              <span className="badge done">Nadane</span>
            ) : (
              <button className="primary" onClick={onRequestMicrophone}>
                Nadaj
              </button>
            )}
          </div>
        </div>

        <div className="row">
          <Glyph name="lock" />
          <div className="row-main">
            <div className="row-title">Accessibility</div>
            <div className="row-desc">
              {permissions.accessibility
                ? 'Tekst wkleja sie sam.'
                : 'Bez tego tekst trafi tylko do schowka.'}
            </div>
          </div>
          <div className="row-tail">
            {permissions.accessibility ? (
              <span className="badge done">Nadane</span>
            ) : (
              <button className="primary" onClick={onRequestAccessibility}>
                Nadaj
              </button>
            )}
          </div>
        </div>

        {/*
          Osobna zgoda od Accessibility. Wklejanie idzie przez AppleScript do
          "System Events", a to Apple Event — macOS pilnuje go druga lista.
        */}
        <div className="row">
          <Glyph name="text" />
          <div className="row-main">
            <div className="row-title">Automatyzacja</div>
            <div className="row-desc">
              {AUTOMATION_DESC[permissions.automation]}
              {permissions.automation === 'denied' && (
                <>
                  {' '}
                  Wlacz <b>mowa → System Events</b>.
                </>
              )}
            </div>
          </div>
          <div className="row-tail">
            {permissions.automation === 'granted' ? (
              <span className="badge done">Nadane</span>
            ) : (
              <button className="primary" onClick={onRequestAutomation}>
                {permissions.automation === 'denied' ? 'Otworz' : 'Sprawdz'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="group-title">System</div>

      <div className="card">
        <div className="row">
          <Glyph name="sliders" />
          <div className="row-main">
            <div className="row-title">Uruchamiaj przy logowaniu</div>
            <div className="row-desc">Start w tle, bez otwartego okna.</div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.launchAtLogin}
              role="switch"
              aria-checked={settings.launchAtLogin}
              aria-label="Uruchamiaj przy logowaniu"
              onClick={() => onPatch({ launchAtLogin: !settings.launchAtLogin })}
            />
          </div>
        </div>
      </div>
    </>
  )
}
