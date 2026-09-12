import { fileURLToPath } from 'node:url'
import { describe as suite, expect, it } from 'vitest'
import { loadSamples } from './dataset.js'

const EXAMPLE = fileURLToPath(new URL('./samples.example.json', import.meta.url))

suite('loadSamples', () => {
  it('czyta przykladowy zestaw i uzupelnia domyslny tryb', () => {
    const samples = loadSamples(EXAMPLE)
    expect(samples.length).toBeGreaterThan(0)
    expect(samples.find((s) => s.id === 'example-noop')?.mode).toBe('exact')
    expect(samples.find((s) => s.id === 'example-punctuation')?.mode).toBe('f05')
  })

  it('rzuca, gdy probce brakuje pola', () => {
    // Format waliduje sie raz przy wczytaniu, zeby zla dana w zbiorze nie wybuchla
    // dopiero w polowie plotnego przebiegu przez API.
    expect(() => loadSamples('/dev/null')).toThrow()
  })
})
