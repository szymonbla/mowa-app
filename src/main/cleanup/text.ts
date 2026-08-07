/**
 * Czysta arytmetyka korekty: co wycinamy lokalnie, jak liczymy dlugosc i ile czasu
 * dajemy modelowi. Zero sieci i zero Electrona — caly plik biegnie w tescie.
 */

/**
 * Wypelniacze wycinane regexem, zanim tekst pojdzie do modelu. Lista jest **waska
 * celowo**: "no", "znaczy", "wiesz" bywaja trescia, a raz skasowanego slowa nie ma
 * jak odzyskac. Zostaja tylko dzwieki, ktore nie sa slowem w zadnym zdaniu.
 */
const FILLER = /(?<![\p{L}\p{N}])(?:y{2,}|e{2,}|m{2,}|hm+|yhm)(?![\p{L}\p{N}])/giu

/**
 * Sufit budzetu. Twardy — powyzej tego czekanie przestaje byc oszczednoscia czasu.
 * Podloga wymuszona przez staly TTFT (~500 ms), nie wybrana. Wspolczynnik ma 10x
 * zapasu: korekta zajmuje ~2 % czasu, ktory mowiacy juz wydal na mowienie.
 */
export const BUDGET_CEILING_MS = 3000
export const BUDGET_FLOOR_MS = 1500
export const BUDGET_RATIO = 0.2

/**
 * Powyzej tego progu korekta w ogole nie startuje. Prog jest w slowach, nie
 * w sekundach, bo czas rosnie liniowo z dlugoscia wyjscia (~8–11 ms na token).
 * Pokrywa 96,6 % realnych dyktowan; reszta wychodzi surowa, ale **natychmiast**.
 * Dolnego progu nie ma — cwierc dyktowan ma ponizej 10 slow.
 */
export const MAX_WORDS = 150

export function budgetMs(speechMs: number): number {
  return Math.min(BUDGET_CEILING_MS, Math.max(BUDGET_FLOOR_MS, BUDGET_RATIO * speechMs))
}

/** Slowa liczymy wszedzie tak samo: ciagi rozdzielone bialymi znakami. */
export function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function stripFillers(text: string): string {
  return (
    text
      .replace(FILLER, '')
      // Po wycieciu zostaja sieroty: spacja przed przecinkiem, przecinek bez slowa
      // przed soba, podwojna spacja. Bez tego model dostaje tekst brzydszy niz surowy.
      .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
      .replace(/(^|[.!?]\s)\s*[,;:]\s*/g, '$1')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/[^\S\n]{2,}/g, ' ')
      .replace(/[^\S\n]+\n/g, '\n')
      .trim()
  )
}

/** Tokeny do porownan strazy: bez interpunkcji, bez wielkosci liter. */
export function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []
}

/**
 * Tokeny, ktorych model nie ma prawa tknac: adresy, e-maile, sciezki, identyfikatory.
 * Poprawna forma bywa dla czlowieka oczywista — `examply.com/ценник` kazdy odczyta
 * jako `example.com/cennik` — ale dla modulu to zgadywanie, czyli zlamanie twardego
 * ograniczenia. Straz wymaga, zeby przeszly przez korekte znak w znak.
 */
export function literals(text: string): string[] {
  const found = text.split(/\s+/).map(trimEdges).filter(isLiteral)
  return [...new Set(found)]
}

/** Nawiasy i kropka konczaca zdanie naleza do zdania, nie do adresu. */
function trimEdges(raw: string): string {
  return raw.replace(/^[("'„«]+/, '').replace(/[)"'”».,;:!?]+$/, '')
}

function isLiteral(token: string): boolean {
  if (token.length < 4) return false
  // Adres, sciezka, e-mail.
  if (/[:/@\\]/.test(token)) return true
  // Domena: cos.cos, gdzie koncowka jest literowa.
  if (/^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.\p{L}{2,}$/u.test(token)) return true
  // Identyfikator: litery i cyfry w jednym tokenie.
  return /\p{L}/u.test(token) && /\p{N}/u.test(token)
}

/**
 * Gorny limit wyjscia — bezpiecznik przeciw rozgadaniu, nie oszczednosc. Model,
 * ktory zaczyna pisac esej zamiast poprawiac, uderza w ten limit i zostaje odciety;
 * obciety wynik straz odrzuci jako skrocony. Przelicznik ~3 znaki na token dla
 * polskiego jest zgrubny i taki ma byc — to sufit, nie prognoza.
 */
export function maxOutputTokens(input: string): number {
  return Math.ceil((input.length / 3) * 1.3) + 24
}
