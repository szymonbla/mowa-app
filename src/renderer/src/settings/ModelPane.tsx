import type { KeyHealth, KeyStatus, ProviderId, ProviderMeta } from '../../../shared/types.js'
import { ApiKeyField } from './ApiKeyField.js'
import { Icon } from './Icon.js'

interface Props {
  providers: ProviderMeta[]
  active: ProviderMeta | undefined
  model: string
  keys: Record<ProviderId, KeyStatus>
  health: Record<ProviderId, KeyHealth> | undefined
  onProvider: (id: ProviderId) => void
  onModel: (id: string) => void
  onKeySaved: (id: ProviderId, status: KeyStatus) => void
}

/** Opis stanu klucza w wierszu dostawcy. Pusty = nie ma nic do dodania. */
function healthNote(status: KeyStatus, health: KeyHealth | undefined): string {
  if (!status.hasKey) return ' · bez klucza'
  switch (health?.state) {
    case 'invalid':
      return ' · klucz odrzucony'
    case 'checking':
      return ' · sprawdzam klucz…'
    case 'ok':
      return ' · klucz dziala'
    default:
      return ' · klucz zapisany'
  }
}

export function ModelPane({
  providers,
  active,
  model,
  keys,
  health,
  onProvider,
  onModel,
  onKeySaved
}: Props): React.JSX.Element {
  return (
    <>
      <div className="group-title">Dostawca</div>

      <div className="card">
        {providers.map((p) => {
          const selected = p.id === active?.id
          return (
            <button
              key={p.id}
              className={`row ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onProvider(p.id)}
            >
              {/* Ptaszek zajmuje miejsce takze gdy jest niewidoczny — wiersze nie skacza. */}
              <span className={`check ${selected ? 'on' : ''}`}>
                <Icon name="check" />
              </span>
              <div className="row-main">
                <div className="row-title">
                  {p.label}
                  {health?.[p.id].state === 'invalid' && <span className="lamp" />}
                </div>
                <div className="row-desc">
                  {p.models.length > 0 ? `${p.models.length} modele` : 'jeden model STT'}
                  {healthNote(keys[p.id], health?.[p.id])}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {active && (
        <>
          <div className="group-title">{active.label}</div>

          <div className="card">
            {active.models.length > 0 && (
              <div className="row">
                <div className="row-main">
                  <div className="row-title">Model</div>
                  <div className="row-desc">Nowsze modele sa dokladniejsze i drozsze.</div>
                </div>
                <div className="row-tail">
                  <select value={model} onChange={(e) => onModel(e.target.value)}>
                    {active.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="row stack">
              <div className="row-main">
                <div className="row-title">Klucz API</div>
                <div className="row-desc">Zapisany w Keychain. Nie opuszcza tego Maca.</div>
              </div>
              <ApiKeyField
                provider={active}
                status={keys[active.id]}
                health={health?.[active.id]}
                onSaved={(status) => onKeySaved(active.id, status)}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}
