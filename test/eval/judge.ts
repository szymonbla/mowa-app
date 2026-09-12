import type { ChatSpec, SendOptions } from '../../src/main/cleanup/chat.js'
import { send } from '../../src/main/cleanup/chat.js'

/**
 * Sedzia LLM, waski celowo (ticket 09): nie "czy lepsze" — to premiuje styl sedziego.
 * Trzy pytania binarne, oryginal plus wyjscie, bez referencji. Zebrane w jedno
 * zadanie zamiast trzech, zeby nie potroic kosztu API na kazda probke.
 */
export interface JudgeFlags {
  addedContent: boolean
  reordered: boolean
  synonymSwap: boolean
}

const INSTRUCTION = `Dostajesz oryginalny tekst i wyjscie modulu korekty. Nie oceniasz stylu ani tego,
czy wyjscie jest "lepsze". Odpowiadasz na trzy pytania tak/nie, kazde niezaleznie:

1. addedContent: czy wyjscie zawiera tresc, ktorej nie bylo w oryginale (np. odpowiedz na
   pytanie z oryginalu zamiast jego poprawy)?
2. reordered: czy szyk zdania zostal zmieniony wzgledem oryginalu (nie licz przestawienia
   wymuszonego przez interpunkcje)?
3. synonymSwap: czy jakies slowo zostalo zamienione na inne o podobnym znaczeniu, zamiast
   zostac takie samo?

Odpowiedz WYLACZNIE jednym JSON-em, bez niczego dookola:
{"addedContent": bool, "reordered": bool, "synonymSwap": bool}`

export async function judge(
  spec: ChatSpec,
  apiKey: string,
  original: string,
  output: string
): Promise<JudgeFlags | null> {
  const opts: SendOptions = {
    apiKey,
    messages: [
      { role: 'system', content: INSTRUCTION },
      { role: 'user', content: `ORYGINAL:\n${original}\n\nWYJSCIE:\n${output}` }
    ],
    maxTokens: 100,
    signal: AbortSignal.timeout(10_000)
  }
  const raw = await send(spec, opts)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  const parsed: unknown = JSON.parse(match[0])
  const flags = parsed as Partial<JudgeFlags>
  if (
    typeof flags.addedContent !== 'boolean' ||
    typeof flags.reordered !== 'boolean' ||
    typeof flags.synonymSwap !== 'boolean'
  ) {
    return null
  }
  return {
    addedContent: flags.addedContent,
    reordered: flags.reordered,
    synonymSwap: flags.synonymSwap
  }
}
