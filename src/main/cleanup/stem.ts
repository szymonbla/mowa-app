import { polish } from 'multilingual-stemmer'

/**
 * Rdzeniowanie polskie dla strazy. Bez niego fleksja daje falszywe alarmy:
 * "ksiazke" poprawione na "ksiazke" to ten sam wyraz, a porownanie znak w znak
 * widzi dwa rozne tokeny.
 *
 * Snowball (WASM, MIT). **Nie brac `natural`** — jego polski stemmer to zaslepka
 * zwracajaca token bez zmian. Zaden stemmer nie zwija czasownikow do jednej formy
 * ("poprawiac" → "poprawi", "poprawil" → "popraw"), wiec prog pokrycia musi zostawic
 * na to margines.
 */
export function stem(token: string): string {
  if (!token) return token
  return polish(fold(token))
}

/**
 * Znaki diakrytyczne znikaja przed rdzeniowaniem, bo **ich dodanie jest korekta**:
 * STT oddaje "mysle", model zwraca "myślę" i to jest wynik poprawny. Straz, ktora
 * liczylaby te dwa tokeny jako rozne, karalaby modul za robote, o ktora prosi.
 * Obie strony przechodza przez to samo zwiniecie, wiec porownanie zostaje uczciwe.
 */
function fold(token: string): string {
  return token
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}
