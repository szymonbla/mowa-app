import type {
  KeyHealth,
  KeyStatus,
  PermissionStatus,
  ProviderMeta,
  Settings
} from '../../../shared/types.js'
import { Glyph } from './Icon.js'
import { keycaps } from './accelerator.js'
import type { View } from './views.js'
import { LANGUAGE_LABELS } from './views.js'

interface Props {
  settings: Settings
  provider: ProviderMeta | undefined
  keyStatus: KeyStatus | undefined
  keyHealth: KeyHealth | undefined
  permissions: PermissionStatus
  onNavigate: (view: View) => void
}

/** Zolty tylko tam, gdzie czegos brakuje — wzrok trafia od razu w to, co wymaga dzialania. */
function Status({ done, todo }: { done: boolean; todo: string }): React.JSX.Element {
  return <span className={`badge ${done ? 'done' : 'todo'}`}>{done ? 'Gotowe' : todo}</span>
}

export function HomePane({
  settings,
  provider,
  keyStatus,
  keyHealth,
  permissions,
  onNavigate
}: Props): React.JSX.Element {
  // Automatyzacja liczy sie jako brak dopiero po potwierdzonej odmowie —
  // 'unknown' nie jest problemem, tylko niewiedza.
  const missingPermissions =
    (permissions.microphone === 'granted' ? 0 : 1) +
    (permissions.accessibility ? 0 : 1) +
    (permissions.automation === 'denied' ? 1 : 0)
  const hasKey = keyStatus?.hasKey === true
  const keyBad = keyHealth?.state === 'invalid'
  const ready = hasKey && !keyBad && missingPermissions === 0
  const caps = keycaps(settings.shortcut)

  return (
    <>
      <div className="strip">
        <div className="cell">
          <div className="cell-value">{provider?.label ?? '—'}</div>
          <div className="cell-label">Dostawca</div>
        </div>
        <div className="cell">
          <div className="cell-value">{LANGUAGE_LABELS[settings.language]}</div>
          <div className="cell-label">Jezyk</div>
        </div>
        <div className="cell">
          <div className="keys cell-keys">
            {caps.map((cap) => (
              <span key={cap} className="keycap">
                {cap}
              </span>
            ))}
          </div>
          <div className="cell-label">Skrot</div>
        </div>
        <div className="cell">
          <div className={`cell-value ${ready ? '' : keyBad ? 'bad' : 'attention'}`}>
            {ready ? 'Gotowe' : keyBad ? 'Zly klucz' : 'Do konfiguracji'}
          </div>
          <div className="cell-label">Status</div>
        </div>
      </div>

      <div className="group-title">Jak zaczac</div>

      <div className="card">
        <div className="row">
          <Glyph name="record" />
          <div className="row-main">
            <div className="row-title">Dyktuj</div>
            <div className="row-desc">Nacisnij raz, mow, nacisnij ponownie. Esc anuluje.</div>
          </div>
          <div className="row-tail keys">
            {caps.map((cap) => (
              <span key={cap} className="keycap">
                {cap}
              </span>
            ))}
          </div>
        </div>

        <button className="row" onClick={() => onNavigate('model')}>
          <Glyph name="key" />
          <div className="row-main">
            <div className="row-title">Klucz API</div>
            <div className="row-desc">
              {keyBad
                ? `${provider?.label} odrzucil ten klucz`
                : hasKey
                  ? `${provider?.label} — klucz zapisany`
                  : `Dodaj klucz ${provider?.label}`}
            </div>
          </div>
          <span className="row-tail">
            {keyBad ? (
              <span className="badge bad">Nieprawidlowy</span>
            ) : (
              <Status done={hasKey} todo="Brak" />
            )}
            <span className="chevron">›</span>
          </span>
        </button>

        <button className="row" onClick={() => onNavigate('general')}>
          <Glyph name="lock" />
          <div className="row-main">
            <div className="row-title">Uprawnienia</div>
            <div className="row-desc">
              Mikrofon, Accessibility i Automatyzacja — bez nich nie ma wklejania.
            </div>
          </div>
          <span className="row-tail">
            <Status done={missingPermissions === 0} todo={`Brak ${missingPermissions}`} />
            <span className="chevron">›</span>
          </span>
        </button>

        <button className="row" onClick={() => onNavigate('shortcut')}>
          <Glyph name="keyboard" />
          <div className="row-main">
            <div className="row-title">Zmien skrot</div>
            <div className="row-desc">Ustaw wlasna kombinacje klawiszy.</div>
          </div>
          <span className="row-tail">
            <span className="chevron">›</span>
          </span>
        </button>
      </div>
    </>
  )
}
