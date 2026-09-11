/**
 * Ikony rysowane inline. Bez plikow SVG — CSP nie musi dopuszczac zewnetrznych zasobow,
 * a kolor bierze sie z `currentColor`, wiec kafle dziedzicza go z CSS.
 */

export type IconName =
  | 'home'
  | 'keyboard'
  | 'sparkle'
  | 'sliders'
  | 'mic'
  | 'key'
  | 'lock'
  | 'globe'
  | 'check'
  | 'record'
  | 'text'
  | 'clock'
  | 'search'

const PATHS: Record<IconName, React.JSX.Element> = {
  home: <path d="M2.5 7 8 2.5 13.5 7v6.5h-11z" />,
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.6" />
      <path d="M4.5 9.5h7" />
    </>
  ),
  sparkle: <path d="M8 1.6 9.3 6.7 14.4 8 9.3 9.3 8 14.4 6.7 9.3 1.6 8 6.7 6.7z" />,
  sliders: (
    <>
      <path d="M2.5 5.5h11M2.5 10.5h11" />
      <circle cx="6" cy="5.5" r="1.7" />
      <circle cx="10.5" cy="10.5" r="1.7" />
    </>
  ),
  mic: (
    <>
      <rect x="6" y="2" width="4" height="7" rx="2" />
      <path d="M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5v1.5" />
    </>
  ),
  key: (
    <>
      <circle cx="5.6" cy="5.6" r="3.1" />
      <path d="M7.8 7.8 13.2 13.2M10.4 10.9 9 12.3" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c3 3.6 3 8.4 0 12M8 2C5 5.6 5 10.4 8 14" />
    </>
  ),
  check: <path d="M3.2 8.6 6.4 11.8 12.8 4.6" />,
  record: (
    <>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.3" fill="currentColor" stroke="none" />
    </>
  ),
  text: <path d="M3 4h10M3 8h7M3 12h9" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.4 1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.2" />
      <path d="M10.2 10.2 13.5 13.5" />
    </>
  )
}

export function Icon({ name }: { name: IconName }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/**
 * Ikona wiodaca wiersza. Bez koloru — kolor niesie tylko stan, nie dekoracje.
 * Stala szerokosc trzyma tytuly w jednej linii pionowej.
 */
export function Glyph({ name }: { name: IconName }): React.JSX.Element {
  return (
    <span className="glyph">
      <Icon name={name} />
    </span>
  )
}
