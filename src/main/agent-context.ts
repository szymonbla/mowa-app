export type AgentIntent = 'change' | 'question' | 'idea' | 'note' | 'unclear'
export type AgentQuality = 'clear' | 'uncertain' | 'mixed-language'

export interface AgentContext {
  intent: AgentIntent
  quality: AgentQuality
}

const MODEL = '~typesafe/jev-latest'
const URL = 'https://openrouter.ai/api/v1/chat/completions'

const SYSTEM = `Classify a voice message for a coding agent. The speaker mainly uses Polish; English technical names, code, commands, and product names are normal. Do not rewrite or summarize the message. Return JSON only. intent is change, question, idea, note, or unclear. quality is clear, uncertain, or mixed-language.`

export async function classifyAgentContext(text: string, apiKey: string): Promise<AgentContext> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 30
    }),
    signal: AbortSignal.timeout(700)
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const json = (await res.json()) as { choices?: { message?: { content?: unknown } }[] }
  const content = json.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('OpenRouter: brak klasyfikacji')
  return parseContext(content)
}

export function parseContext(content: string): AgentContext {
  const value = JSON.parse(content) as Partial<AgentContext>
  if (!isIntent(value.intent) || !isQuality(value.quality))
    throw new Error('OpenRouter: zly status')
  return { intent: value.intent, quality: value.quality }
}

export function withAgentContext(text: string, context: AgentContext | null): string {
  if (!context) return text
  return `[voice: ${context.intent} | ${context.quality}]\n\n${text}`
}

function isIntent(value: unknown): value is AgentIntent {
  return ['change', 'question', 'idea', 'note', 'unclear'].includes(value as string)
}

function isQuality(value: unknown): value is AgentQuality {
  return ['clear', 'uncertain', 'mixed-language'].includes(value as string)
}
