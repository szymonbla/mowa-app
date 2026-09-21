import { describe, expect, it } from 'vitest'
import { isAgentApp } from '../src/main/agent-app.js'

describe('agent apps', () => {
  it('runs JEV only for selected agent applications', () => {
    expect(isAgentApp('Codex')).toBe(true)
    expect(isAgentApp('ChatGPT')).toBe(true)
    expect(isAgentApp('TextEdit')).toBe(false)
  })
})
