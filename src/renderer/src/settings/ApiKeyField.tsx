import { useState } from 'react'
import type { KeyHealth, KeyStatus, ProviderMeta } from '../../../shared/types.js'

interface Props {
  provider: ProviderMeta
  status: KeyStatus
  /** Stan z main. Sprawdzenie startuje takze bez przycisku Test. */
  health: KeyHealth | undefined
  onSaved: (status: KeyStatus) => void
}

export function ApiKeyField({ provider, status, health, onSaved }: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(!status.hasKey)

  const save = async (): Promise<void> => {
    const next = await window.api.setKey(provider.id, draft)
    setDraft('')
    setEditing(false)
    onSaved(next)
  }

  const clear = async (): Promise<void> => {
    const next = await window.api.setKey(provider.id, '')
    setEditing(true)
    onSaved(next)
  }

  const checking = health?.state === 'checking'

  return (
    <div className="key-block">
      <div className="key-field">
        {editing ? (
          <>
            <input
              type="password"
              value={draft}
              placeholder={provider.keyHint}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draft.trim()) void save()
              }}
            />
            <button className="primary" disabled={!draft.trim()} onClick={() => void save()}>
              Zapisz
            </button>
          </>
        ) : (
          <>
            <span className="key-set">{status.masked}</span>
            <button onClick={() => void window.api.testKey(provider.id)} disabled={checking}>
              {checking ? '…' : 'Test'}
            </button>
            <button onClick={() => void clear()}>Zmien</button>
          </>
        )}
      </div>

      {/* Wynik jest wspolny z lampkami w reszcie okna — jedno zrodlo prawdy. */}
      {!editing && health?.state === 'ok' && <div className="hint">✓ Klucz dziala</div>}
      {!editing && health?.state === 'invalid' && (
        <div className="error">{health.message ?? 'Nieprawidlowy klucz API'}</div>
      )}
      {!editing && health?.state === 'error' && (
        <div className="hint">Nie udalo sie sprawdzic: {health.message}</div>
      )}

      <button className="link" onClick={() => void window.api.openExternal(provider.keysUrl)}>
        Pobierz klucz {provider.label} ↗
      </button>
    </div>
  )
}
