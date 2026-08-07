import type { LanguageId } from '../../../shared/types.js'
import { LANGUAGES } from '../../../shared/languages.js'
import type { IconName } from './Icon.js'

export type View = 'home' | 'shortcut' | 'model' | 'general'

export const NAV: { view: View; label: string; icon: IconName }[] = [
  { view: 'home', label: 'Start', icon: 'home' },
  { view: 'shortcut', label: 'Skrot', icon: 'keyboard' },
  { view: 'model', label: 'Model', icon: 'sparkle' },
  { view: 'general', label: 'Ustawienia', icon: 'sliders' }
]

export const TITLES: Record<View, { title: string; sub: string }> = {
  home: { title: 'mowa', sub: 'Dyktuj glosem w kazdej aplikacji.' },
  shortcut: { title: 'Skrot', sub: 'Klawisze, ktore wlaczaja i koncza nagrywanie.' },
  model: { title: 'Model', sub: 'Dostawca transkrypcji i klucz API.' },
  general: { title: 'Ustawienia', sub: 'Jezyk, uprawnienia i autostart.' }
}

/** Sama nazwa jezyka, bez opisu — do wiersza podsumowania na ekranie startowym. */
export const LANGUAGE_LABELS: Record<LanguageId, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.id, l.label] as const)
) as Record<LanguageId, string>
