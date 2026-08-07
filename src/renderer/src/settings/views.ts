import type { LanguageId } from '../../../shared/types.js'
import type { IconName } from './Icon.js'

export type View = 'home' | 'shortcut' | 'model' | 'general'

export const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Start', icon: 'home' },
  { view: 'shortcut', label: 'Skrot', icon: 'keyboard' },
  { view: 'model', label: 'Model', icon: 'sparkle' },
  { view: 'general', label: 'Ustawienia', icon: 'sliders' }
]

export const TITLES: Record<View, { title: string; sub: string }> = {
  home: { title: 'SimpleWhisper', sub: 'Dyktuj glosem w kazdej aplikacji.' },
  shortcut: { title: 'Skrot', sub: 'Klawisze, ktore wlaczaja i koncza nagrywanie.' },
  model: { title: 'Model', sub: 'Dostawca transkrypcji i klucz API.' },
  general: { title: 'Ustawienia', sub: 'Jezyk, uprawnienia i autostart.' }
}

export const LANGUAGES: { id: LanguageId; label: string; desc: string }[] = [
  { id: 'pl', label: 'Polski', desc: 'Wymuszony jezyk polski.' },
  { id: 'en', label: 'English', desc: 'Wymuszony jezyk angielski.' },
  { id: 'auto', label: 'Auto', desc: 'Rozpoznawanie jezyka. W Grok bez interpunkcji.' }
]

export const LANGUAGE_LABELS: Record<LanguageId, string> = {
  pl: 'Polski',
  en: 'English',
  auto: 'Auto'
}
