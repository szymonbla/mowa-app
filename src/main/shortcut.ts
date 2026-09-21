import { globalShortcut } from 'electron'
import type { ShortcutName } from '../shared/types.js'

/** Aktualna kombinacja per skrot. Brak wpisu = ten skrot nie jest zarejestrowany. */
const current: Partial<Record<ShortcutName, string>> = {}
let escapeBound = false

export interface RegisterResult {
  ok: boolean
  error?: string
}

/** Czy tej kombinacji uzywa juz drugi skrot mowa. System oddalby ja tylko jednemu. */
function takenByOther(name: ShortcutName, accelerator: string): boolean {
  return (Object.keys(current) as ShortcutName[]).some(
    (other) => other !== name && current[other] === accelerator
  )
}

/**
 * Rejestruje jeden z globalnych skrotow. Przy konflikcie nie ruszamy poprzedniej
 * kombinacji — uzytkownik nie moze zostac bez skrotu za jedno nieudane nacisniecie.
 */
export function registerShortcut(
  name: ShortcutName,
  accelerator: string,
  onTrigger: () => void
): RegisterResult {
  if (accelerator === current[name]) return { ok: true }
  if (takenByOther(name, accelerator)) {
    return { ok: false, error: 'Skrot juz uzywany przez mowa' }
  }

  const previous = current[name]
  if (previous) globalShortcut.unregister(previous)

  let ok = false
  try {
    ok = globalShortcut.register(accelerator, onTrigger)
  } catch {
    ok = false
  }

  if (ok) {
    current[name] = accelerator
    return { ok: true }
  }

  // Przywracamy poprzedni skrot, zeby aplikacja nie zostala bez skrotu.
  if (previous) {
    globalShortcut.register(previous, onTrigger)
    current[name] = previous
  }
  return { ok: false, error: 'Skrot zajety przez inna aplikacje' }
}

/** Esc dziala tylko w trakcie nagrywania, zeby nie blokowac go w systemie. */
export function bindCancelKey(onCancel: () => void): void {
  if (escapeBound) return
  escapeBound = globalShortcut.register('Escape', onCancel)
}

export function unbindCancelKey(): void {
  if (!escapeBound) return
  globalShortcut.unregister('Escape')
  escapeBound = false
}

export function unregisterAll(): void {
  globalShortcut.unregisterAll()
  for (const name of Object.keys(current) as ShortcutName[]) delete current[name]
  escapeBound = false
}
