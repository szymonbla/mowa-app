import { globalShortcut } from 'electron'

let current: string | null = null
let escapeBound = false

export interface RegisterResult {
  ok: boolean
  error?: string
}

/**
 * Rejestruje skrot dyktowania. Przy konflikcie nie ruszamy poprzedniego skrotu.
 */
export function registerShortcut(accelerator: string, onTrigger: () => void): RegisterResult {
  if (accelerator === current) return { ok: true }

  const previous = current
  if (previous) globalShortcut.unregister(previous)

  let ok = false
  try {
    ok = globalShortcut.register(accelerator, onTrigger)
  } catch {
    ok = false
  }

  if (ok) {
    current = accelerator
    return { ok: true }
  }

  // Przywracamy poprzedni skrot, zeby aplikacja nie zostala bez skrotu.
  if (previous) {
    globalShortcut.register(previous, onTrigger)
    current = previous
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
  current = null
  escapeBound = false
}
