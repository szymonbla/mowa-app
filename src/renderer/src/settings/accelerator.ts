/** Klawisze modyfikacji nie moga byc same skrotem. */
export const MODIFIERS = new Set(['Meta', 'Control', 'Alt', 'Shift'])

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Enter: '↩',
  Tab: '⇥',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

const MODIFIER_LABELS: Record<string, string> = {
  Command: '⌘',
  CommandOrControl: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧'
}

/** Zamienia zdarzenie klawiatury na akcelerator Electrona. */
export function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.metaKey) parts.push('Command')
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = e.code.startsWith('Key')
    ? e.code.slice(3)
    : e.code.startsWith('Digit')
      ? e.code.slice(5)
      : e.code

  if (key.startsWith('Numpad')) key = `num${key.slice(6).toLowerCase()}`
  if (MODIFIERS.has(e.key)) return null
  // Skrot bez modyfikatora przechwycilby zwykle pisanie w kazdej aplikacji.
  if (parts.length === 0) return null

  parts.push(key)
  return parts.join('+')
}

/** Rozbija akcelerator na etykiety klawiszy — jedna na kazdy klawisz. */
export function keycaps(accelerator: string): string[] {
  return accelerator.split('+').map((part) => MODIFIER_LABELS[part] ?? KEY_LABELS[part] ?? part)
}

export function pretty(accelerator: string): string {
  return keycaps(accelerator)
    .map((label) => (label === 'Space' ? '␣' : label))
    .join('')
}
