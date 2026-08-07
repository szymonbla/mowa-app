/**
 * Jezyki dyktowania. Jedyne miejsce, ktore zna ich zestaw: lista w ustawieniach,
 * `LanguageId` i jezyk podawany dostawcy powstaja z tej tablicy.
 */

/** Ksztalt wpisu. `id` zostaje `string`, inaczej `LanguageId` odwolywalby sie do siebie. */
interface LanguageEntry {
  id: string
  label: string
  desc: string
  /** false = nie da sie go podac dostawcy; jezyk rozpoznaje sam dostawca. */
  spoken: boolean
}

export const LANGUAGES = [
  { id: 'pl', label: 'Polski', desc: 'Wymuszony jezyk polski.', spoken: true },
  { id: 'en', label: 'English', desc: 'Wymuszony jezyk angielski.', spoken: true },
  {
    id: 'auto',
    label: 'Auto',
    desc: 'Rozpoznawanie jezyka. W Grok bez interpunkcji.',
    spoken: false
  }
] as const satisfies readonly LanguageEntry[]

export type LanguageId = (typeof LANGUAGES)[number]['id']

/** Jezyk, ktory wolno wyslac dostawcy. */
export type SpokenLanguage = Extract<(typeof LANGUAGES)[number], { spoken: true }>['id']

/** Undefined = nie podajemy jezyka, dostawca ma go rozpoznac sam. */
export function spokenLanguage(id: LanguageId): SpokenLanguage | undefined {
  const found = LANGUAGES.find((l) => l.id === id)
  if (!found || !found.spoken) return undefined
  return found.id
}
