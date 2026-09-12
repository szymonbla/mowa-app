# 08 - Vocabulary, replacements, STT hint

## Goal

The user lists names and terms once; STT hears them better, the AI spells
them right, and fixed replacements ("mowa app" to "mowa") apply every time.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `08-vocabulary-replacements`. Depends on ticket 07 (landed), so
the nav and pane pattern for a new view is already there.

## Resume

A previous session (impl-08) paused before the first product edit. The
worktree `/home/szymon/mowa/.claude/worktrees/08-vocabulary-replacements` on
branch `t/08-vocabulary-replacements` exists and is clean at `byok`. Do not
run `git worktree add`; call `EnterWorktree` with that path, then `git rebase
byok` first since byok moved. Read the entry
"2026-09-12 - implementer - 08-vocabulary-replacements - impl-08 (paused)" in
`specs/superwhisper-byok/notes.md`: it has the verified docs URLs for the STT
hint fields (OpenAI `prompt`, xAI `keyterm`, ElevenLabs `keyterms` with its
20% surcharge) and a decided design (`vocabulary: readonly string[]` instead
of `hint`). Follow that design; do not redo the research.

## What is already known

- `prompt.ts` has a dictionary slot (`dictionarySection`) and
  `dictation-host.ts` passes `dictionary: () => []`. The prompt already says
  the dictionary is the only source of allowed substitutions.
- `guard.ts` `literals()` protects addresses and ids; replacements applied
  after the guard do not interact with it.
- STT specs: OpenAI `audio/transcriptions` accepts a `prompt` field for
  vocabulary hints; Groq and Mistral mirror the OpenAI shape (verify);
  Deepgram nova-3 has `keyterm` query params (verify); xAI and ElevenLabs:
  check docs, skip if unsupported. `TranscribeOptions` is in
  `src/main/providers/spec.ts`.
- New views follow `views.ts` + `App.tsx` + a pane file (see `HistoryPane`).
- `dictation.ts` `submit()` pastes `correction.text` or `trimmed`.

## Design

- `Settings.vocabulary: string[]` and `Settings.replacements: { from: string;
  to: string }[]`, defaults empty.
- `src/shared/replacements.ts`: `applyReplacements(text, rules)`: whole-word,
  case-insensitive match on `from` (Unicode letters), literal `to`, rules
  applied in order, no re-matching of produced text. Unit tests: word
  boundary, case, order, Polish letters.
- Pipeline: `dictation.ts` applies replacements to whatever is about to be
  pasted (corrected or raw) and logs the final text as `clean` when it
  differs. Keep it a pure step; no host method needed beyond settings.
- STT hint: `TranscribeOptions.hint?: string` = vocabulary joined with ", ".
  Each spec that supports it adds the field or query param; specs that do
  not ignore it. Tests per provider in `providers.test.ts`.
- Dictionary wiring: `dictionary: () => getSettings().vocabulary`.
- New view `dictionary` ("Slownik"): card "Slownictwo" with an input + add
  button and a removable chip list; card "Zamiany" with a two-column
  editable list (`from`, `to`) and add/remove. Patch settings on each
  change; no separate save button.

## Done when

- Vocabulary reaches the AI prompt and the STT hint; replacements apply to
  raw and corrected output (tests: prompt contains entries, STT request
  carries hint, dictation test shows replaced paste).
- The pane adds and removes entries and they persist.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No regex replacements, no per-mode vocabulary, no import/export.

## Evidence bar

Command tails, docs URLs for the hint fields, test names, landed commit
range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
