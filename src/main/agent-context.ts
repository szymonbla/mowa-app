export type AgentIntent = 'change' | 'question' | 'idea' | 'note' | 'unclear'
export type AgentQuality = 'clear' | 'uncertain' | 'mixed-language'

export interface AgentContext {
  intent: AgentIntent
  quality: AgentQuality
}

export type AgentContextLog =
  | { status: 'classified'; intent: AgentIntent; quality: AgentQuality }
  | { status: 'unavailable' | 'failed' }

const MODEL = '~typesafe/jev-latest'
const URL = 'https://openrouter.ai/api/alpha/decisions'

export async function classifyAgentContext(text: string, apiKey: string): Promise<AgentContext> {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: {
        description: 'One dictated message for a coding agent.',
        records: [{ id: 'message', record: text }]
      },
      questions: {
        intent: {
          type: 'choice',
          instructions:
            'Classify the intent of record. Polish with English technical terms is normal.',
          criteria: {
            change: 'Asks the agent to change code, configuration, or behavior.',
            question: 'Asks for an answer or explanation.',
            idea: 'Suggests or explores a possible future direction.',
            note: 'Provides information without asking for action.',
            unclear: 'The intent cannot be determined from the record.'
          }
        },
        quality: {
          type: 'choice',
          instructions: 'Assess whether record can be understood reliably by a coding agent.',
          criteria: {
            clear: 'The meaning is clear.',
            uncertain: 'Part of the meaning is missing or ambiguous.',
            'mixed-language': 'The meaning is clear but mixes Polish with English technical terms.'
          }
        }
      }
    }),
    signal: AbortSignal.timeout(700)
  })
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`)
  const json = (await res.json()) as {
    answers?: { intent?: { choice?: unknown }; quality?: { choice?: unknown } }
  }
  return parseContext(
    JSON.stringify({ intent: json.answers?.intent?.choice, quality: json.answers?.quality?.choice })
  )
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
