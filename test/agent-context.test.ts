import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifyAgentContext, parseContext } from '../src/main/agent-context.js'

afterEach(() => vi.unstubAllGlobals())

describe('agent context', () => {
  it('rejects malformed model output', () => {
    expect(() => parseContext('{"intent":"delete","quality":"clear"}')).toThrow('zly status')
  })

  it('sends the dictated text to JEV on OpenRouter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { intent: { choice: 'change' }, quality: { choice: 'clear' } }
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
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-or-test' })
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: '~typesafe/jev-latest',
      state: { records: [{ id: 'message', record: 'Dodaj JEV' }] },
      questions: { intent: { type: 'choice' }, quality: { type: 'choice' } }
    })
  })
})
