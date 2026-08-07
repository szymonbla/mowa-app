import { describe as suite, expect, it } from 'vitest'
import {
  FailureError,
  PILL_MAX,
  describe,
  isKeyRejection,
  toFailure
} from '../src/shared/failure.js'
import type { Failure } from '../src/shared/failure.js'
import type { ErrorFix } from '../src/shared/types.js'

interface Case {
  name: string
  failure: Failure
  message: string
  fix?: ErrorFix
}

const CASES: Case[] = [
  { name: '401', failure: http(401), message: 'Nieprawidlowy klucz API', fix: 'key' },
  { name: '403', failure: http(403), message: 'Nieprawidlowy klucz API', fix: 'key' },
  { name: '404', failure: http(404), message: 'Nieznany model' },
  { name: '413', failure: http(413), message: 'Nagranie za dlugie' },
  { name: '429', failure: http(429), message: 'Limit zapytan — poczekaj' },
  { name: '500', failure: http(500), message: 'Blad serwera dostawcy' },
  { name: '503', failure: http(503), message: 'Blad serwera dostawcy' },
  {
    name: 'odpowiedz bez transkrypcji',
    failure: { kind: 'provider-response' },
    message: 'Brak transkrypcji w odpowiedzi'
  },
  {
    name: 'wklejanie bez Accessibility',
    failure: { kind: 'paste', reason: 'accessibility' },
    message: 'Brak zgody Accessibility — tekst w schowku',
    fix: 'accessibility'
  },
  {
    name: 'wklejanie bez Automatyzacji',
    failure: { kind: 'paste', reason: 'automation' },
    message: 'Brak zgody Automatyzacja — tekst w schowku',
    fix: 'automation'
  },
  {
    name: 'wklejanie przerwane monitem',
    failure: { kind: 'paste', reason: 'timeout' },
    message: 'Potwierdz monit macOS — tekst w schowku'
  },
  {
    name: 'wklejanie nieudane bez powodu',
    failure: { kind: 'paste', reason: 'unknown' },
    message: 'Nie udalo sie wkleic — tekst w schowku'
  },
  {
    name: 'brak sieci',
    failure: { kind: 'network' },
    message: 'Brak polaczenia z internetem',
    fix: 'network'
  },
  { name: 'nieznany blad', failure: { kind: 'unknown' }, message: 'Nieznany blad' },
  {
    name: 'brak klucza',
    failure: { kind: 'no-key', provider: 'ElevenLabs' },
    message: 'Brak klucza ElevenLabs',
    fix: 'key'
  },
  {
    name: 'brak zgody na mikrofon',
    failure: { kind: 'microphone' },
    message: 'Brak zgody na mikrofon',
    fix: 'microphone'
  },
  {
    name: 'mikrofon zajety',
    failure: { kind: 'no-input' },
    message: 'Nie mozna otworzyc mikrofonu'
  },
  {
    name: 'stop bez nagrania',
    failure: { kind: 'not-recording' },
    message: 'Nagrywanie nie bylo aktywne'
  },
  { name: 'za krotkie nagranie', failure: { kind: 'too-short' }, message: 'Za krotkie nagranie' },
  { name: 'cisza', failure: { kind: 'no-speech' }, message: 'Nie wykryto mowy' }
]

function http(status: number): Failure {
  return { kind: 'provider-http', status, body: '{"error":"nope"}' }
}

suite('describe', () => {
  for (const c of CASES) {
    it(`opisuje: ${c.name}`, () => {
      const text = describe(c.failure)
      expect(text.message).toBe(c.message)
      expect(text.fix).toBe(c.fix)
      // Dluzszy komunikat nie zmiesci sie w pigulce HUD.
      expect(text.message.length).toBeLessThanOrEqual(PILL_MAX)
    })
  }

  it('skraca komunikat, ktory nie miesci sie w pigulce', () => {
    const text = describe({ kind: 'provider-http', status: 418, body: 'x'.repeat(200) })
    expect(text.message.length).toBe(PILL_MAX)
    expect(text.message.endsWith('…')).toBe(true)
  })

  it('zostawia cala odpowiedz dostawcy w detalu', () => {
    const text = describe({ kind: 'provider-http', status: 429, body: 'rate limit exceeded' })
    expect(text.detail).toBe('HTTP 429: rate limit exceeded')
    expect(text.message).not.toContain('rate limit')
  })

  it('zostawia surowe stderr osascript w detalu', () => {
    const stderr = 'execution error: Not authorised to send Apple events (-1743)'
    const text = describe({ kind: 'paste', reason: 'automation', detail: stderr })
    expect(text.detail).toBe(stderr)
    expect(text.message).not.toContain('-1743')
  })
})

suite('toFailure', () => {
  it('przepuszcza fakty z FailureError', () => {
    const failure: Failure = { kind: 'provider-http', status: 404, body: '' }
    expect(toFailure(new FailureError(failure))).toEqual(failure)
  })

  it('traktuje TypeError jak brak sieci', () => {
    // fetch rzuca TypeError, gdy zadanie nie wyszlo poza maszyne.
    const text = describe(toFailure(new TypeError('fetch failed')))
    expect(text.message).toBe('Brak polaczenia z internetem')
    expect(text.fix).toBe('network')
    expect(text.detail).toBe('fetch failed')
  })

  it('chowa tresc zwyklego bledu w detalu', () => {
    const text = describe(toFailure(new Error('cos poszlo nie tak')))
    expect(text.message).toBe('Nieznany blad')
    expect(text.detail).toContain('cos poszlo nie tak')
  })

  it('radzi sobie z rzucona wartoscia, ktora nie jest bledem', () => {
    const text = describe(toFailure('bum'))
    expect(text.message).toBe('Nieznany blad')
    expect(text.detail).toBe('bum')
  })
})

suite('isKeyRejection', () => {
  it('lapie tylko kody, ktore znacza klucz jako zly', () => {
    expect(isKeyRejection(http(401))).toBe(true)
    expect(isKeyRejection(http(403))).toBe(true)
    expect(isKeyRejection(http(429))).toBe(false)
    expect(isKeyRejection({ kind: 'no-key', provider: 'xAI Grok' })).toBe(false)
  })
})
