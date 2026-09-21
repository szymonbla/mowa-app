import { beforeEach, describe as suite, expect, it, vi } from 'vitest'
import { registerShortcut, unregisterAll } from '../src/main/shortcut.js'

/**
 * Atrapa `globalShortcut`. Pamieta, co jest zarejestrowane, i potrafi odmowic —
 * tylko na tym polega caly modul: co system przyjal i co zostaje czynne po odmowie.
 */
const stan = vi.hoisted(() => ({
  /** Kombinacje trzymane przez inna aplikacje. Rejestracja takiej sie nie udaje. */
  zajete: new Set<string>(),
  zarejestrowane: [] as string[]
}))

vi.mock('electron', () => ({
  globalShortcut: {
    register: (accelerator: string): boolean => {
      if (stan.zajete.has(accelerator)) return false
      stan.zarejestrowane.push(accelerator)
      return true
    },
    unregister: (accelerator: string): void => {
      stan.zarejestrowane = stan.zarejestrowane.filter((a) => a !== accelerator)
    },
    unregisterAll: (): void => {
      stan.zarejestrowane = []
    }
  }
}))

const noop = (): void => {}

suite('skroty globalne', () => {
  beforeEach(() => {
    // Modul trzyma stan przez caly proces — kazdy test zaczyna bez skrotow.
    unregisterAll()
    stan.zajete.clear()
    stan.zarejestrowane = []
  })

  it('trzyma dwa skroty osobno', () => {
    expect(registerShortcut('dictate', 'Alt+Space', noop)).toEqual({ ok: true })
    expect(registerShortcut('redo', 'Alt+Shift+Space', noop)).toEqual({ ok: true })
    expect(stan.zarejestrowane).toEqual(['Alt+Space', 'Alt+Shift+Space'])
  })

  it('zmiana skrotu zwalnia poprzednia kombinacje', () => {
    registerShortcut('dictate', 'Alt+Space', noop)

    expect(registerShortcut('dictate', 'Alt+Q', noop)).toEqual({ ok: true })
    expect(stan.zarejestrowane).toEqual(['Alt+Q'])
  })

  it('odrzuca kombinacje, ktorej uzywa drugi skrot mowa', () => {
    registerShortcut('dictate', 'Alt+Space', noop)
    registerShortcut('redo', 'Alt+Shift+Space', noop)

    expect(registerShortcut('redo', 'Alt+Space', noop)).toEqual({
      ok: false,
      error: 'Skrot juz uzywany przez mowa'
    })
    // Zaden z dwoch skrotow nie moze przy tym przepasc.
    expect(stan.zarejestrowane).toEqual(['Alt+Space', 'Alt+Shift+Space'])
  })

  it('przy konflikcie z inna aplikacja wraca poprzedni skrot', () => {
    registerShortcut('dictate', 'Alt+Space', noop)
    stan.zajete.add('Control+Space')

    expect(registerShortcut('dictate', 'Control+Space', noop)).toEqual({
      ok: false,
      error: 'Skrot zajety przez inna aplikacje'
    })
    expect(stan.zarejestrowane).toEqual(['Alt+Space'])
  })
})
