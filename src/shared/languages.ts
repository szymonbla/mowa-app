/**
 * Jezyki dyktowania. Jedyne miejsce, ktore zna ich zestaw: lista w ustawieniach,
 * `LanguageId` i jezyk podawany dostawcy powstaja z tej tablicy.
 *
 * Zestaw to 57 jezykow, ktore OpenAI wymienia jako obslugiwane przez Whisper
 * (te ponizej 50% WER). Kody ISO 639-1 wg `whisper/tokenizer.py`. Dostawcy
 * (OpenAI, xAI, ElevenLabs) przyjmuja te kody wprost.
 */

/** Ksztalt wpisu. `id` zostaje `string`, inaczej `LanguageId` odwolywalby sie do siebie. */
interface LanguageEntry {
  id: string
  label: string
  desc: string
  /** false = nie da sie go podac dostawcy; jezyk rozpoznaje sam dostawca. */
  spoken: boolean
  /** true = na gorze listy, przed separatorem. */
  pinned: boolean
}

const PINNED = [
  {
    id: 'auto',
    label: 'Auto',
    desc: 'Rozpoznawanie jezyka. W Grok bez interpunkcji.',
    spoken: false,
    pinned: true
  },
  { id: 'pl', label: 'Polski', desc: 'Wymuszony jezyk polski.', spoken: true, pinned: true },
  { id: 'en', label: 'English', desc: 'Wymuszony jezyk angielski.', spoken: true, pinned: true }
] as const satisfies readonly LanguageEntry[]

/** Jeden opis dla calej reszty — roznica jest tylko w nazwie. */
const FORCED = 'Wymuszony jezyk dyktowania.'

/**
 * Kod ISO 639-1 i nazwa jezyka w nim samym. Kolejnosc tutaj nie ma znaczenia —
 * lista sortuje sie po nazwie ponizej.
 */
const OTHERS = [
  ['af', 'Afrikaans'],
  ['ar', 'العربية'],
  ['hy', 'Հայերեն'],
  ['az', 'Azərbaycanca'],
  ['be', 'Беларуская'],
  ['bs', 'Bosanski'],
  ['bg', 'Български'],
  ['ca', 'Català'],
  ['zh', '中文'],
  ['hr', 'Hrvatski'],
  ['cs', 'Čeština'],
  ['da', 'Dansk'],
  ['nl', 'Nederlands'],
  ['et', 'Eesti'],
  ['fi', 'Suomi'],
  ['fr', 'Français'],
  ['gl', 'Galego'],
  ['de', 'Deutsch'],
  ['el', 'Ελληνικά'],
  ['he', 'עברית'],
  ['hi', 'हिन्दी'],
  ['hu', 'Magyar'],
  ['is', 'Íslenska'],
  ['id', 'Bahasa Indonesia'],
  ['it', 'Italiano'],
  ['ja', '日本語'],
  ['kn', 'ಕನ್ನಡ'],
  ['kk', 'Қазақша'],
  ['ko', '한국어'],
  ['lv', 'Latviešu'],
  ['lt', 'Lietuvių'],
  ['mk', 'Македонски'],
  ['ms', 'Bahasa Melayu'],
  ['mr', 'मराठी'],
  ['mi', 'Māori'],
  ['ne', 'नेपाली'],
  ['no', 'Norsk'],
  ['fa', 'فارسی'],
  ['pt', 'Português'],
  ['ro', 'Română'],
  ['ru', 'Русский'],
  ['sr', 'Српски'],
  ['sk', 'Slovenčina'],
  ['sl', 'Slovenščina'],
  ['es', 'Español'],
  ['sw', 'Kiswahili'],
  ['sv', 'Svenska'],
  ['tl', 'Tagalog'],
  ['ta', 'தமிழ்'],
  ['th', 'ไทย'],
  ['tr', 'Türkçe'],
  ['uk', 'Українська'],
  ['ur', 'اردو'],
  ['vi', 'Tiếng Việt'],
  ['cy', 'Cymraeg']
] as const satisfies readonly (readonly [string, string])[]

const others = OTHERS.map(([id, label]) => ({
  id,
  label,
  desc: FORCED,
  spoken: true as const,
  pinned: false as const
})).sort((a, b) => a.label.localeCompare(b.label, 'en'))

/** Najpierw przypiete (Auto, Polski, English), potem reszta po nazwie. */
export const LANGUAGES = [...PINNED, ...others] satisfies readonly LanguageEntry[]

export type LanguageId = (typeof LANGUAGES)[number]['id']

/** Jezyk, ktory wolno wyslac dostawcy. */
export type SpokenLanguage = Extract<(typeof LANGUAGES)[number], { spoken: true }>['id']

/** Undefined = nie podajemy jezyka, dostawca ma go rozpoznac sam. */
export function spokenLanguage(id: LanguageId): SpokenLanguage | undefined {
  const found = LANGUAGES.find((l) => l.id === id)
  if (!found || !found.spoken) return undefined
  return found.id
}
