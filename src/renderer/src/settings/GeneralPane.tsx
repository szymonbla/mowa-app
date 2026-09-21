import { useEffect, useState } from 'react'
import type { KeyStatus, LanguageId, PermissionStatus, Settings } from '../../../shared/types.js'
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
  // Kasowanie jest nieodwracalne, a plik zbiera sie miesiacami. Potwierdzenie robi sam
  // przycisk — okno dialogowe zablokowaloby renderera dla jednego klikniecia.
  const [confirming, setConfirming] = useState(false)
  const [key, setKey] = useState<KeyStatus | null>(null)
  const [draft, setDraft] = useState('')
  const [editingKey, setEditingKey] = useState(true)
  useEffect(() => {
    void window.api.getOpenRouterKey().then((next) => {
      setKey(next)
      setEditingKey(!next.hasKey)
    })
  }, [])

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

      <div className="group-title">Kontekst dla agenta</div>

      <div className="card">
        <div className="row">
          <Glyph name="sparkle" />
          <div className="row-main">
            <div className="row-title">Dodawaj status do dyktowania</div>
            <div className="row-desc">
              JEV oznacza tekst jako zmianę, pytanie, pomysł albo notatkę.
            </div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.agentContext}
              role="switch"
              aria-checked={settings.agentContext}
              onClick={() => onPatch({ agentContext: !settings.agentContext })}
            />
          </div>
        </div>
        <div className="row stack">
          <div className="row-main">
            <div className="row-title">Klucz OpenRouter</div>
            <div className="row-desc">Zapisany w Keychain. Potrzebny tylko w tym trybie.</div>
          </div>
          <div className="key-field">
            {editingKey ? (
              <>
                <input
                  type="password"
                  value={draft}
                  placeholder="sk-or-…"
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={!draft.trim()}
                  onClick={() =>
                    void window.api.setOpenRouterKey(draft).then((next) => {
                      setKey(next)
                      setDraft('')
                      setEditingKey(false)
                    })
                  }
                >
                  Zapisz
                </button>
              </>
            ) : (
              <>
                <span className="key-set">{key?.masked}</span>
                <button onClick={() => setEditingKey(true)}>Zmien</button>
              </>
            )}
          </div>
          {!editingKey && <div className="hint">✓ Klucz OpenRouter zapisany</div>}
        </div>
      </div>

      <div className="group-title">Wklejanie</div>

      <div className="card">
        <div className="row">
          <Glyph name="text" />
          <div className="row-main">
            <div className="row-title">Przywracaj schowek po wklejeniu</div>
            <div className="row-desc">
              Po Cmd+V wraca to, co bylo w schowku wczesniej. Listy plikow z Findera nie wracaja.
            </div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.restoreClipboard}
              role="switch"
              aria-checked={settings.restoreClipboard}
              aria-label="Przywracaj schowek po wklejeniu"
              onClick={() => onPatch({ restoreClipboard: !settings.restoreClipboard })}
            />
          </div>
        </div>

        <div className="row">
          <Glyph name="lock" />
          <div className="row-main">
            <div className="row-title">Tylko do schowka</div>
            <div className="row-desc">Bez Cmd+V. Wklejasz sam, kiedy chcesz.</div>
          </div>
          <div className="row-tail">
            <button
              className="switch"
              data-on={settings.pasteMode === 'clipboard'}
              role="switch"
              aria-checked={settings.pasteMode === 'clipboard'}
              aria-label="Tylko do schowka"
              onClick={() =>
                onPatch({ pasteMode: settings.pasteMode === 'clipboard' ? 'paste' : 'clipboard' })
              }
            />
          </div>
        </div>
      </div>

      <div className="group-title">Transkrypty</div>

      <div className="card">
        <div className="row">
          <Glyph name="record" />
          <div className="row-main">
            <div className="row-title">Zapisuj transkrypty na dysku</div>
            <div className="row-desc">
              Kazde dyktowanie laduje w <code>~/.mowa/transkrypty.jsonl</code> — jako surowy tekst
              zwrocony przez model. Plik nie idzie do kopii zapasowej. Nic go nie kasuje samo.
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

        <div className="row">
          <Glyph name="lock" />
          <div className="row-main">
            <div className="row-title">Plik z transkryptami</div>
            <div className="row-desc">
              Zawiera wszystko, co podyktowales. Przegladaj go w edytorze — okna historii tu nie ma.
            </div>
          </div>
          <div className="row-tail">
            <button onClick={() => void window.api.showTranscripts()}>Pokaz</button>
            {confirming ? (
              <button
                className="primary"
                onClick={() => {
                  void window.api.clearTranscripts()
                  setConfirming(false)
                }}
              >
                Na pewno?
              </button>
            ) : (
              <button onClick={() => setConfirming(true)}>Wyczysc</button>
            )}
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
