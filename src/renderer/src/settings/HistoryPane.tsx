import { useCallback, useEffect, useState } from 'react'
import type { Outcome, TranscriptEntry } from '../../../shared/types.js'
import { Glyph } from './Icon.js'

interface Props {
  /** `settings.transcripts` — czy nowe dyktowania w ogole trafiaja do logu. */
  enabled: boolean
  onEnable: () => void
}

/**
 * Dlaczego kolumna "Poprawiony" jest pusta. `pending` to brak domkniecia: korekta
 * jeszcze trwa albo proces padl. Tekst mowi, czy warto czekac.
 */
const EMPTY_CLEAN: Record<Outcome | 'pending', string> = {
  pending: 'Korekta w toku albo przerwana.',
  corrected: '',
  off: 'Korekta byla wylaczona.',
  'skip:too-long': 'Za dlugie na korekte.',
  'skip:no-corrector': 'Brak modelu do korekty.',
  'skip:nothing': 'Nie bylo czego poprawiac.',
  'fail:budget': 'Korekta przekroczyla limit czasu.',
  'fail:guard': 'Korekta odrzucona — zmienilaby tresc.',
  'fail:provider': 'Dostawca odrzucil korekte.',
  'fail:network': 'Korekta nie doszla — brak sieci.'
}

const WHEN = new Intl.DateTimeFormat('pl-PL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : WHEN.format(date)
}

/** Pokazujemy to, co trafilo do aplikacji: poprawiony, a gdy go nie ma — surowy. */
function shown(entry: TranscriptEntry): string {
  return entry.clean || entry.raw
}

function matches(entry: TranscriptEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return entry.raw.toLowerCase().includes(q) || entry.clean.toLowerCase().includes(q)
}

export function HistoryPane({ enabled, onEnable }: Props): React.JSX.Element {
  const [entries, setEntries] = useState<TranscriptEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  // Potwierdzenie robi sam przycisk — okno dialogowe zablokowaloby renderera.
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  // Schowek nie daje zadnego sygnalu; podpis na przycisku zastepuje go na chwile.
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setEntries(await window.api.listTranscripts())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 1200)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async (key: string, text: string): Promise<void> => {
    await window.api.copyText(text)
    setCopied(key)
  }

  const remove = async (id: string): Promise<void> => {
    await window.api.deleteTranscript(id)
    setConfirmDelete(null)
    if (open === id) setOpen(null)
    await load()
  }

  const clear = async (): Promise<void> => {
    await window.api.clearTranscripts()
    setConfirmClear(false)
    setOpen(null)
    await load()
  }

  const visible = (entries ?? []).filter((e) => matches(e, query))

  return (
    <>
      {!enabled && (
        <div className="card history-off">
          <div className="row">
            <Glyph name="record" />
            <div className="row-main">
              <div className="row-title">Zapis transkryptow jest wylaczony</div>
              <div className="row-desc">
                Nowe dyktowania nie trafiaja do historii. Ponizej widac tylko te sprzed wylaczenia.
              </div>
            </div>
            <div className="row-tail">
              <button
                className="switch"
                data-on={false}
                role="switch"
                aria-checked={false}
                aria-label="Zapisuj transkrypty na dysku"
                onClick={onEnable}
              />
            </div>
          </div>
        </div>
      )}

      <div className="history-bar">
        <label className="history-search">
          <Glyph name="search" />
          <input
            type="text"
            placeholder="Szukaj w tekscie"
            aria-label="Szukaj w historii"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button onClick={() => void load()}>Odswiez</button>
        {confirmClear ? (
          <button className="primary" onClick={() => void clear()}>
            Na pewno?
          </button>
        ) : (
          <button disabled={!entries?.length} onClick={() => setConfirmClear(true)}>
            Wyczysc
          </button>
        )}
      </div>

      <div className="card">
        {entries === null ? (
          <div className="row history-empty">Wczytywanie…</div>
        ) : visible.length === 0 ? (
          <div className="row history-empty">
            {entries.length === 0 ? 'Historia jest pusta.' : 'Nic nie pasuje do wyszukiwania.'}
          </div>
        ) : (
          visible.map((entry) => {
            const isOpen = open === entry.id
            return (
              <div key={entry.id} className="history-item">
                <button
                  className="row history-row"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : entry.id)
                    setConfirmDelete(null)
                  }}
                >
                  <div className="row-main">
                    <div className="history-text">{shown(entry)}</div>
                    <div className="row-desc history-meta">
                      {when(entry.t)} · {entry.words} slow · {entry.lang}
                      {entry.outcome === null && ' · bez korekty'}
                    </div>
                  </div>
                  <span className="chevron">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="history-detail">
                    <div className="history-cols">
                      <div className="history-col">
                        <div className="history-col-head">
                          <span>Surowy</span>
                          <button
                            className="link"
                            onClick={() => void copy(`${entry.id}:raw`, entry.raw)}
                          >
                            {copied === `${entry.id}:raw` ? 'Skopiowano' : 'Kopiuj'}
                          </button>
                        </div>
                        <div className="history-body">{entry.raw}</div>
                      </div>
                      <div className="history-col">
                        <div className="history-col-head">
                          <span>Poprawiony</span>
                          {entry.clean && (
                            <button
                              className="link"
                              onClick={() => void copy(`${entry.id}:clean`, entry.clean)}
                            >
                              {copied === `${entry.id}:clean` ? 'Skopiowano' : 'Kopiuj'}
                            </button>
                          )}
                        </div>
                        {entry.clean ? (
                          <div className="history-body">{entry.clean}</div>
                        ) : (
                          <div className="history-body dim">
                            {EMPTY_CLEAN[entry.outcome ?? 'pending']}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="history-actions">
                      {confirmDelete === entry.id ? (
                        <button className="primary" onClick={() => void remove(entry.id)}>
                          Na pewno?
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(entry.id)}>Usun</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="note">
        Historia to plik <code>~/.mowa/transkrypty.jsonl</code>. Nic go nie kasuje samo.{' '}
        <button className="link inline" onClick={() => void window.api.showTranscripts()}>
          Pokaz plik
        </button>
      </p>
    </>
  )
}
