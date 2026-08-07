import type { ErrorFix } from '../../../shared/types.js'

/** Pusta etykieta = nie ma czego nacisnac, zostaje sam komunikat. */
const FIX_LABELS: Record<ErrorFix, string> = {
  accessibility: 'Nadaj zgode',
  automation: 'Nadaj zgode',
  microphone: 'Nadaj zgode',
  key: 'Otworz klucz',
  network: ''
}

export interface Problem {
  /** Klucz React — takze identyfikator zrodla problemu. */
  id: string
  text: string
  /** Pelna tresc bledu: stderr z osascript albo odpowiedz dostawcy. */
  detail?: string
  fix?: ErrorFix
  onDismiss?: () => void
}

interface Props extends Problem {
  onFix: (fix: ErrorFix) => void
}

/**
 * Czerwony pasek nad trescia. Widoczny w kazdym widoku, bo problem dotyczy calej
 * aplikacji, a nie strony, na ktorej akurat jest uzytkownik.
 *
 * Pigulka HUD miesci jedno zdanie. Tutaj jest miejsce na pelna tresc bledu,
 * wiec `detail` pokazujemy w calosci — bez niego zgloszenie problemu jest zgadywanka.
 */
export function Banner({ text, detail, fix, onFix, onDismiss }: Props): React.JSX.Element {
  const label = fix ? FIX_LABELS[fix] : ''

  return (
    <div className="banner" role="alert">
      <span className="lamp" />
      <div className="banner-main">
        <div className="banner-text">{text}</div>
        {detail && <div className="banner-detail">{detail}</div>}
      </div>
      <div className="banner-tail">
        {fix && label && (
          <button className="primary" onClick={() => onFix(fix)}>
            {label}
          </button>
        )}
        {onDismiss && (
          <button className="banner-close" aria-label="Ukryj" onClick={onDismiss}>
            ×
          </button>
        )}
      </div>
    </div>
  )
}
