import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyAgentContext, parseContext, withAgentContext } from '../src/main/agent-context.js'

afterEach(() => vi.unstubAllGlobals())

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

  it('sends the dictated text to JEV on OpenRouter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"intent":"change","quality":"clear"}' } }]
          })
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(classifyAgentContext('Dodaj JEV', 'sk-or-test')).resolves.toEqual({
      intent: 'change',
      quality: 'clear'
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-or-test' })
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: '~typesafe/jev-latest',
      messages: [{ role: 'system' }, { role: 'user', content: 'Dodaj JEV' }]
    })
  })
})
