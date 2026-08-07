import type { LanguageId, PermissionStatus, Settings } from '../../../shared/types.js'
import { LANGUAGES } from '../../../shared/languages.js'
import { Glyph } from './Icon.js'

interface Props {
  settings: Settings
  permissions: PermissionStatus
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
  onPatch,
  onRequestMicrophone,
  onRequestAccessibility,
  onRequestAutomation
}: Props): React.JSX.Element {
  const language = LANGUAGES.find((l) => l.id === settings.language)

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
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
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
