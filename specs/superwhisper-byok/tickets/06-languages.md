# 06 - Full language list

## Goal

The user picks any language Whisper-class models support, not only Polish,
English and Auto.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `06-languages`.

## Resume

A previous session started this ticket and was stopped. Its work is in the
worktree `/home/szymon/mowa/.claude/worktrees/06-languages` on branch
`t/06-languages` (zero commits on top of `byok`, uncommitted changes):

- `src/shared/languages.ts`: about 88 lines added, the wider list.
- `test/languages.test.ts`: new, untracked.

Do not run `git worktree add`; call `EnterWorktree` with that path, read
`git diff` and the new test, keep what matches the Design and commit it
before you continue with the select grouping and provider tests.

## What is already known

- `src/shared/languages.ts` is the only catalog: `LANGUAGES` const array,
  `LanguageId`, `SpokenLanguage`, `spokenLanguage(id)`. Three entries today.
- `GeneralPane.tsx` renders a `<select>` from `LANGUAGES`; `views.ts` derives
  `LANGUAGE_LABELS`; `HomePane` shows the label.
- STT specs in `src/main/providers/spec.ts` pass the id as `language`
  (xAI, OpenAI) or `language_code` (ElevenLabs). ElevenLabs accepts ISO 639-1
  and ISO 639-3 per its docs; verify before relying on it.
- `test/providers.test.ts` checks the fields each provider sends.
- Transcripts log stores `lang: LanguageId` per entry.

## Design

- Replace the list with the OpenAI Whisper language set (about 57 ISO 639-1
  codes; fetch the list from the OpenAI speech-to-text docs and note the URL).
  Keep `auto` first with its current description, then `pl` and `en` pinned
  at the top, then the rest sorted by label.
- Labels are the language's own name ("Deutsch", "Espanol" is fine without
  diacritics to match the rest of the UI, or with diacritics if the select
  renders them; pick one and be consistent). `desc` for non-pinned languages
  can be a single shared sentence.
- Do not widen `LanguageId` to `string`; keep it derived from the array.
- Group the select: pinned entries, a separator, the rest. Plain `<optgroup>`
  is enough.

## Done when

- Every listed language is selectable, persists, and reaches the provider as
  its ISO 639-1 code (test in `providers.test.ts` for one non-pinned language
  per provider).
- A test asserts every non-auto id is a two-letter lowercase code and ids
  are unique.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No per-provider language capability matrix. No language auto-detect changes.
No changes to prompts.

## Evidence bar

Command tails, test names, docs URL, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
