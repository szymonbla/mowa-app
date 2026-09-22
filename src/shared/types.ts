import type { LanguageId } from './languages.js'
import type { ProviderId } from './providers.js'

// Zestaw dostawcow deklaruje `providers.ts`, zestaw jezykow — `languages.ts`.
// Tu tylko re-eksport, zeby reszta kodu miala jedno miejsce na typy wspolne.
export type { ProviderId, ProviderMeta } from './providers.js'
export type { LanguageId, SpokenLanguage } from './languages.js'

/** Dwa skroty globalne: dyktowanie i „cofnij i powtorz". */
export type ShortcutName = 'dictate' | 'redo'

/** Co dyktowanie robi z gotowym tekstem. 'clipboard' = bez Cmd+V, wklejasz sam. */
export type PasteMode = 'paste' | 'clipboard'

/** Jedna celowa zamiana po transkrypcji. To nie jest regex ani instrukcja dla AI. */
export interface Replacement {
  from: string
  to: string
}

export interface Settings {
  shortcut: string
  /** Cofa ostatnie wklejenie przez Cmd+Z i od razu nagrywa od nowa. */
  redoShortcut: string
  provider: ProviderId
  /** Wybrany model per dostawca. Zmiana dostawcy nie gubi wyboru modelu. */
  models: Record<ProviderId, string>
  language: LanguageId
  launchAtLogin: boolean
  /** Opcjonalny zapis surowych transkrypcji na dysku. */
  transcripts: boolean
  /** Wysyla tekst do korekty przed wklejeniem. Awaria zawsze zostawia surowy tekst. */
  textCorrection: boolean
  /** Model OpenRouter do korekty. Wlasny wybor, bo koszt i styl sa decyzja uzytkownika. */
  correctionModel: string
  /** Nazwy i terminy przekazywane do STT oraz chronione podczas korekty AI. */
  vocabulary: string[]
  /** Pewne, lokalne poprawki stosowane po STT i po korekcie AI. */
  replacements: Replacement[]
  /** Czy po udanym wklejeniu schowek wraca do poprzedniej zawartosci. */
  restoreClipboard: boolean
  pasteMode: PasteMode
}

/** Stan klucza API widziany przez renderer. Sam klucz nigdy tu nie trafia. */
export interface KeyStatus {
  hasKey: boolean
  masked: string
}

/**
 * 'starting' to czas, w ktorym mikrofon dopiero sie otwiera. Bez tego stanu pigulka
 * zapraszala do mowienia, zanim urzadzenie oddalo pierwsza probke.
 */
export type OverlayState = 'starting' | 'recording' | 'transcribing' | 'done' | 'error'

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
export type ErrorFix =
  | 'accessibility'
  | 'automation'
  | 'microphone'
  | 'key'
  | 'network'
  /** Powtarza zapamietane nagranie — jedyna naprawa, ktora nie wymaga uzytkownika. */
  | 'retry'

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
