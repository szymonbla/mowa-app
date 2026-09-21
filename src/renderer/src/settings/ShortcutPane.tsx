import { Glyph } from './Icon.js'
import { ShortcutRecorder } from './ShortcutRecorder.js'
import type { ShortcutName } from '../../../shared/types.js'

interface Props {
  shortcut: string
  redoShortcut: string
  onChange: (name: ShortcutName, accelerator: string) => Promise<string | null>
}

export function ShortcutPane({ shortcut, redoShortcut, onChange }: Props): React.JSX.Element {
  return (
    <>
      <div className="card">
        <div className="row">
          <Glyph name="keyboard" />
          <div className="row-main">
            <div className="row-title">Skrot dyktowania</div>
            <div className="row-desc">Kliknij pole i nacisnij kombinacje.</div>
          </div>
          <div className="row-tail">
            <ShortcutRecorder
              value={shortcut}
              onChange={(accelerator) => onChange('dictate', accelerator)}
            />
          </div>
        </div>

        <div className="row">
          <Glyph name="text" />
          <div className="row-main">
            <div className="row-title">Cofnij i powtorz</div>
            <div className="row-desc">
              Cofa ostatnie wklejenie przez Cmd+Z i od razu nagrywa. Dziala w polach tekstowych; w
              terminalu tylko nagrywa od nowa.
            </div>
          </div>
          <div className="row-tail">
            <ShortcutRecorder
              value={redoShortcut}
              onChange={(accelerator) => onChange('redo', accelerator)}
            />
          </div>
        </div>
      </div>

      <div className="group-title">Jak to dziala</div>

      <div className="card">
        <div className="row">
          <div className="row-main">
            <div className="row-title">Pierwsze nacisniecie</div>
            <div className="row-desc">Pigulka pojawia sie nad dolna krawedzia ekranu.</div>
          </div>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">Drugie nacisniecie</div>
            <div className="row-desc">Tekst wkleja sie w aktywne pole i trafia do schowka.</div>
          </div>
        </div>
        <div className="row">
          <div className="row-main">
            <div className="row-title">Esc</div>
            <div className="row-desc">Anuluje nagranie. Schowek zostaje bez zmian.</div>
          </div>
        </div>
      </div>

      <div className="note">
        Skrot musi zawierac modyfikator. Zajete kombinacje sa odrzucane — poprzedni skrot wraca.
      </div>
    </>
  )
}
