import type { ErrorFix } from './types.js'

/**
 * Kazda awaria, ktora uzytkownik moze zobaczyc. Miejsce, w ktorym powstaje, opisuje
 * tylko fakty — kod HTTP, stderr, nazwe dostawcy. Tresc dla czlowieka powstaje wylacznie
 * w `describe()`, wiec pigulka, pasek w ustawieniach i lampka klucza nie moga sie rozjechac.
 */
export type Failure =
  | { kind: 'no-key'; provider: string }
  | { kind: 'microphone' }
  /** Zgoda jest, ale urzadzenia nie da sie otworzyc. */
  | { kind: 'no-input' }
  | { kind: 'not-recording' }
  | { kind: 'too-short' }
  | { kind: 'no-speech' }
  | { kind: 'provider-http'; status: number; body: string }
  /** Odpowiedz 200, ale bez pola z transkrypcja. */
  | { kind: 'provider-response' }
  | { kind: 'paste'; reason: PasteReason; detail?: string }
  | { kind: 'network'; detail?: string }
  | { kind: 'unknown'; detail?: string }

export type PasteReason = 'accessibility' | 'automation' | 'timeout' | 'unknown'

/** Awarie, ktore zglasza okno recordera. Ida przez IPC jako zwykly obiekt. */
export type RecorderFailure = Extract<
  Failure,
  { kind: 'microphone' | 'no-input' | 'not-recording' }
>

/** Tresc gotowa do pokazania: krotki komunikat, pelny szczegol, przycisk naprawy. */
export interface FailureText {
  message: string
  /** Surowe stderr z osascript albo odpowiedz dostawcy. Tylko okno ustawien. */
  detail?: string
  fix?: ErrorFix
}

/**
 * Nosnik faktow przez `throw`. `message` jest tylko dla stack trace — do UI nie trafia,
 * bo o wszystkim, co widzi uzytkownik, decyduje `describe()`.
 */
export class FailureError extends Error {
  constructor(readonly failure: Failure) {
    super(failure.kind)
    this.name = 'FailureError'
  }
}

/** Wszystko, co da sie zlapac w `catch`, sprowadzone do faktow. */
export function toFailure(err: unknown): Failure {
  if (err instanceof FailureError) return err.failure
  // fetch rzuca TypeError, gdy zadanie nie wyszlo poza maszyne.
  if (err instanceof TypeError) return { kind: 'network', detail: err.message }
  if (err instanceof Error) return { kind: 'unknown', detail: err.stack ?? err.message }
  return { kind: 'unknown', detail: String(err) }
}

/** True dla kodow, ktore znacza klucz jako zly, a nie chwilowa awarie. */
export function isKeyRejection(failure: Failure): boolean {
  return failure.kind === 'provider-http' && (failure.status === 401 || failure.status === 403)
}

/** Ile znakow miesci pigulka HUD. Jedyne miejsce, ktore o tym decyduje. */
export const PILL_MAX = 45

function short(text: string): string {
  return text.length <= PILL_MAX ? text : `${text.slice(0, PILL_MAX - 1)}…`
}

const PASTE_MESSAGES: Record<PasteReason, string> = {
  // Tekst jest juz w schowku, zanim ten blad powstanie — kazdy komunikat to mowi,
  // bo Cmd+V recznie zawsze ratuje sytuacje.
  accessibility: 'Brak zgody Accessibility — tekst w schowku',
  automation: 'Brak zgody Automatyzacja — tekst w schowku',
  timeout: 'Potwierdz monit macOS — tekst w schowku',
  unknown: 'Nie udalo sie wkleic — tekst w schowku'
}

function httpText(status: number, body: string): FailureText {
  const detail = `HTTP ${status}: ${body}`
  switch (status) {
    case 401:
    case 403:
      return { message: 'Nieprawidlowy klucz API', detail, fix: 'key' }
    case 404:
      return { message: 'Nieznany model', detail }
    case 413:
      return { message: 'Nagranie za dlugie', detail }
    case 429:
      return { message: 'Limit zapytan — poczekaj', detail }
    default:
      if (status >= 500) return { message: 'Blad serwera dostawcy', detail }
      return { message: `Blad ${status}: ${body}`, detail }
  }
}

function text(failure: Failure): FailureText {
  switch (failure.kind) {
    case 'no-key':
      return { message: `Brak klucza ${failure.provider}`, fix: 'key' }
    case 'microphone':
      return { message: 'Brak zgody na mikrofon', fix: 'microphone' }
    case 'no-input':
      return { message: 'Nie mozna otworzyc mikrofonu' }
    case 'not-recording':
      return { message: 'Nagrywanie nie bylo aktywne' }
    case 'too-short':
      return { message: 'Za krotkie nagranie' }
    case 'no-speech':
      return { message: 'Nie wykryto mowy' }
    case 'provider-http':
      return httpText(failure.status, failure.body)
    case 'provider-response':
      return { message: 'Brak transkrypcji w odpowiedzi' }
    case 'paste':
      return {
        message: PASTE_MESSAGES[failure.reason],
        detail: failure.detail,
        fix:
          failure.reason === 'accessibility' || failure.reason === 'automation'
            ? failure.reason
            : undefined
      }
    case 'network':
      return { message: 'Brak polaczenia z internetem', detail: failure.detail, fix: 'network' }
    case 'unknown':
      return { message: 'Nieznany blad', detail: failure.detail }
  }
}

/**
 * Jedyne zrodlo tresci bledow. Komunikat zawsze miesci sie w pigulce; `detail` bywa
 * dlugi i zostaje w oknie ustawien, gdzie da sie go przeczytac.
 */
export function describe(failure: Failure): FailureText {
  const described = text(failure)
  return { ...described, message: short(described.message) }
}
