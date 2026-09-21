import { describe, expect, it } from 'vitest'
import { parseContext, withAgentContext } from '../src/main/agent-context.js'

describe('agent context', () => {
  it('adds a compact header without changing dictated text', () => {
    expect(withAgentContext('Dodaj JEV', { intent: 'change', quality: 'mixed-language' })).toBe(
      '[voice: change | mixed-language]\n\nDodaj JEV'
    )
  })

  it('keeps raw text when no classification arrives', () => {
    expect(withAgentContext('Dodaj JEV', null)).toBe('Dodaj JEV')
  })

  it('rejects malformed model output', () => {
    expect(() => parseContext('{"intent":"delete","quality":"clear"}')).toThrow('zly status')
  })
})
