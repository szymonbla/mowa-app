/**
 * Korpus J2a: kazdy wiersz to jedno prawdziwe wystapienie kandydata na zamiane
 * w `~/.mowa/transkrypty.jsonl` (347 wpisow, 314 transkryptow, sierpien-wrzesien
 * 2026). Zostaly same formy. Zdania, z ktorych pochodza, to prywatna mowa
 * uzytkownika, a repo jest publiczne, wiec leza poza repo w `~/.mowa/j2a-corpus.json`.
 *
 * Zadne stwierdzenie w `test/corpus.test.ts` nie pyta o zdanie: zamiana calego
 * slowa patrzy na forme, nie na kontekst. Kontekst wchodzi tu wylacznie przez
 * etykiete `shouldApply`, ktora nadal agent - jej audyt robi sie na pliku
 * lokalnym. Pomiar: `specs/jev-decisions/notes.md`.
 */
export interface CorrectionFixture {
  /** Forma znaleziona w zdaniu i pisownia, ktora dalaby zamiana. */
  proposal: { original: string; candidate: string }
  /** Czy zamiana w zdaniu, z ktorego pochodzi ta forma, jest poprawna. */
  shouldApply: boolean
}

export const correctionCorpus: readonly CorrectionFixture[] = [
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'kronie', candidate: 'cronie' },
    shouldApply: true
  },
  {
    proposal: { original: 'flit', candidate: 'Fleet' },
    shouldApply: true
  },
  {
    proposal: { original: 'flit', candidate: 'Fleet' },
    shouldApply: true
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'piara', candidate: 'PRa' },
    shouldApply: true
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'Kodeksie', candidate: 'Codexie' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeksie', candidate: 'Codexie' },
    shouldApply: true
  },
  {
    proposal: { original: 'branczu', candidate: 'branchu' },
    shouldApply: true
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'dżid', candidate: 'JID' },
    shouldApply: true
  },
  {
    proposal: { original: 'dżidów', candidate: 'JIDów' },
    shouldApply: true
  },
  {
    proposal: { original: 'dżidów', candidate: 'JIDów' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeks', candidate: 'Codex' },
    shouldApply: true
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'branczach', candidate: 'branchach' },
    shouldApply: true
  },
  {
    proposal: { original: 'grochbot', candidate: 'Grokbot' },
    shouldApply: true
  },
  {
    proposal: { original: 'grochbota', candidate: 'Grokbota' },
    shouldApply: true
  },
  {
    proposal: { original: 'grochbota', candidate: 'Grokbota' },
    shouldApply: true
  },
  {
    proposal: { original: 'bardzo', candidate: 'boardzo' },
    shouldApply: false
  },
  {
    proposal: { original: 'Potato', candidate: 'poteto' },
    shouldApply: true
  },
  {
    proposal: { original: 'brancza', candidate: 'brancha' },
    shouldApply: true
  },
  {
    proposal: { original: 'brancza', candidate: 'brancha' },
    shouldApply: true
  },
  {
    proposal: { original: 'Light LLM', candidate: 'LiteLLM' },
    shouldApply: true
  },
  {
    proposal: { original: 'kursor', candidate: 'Cursor' },
    shouldApply: true
  },
  {
    proposal: { original: 'weryfajera', candidate: 'verifiera' },
    shouldApply: true
  },
  {
    proposal: { original: 'promty', candidate: 'prompty' },
    shouldApply: true
  },
  {
    proposal: { original: 'Barda', candidate: 'boarda' },
    shouldApply: true
  },
  {
    proposal: { original: 'klaudach', candidate: 'Claudeach' },
    shouldApply: false
  },
  {
    proposal: { original: 'Kodeksie', candidate: 'Codexie' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeksem', candidate: 'Codexem' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeksie', candidate: 'Codexie' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeksem', candidate: 'Codexem' },
    shouldApply: true
  },
  {
    proposal: { original: 'Potato', candidate: 'poteto' },
    shouldApply: true
  },
  {
    proposal: { original: 'kodeksa', candidate: 'Codexa' },
    shouldApply: true
  },
  {
    proposal: { original: 'Potato', candidate: 'poteto' },
    shouldApply: true
  }
]
