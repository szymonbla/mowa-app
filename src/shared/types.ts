import type { LanguageId } from './languages.js'
import type { ProviderId } from './providers.js'

// Zestaw dostawcow deklaruje `providers.ts`, zestaw jezykow — `languages.ts`.
// Tu tylko re-eksport, zeby reszta kodu miala jedno miejsce na typy wspolne.
export type { ProviderId, ProviderMeta } from './providers.js'
export type { LanguageId, SpokenLanguage } from './languages.js'

export interface Settings {
  shortcut: string
  provider: ProviderId
  /** Wybrany model per dostawca. Zmiana dostawcy nie gubi wyboru modelu. */
  models: Record<ProviderId, string>
  language: LanguageId
  launchAtLogin: boolean
  /** Korekta podyktowanego tekstu przez LLM. Domyslnie wlaczona. */
  cleanup: boolean
}

/** Stan klucza API widziany przez renderer. Sam klucz nigdy tu nie trafia. */
export interface KeyStatus {
  hasKey: boolean
  masked: string
}

/**
 * 'warning' = cos poszlo nie tak, ale tekst i tak sie wkleil. Osobny stan od 'error',
 * bo tam uzytkownik nie ma tekstu, a tu ma.
 */
export type OverlayState =
  | 'recording'
  | 'transcribing'
  | 'correcting'
  | 'done'
  | 'warning'
  | 'error'

export interface OverlayPayload {
  state: OverlayState
  message?: string
}

/**
 * Zgoda na Apple Events do "System Events". Osobna od Accessibility.
 * macOS nie ma cichego API do jej odczytu — 'unknown' trwa do pierwszej proby.
 */
export type AutomationStatus = 'granted' | 'denied' | 'unknown'

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'
  accessibility: boolean
  automation: AutomationStatus
}

export interface TestKeyResult {
  ok: boolean
  error?: string
}

/** Do czego prowadzi przycisk naprawy przy komunikacie bledu. */
export type ErrorFix = 'accessibility' | 'automation' | 'microphone' | 'key' | 'network'

export interface AppError {
  /** Krotki tekst do pigulki. Maks. ok. 45 znakow — dluzszy sie nie zmiesci. */
  message: string
  /** Pelna tresc bledu. Widoczna tylko w oknie ustawien. */
  detail?: string
  fix?: ErrorFix
  at: number
}

export type KeyHealthState = 'unknown' | 'checking' | 'ok' | 'invalid' | 'error'

/** Wynik ostatniego sprawdzenia klucza. 'invalid' = czerwona lampka. */
export interface KeyHealth {
  state: KeyHealthState
  message?: string
}

/** Stan diagnostyczny wypychany do okna ustawien po kazdej zmianie. */
export interface AppStatus {
  keyHealth: Record<ProviderId, KeyHealth>
  lastError: AppError | null
}
