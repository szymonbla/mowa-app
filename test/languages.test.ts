import { describe as suite, expect, it } from 'vitest'
import { LANGUAGES, spokenLanguage } from '../src/shared/languages.js'

suite('katalog jezykow', () => {
  it('ma Auto, Polski i English przypiete na gorze, w tej kolejnosci', () => {
    const pinned = LANGUAGES.filter((l) => l.pinned)
    expect(pinned.map((l) => l.id)).toEqual(['auto', 'pl', 'en'])
    expect(LANGUAGES.slice(0, 3)).toEqual(pinned)
  })

  it('kazdy id poza auto to dwuliterowy kod ISO 639-1', () => {
    for (const l of LANGUAGES) {
      if (l.id === 'auto') continue
      expect(l.id, l.label).toMatch(/^[a-z]{2}$/)
    }
  })

  it('id sie nie powtarzaja', () => {
    const ids = LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('obejmuje 57 jezykow Whisper plus Auto', () => {
    expect(LANGUAGES).toHaveLength(58)
  })

  it('reszta jest posortowana po nazwie', () => {
    const labels = LANGUAGES.filter((l) => !l.pinned).map((l) => l.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'en'))
    expect(labels).toEqual(sorted)
  })

  it('kazdy jezyk poza Auto ma nazwe i wspolny opis', () => {
    for (const l of LANGUAGES) {
      expect(l.label.length, l.id).toBeGreaterThan(0)
      if (!l.pinned) expect(l.desc).toBe(LANGUAGES[3].desc)
    }
  })

  it('spokenLanguage oddaje kod dla jezyka nieprzypietego, undefined dla auto', () => {
    expect(spokenLanguage('cy')).toBe('cy')
    expect(spokenLanguage('auto')).toBeUndefined()
  })
})
