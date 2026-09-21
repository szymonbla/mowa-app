import { applyReplacements } from '../shared/replacements.js'
import { correctText } from './text-correction.js'
import type { CorrectionLog } from './text-correction.js'
import type { Replacement } from '../shared/types.js'

export interface RefineOptions {
  correction: boolean
  apiKey: string | null
  model: string
  vocabulary: readonly string[]
  replacements: readonly Replacement[]
}

export interface RefineResult {
  text: string
  log: CorrectionLog
}

/**
 * Wszystko, co dzieje sie z tekstem miedzy STT a wklejeniem: zamiany → korekta → zamiany.
 * Drugi przebieg zamian dotyczy juz tekstu modelu, a skaner nie wraca do tego, co sam
 * wyprodukowal — wiec jest darmowy. Funkcja nie rzuca: kazda awaria oddaje tekst sprzed korekty.
 */
export async function refine(text: string, options: RefineOptions): Promise<RefineResult> {
  const replaced = applyReplacements(text, options.replacements)
  if (!options.correction) return { text: replaced, log: { status: 'off' } }
  if (!options.apiKey) {
    return {
      text: replaced,
      log: { status: 'unavailable', stage: 'correct', reason: 'brak klucza' }
    }
  }
  // Pole modelu mozna wyczyscic w ustawieniach. Puste znaczy 400 od OpenRoutera, wiec
  // nie ma po co wychodzic w siec — w logu ma stac powod, nie kod HTTP.
  if (!options.model.trim()) {
    return {
      text: replaced,
      log: { status: 'unavailable', stage: 'correct', reason: 'brak modelu' }
    }
  }

  const corrected = await correctText(replaced, {
    apiKey: options.apiKey,
    model: options.model,
    // Korekta nie ma prawa cofnac zamiany: jej wynik jest chroniony tak samo jak slownik.
    vocabulary: [...options.vocabulary, ...options.replacements.map((rule) => rule.to)]
  })
  return { text: applyReplacements(corrected.text, options.replacements), log: corrected.log }
}
