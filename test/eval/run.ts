import { chatSpecFor, send } from '../../src/main/cleanup/chat.js'
import type { ChatSpec } from '../../src/main/cleanup/chat.js'
import { diagnose, guard } from '../../src/main/cleanup/guard.js'
import { messages } from '../../src/main/cleanup/prompt.js'
import { maxOutputTokens } from '../../src/main/cleanup/text.js'
import type { ProviderId } from '../../src/shared/types.js'
import { edits, f05 } from './align.js'
import { loadSamples } from './dataset.js'
import type { Sample } from './dataset.js'
import { judge } from './judge.js'

/**
 * Harness na zywym API — koszt i klucz, wiec `npm run eval`, nie `npm test`.
 * Klucze z env, nie z zaszyfrowanego magazynu apki (ten wymaga Electrona).
 */
const CANDIDATES: readonly { id: ProviderId; envVar: string }[] = [
  { id: 'xai', envVar: 'XAI_API_KEY' },
  { id: 'openai', envVar: 'OPENAI_API_KEY' }
]

const F05_THRESHOLD = 0.8

interface SampleResult {
  sample: Sample
  guardLayer?: string
  score: number
  passed: boolean
  error?: string
}

async function evalCorrector(
  spec: ChatSpec,
  apiKey: string,
  judgeSpec: { spec: ChatSpec; apiKey: string } | null,
  samples: readonly Sample[]
): Promise<SampleResult[]> {
  const results: SampleResult[] = []
  for (const sample of samples) {
    // Izolacja bledow per probka: przy ~24 probkach x 2 korektorow jedno 429 albo
    // timeout nie moze wywalic calego, placonego przebiegu.
    try {
      results.push(await evalSample(spec, apiKey, judgeSpec, sample))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  [blad] ${sample.id}: ${message}`)
      results.push({ sample, score: 0, passed: false, error: message })
    }
  }
  return results
}

async function evalSample(
  spec: ChatSpec,
  apiKey: string,
  judgeSpec: { spec: ChatSpec; apiKey: string } | null,
  sample: Sample
): Promise<SampleResult> {
  const raw = await send(spec, {
    apiKey,
    messages: messages(sample.input, []),
    maxTokens: maxOutputTokens(sample.input),
    signal: AbortSignal.timeout(15_000)
  })
  // `diagnose` da tekst po tym samym ksztaltowaniu co `guard`, bez blokowania oceny
  // jego progami — te progi wlasnie strojmy (ticket 07). `guard` obok, do porownania
  // z jego realnym werdyktem, tak samo liczonym, jednym zrodlem progow w guard.ts.
  const { text } = diagnose(sample.input, raw)
  const verdict = guard(sample.input, raw)

  let score: number
  let passed: boolean
  if (sample.mode === 'exact') {
    score = text.trim() === sample.reference.trim() ? 1 : 0
    passed = score === 1
  } else {
    const before = sample.input.split(/\s+/)
    score = f05(edits(before, sample.reference.split(/\s+/)), edits(before, text.split(/\s+/)))
    passed = score >= F05_THRESHOLD
  }

  if (judgeSpec) {
    const flags = await judge(judgeSpec.spec, judgeSpec.apiKey, sample.input, text)
    if (flags && (flags.addedContent || flags.reordered || flags.synonymSwap)) {
      console.log(`  [sedzia] ${sample.id}: ${JSON.stringify(flags)}`)
    }
  }

  return {
    sample,
    guardLayer: verdict.ok ? undefined : verdict.layer,
    score,
    passed
  }
}

function report(id: ProviderId, results: SampleResult[]): boolean {
  const f05Samples = results.filter((r) => r.sample.mode !== 'exact')
  const exactSamples = results.filter((r) => r.sample.mode === 'exact')
  const meanF05 = f05Samples.length
    ? f05Samples.reduce((sum, r) => sum + r.score, 0) / f05Samples.length
    : 1
  const exactPassed = exactSamples.filter((r) => r.passed).length

  console.log(`\n=== ${id} ===`)
  for (const r of results) {
    const mark = r.passed ? 'OK ' : 'FAIL'
    const guardNote = r.guardLayer ? ` (straz: ${r.guardLayer})` : ''
    const errorNote = r.error ? ` (blad wywolania: ${r.error})` : ''
    console.log(`  ${mark} ${r.sample.id} — score ${r.score.toFixed(2)}${guardNote}${errorNote}`)
  }
  console.log(`  F0.5 srednia: ${meanF05.toFixed(3)} (prog ${F05_THRESHOLD})`)
  console.log(`  twarde asercje: ${exactPassed}/${exactSamples.length}`)

  const passed = meanF05 >= F05_THRESHOLD && exactPassed === exactSamples.length
  console.log(`  wynik: ${passed ? 'PASS' : 'FAIL'}`)
  return passed
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? new URL('./samples.example.json', import.meta.url).pathname
  const samples = loadSamples(path)
  console.log(`Zestaw: ${path} (${samples.length} probek)`)

  const available = CANDIDATES.filter((c) => process.env[c.envVar])
  if (available.length === 0) {
    console.error('Brak kluczy — ustaw XAI_API_KEY i/lub OPENAI_API_KEY.')
    process.exitCode = 1
    return
  }

  let allPassed = true
  for (const candidate of available) {
    const spec = chatSpecFor(candidate.id)
    if (!spec) continue
    // Sedzia = drugi dostawca czatu, nigdy ten sam model co korektor (ticket 09).
    const other = available.find((c) => c.id !== candidate.id)
    const otherSpec = other ? chatSpecFor(other.id) : null
    const judgeSpec =
      other && otherSpec ? { spec: otherSpec, apiKey: process.env[other.envVar]! } : null

    const results = await evalCorrector(spec, process.env[candidate.envVar]!, judgeSpec, samples)
    allPassed = report(candidate.id, results) && allPassed
  }

  process.exitCode = allPassed ? 0 : 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
