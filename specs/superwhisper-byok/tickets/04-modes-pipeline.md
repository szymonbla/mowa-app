# 04 - Modes in the pipeline

## Goal

Dictation runs through the active mode: raw, correct, message, email, note,
or a custom prompt. Today there is one hardcoded correction prompt behind a
`cleanup` switch.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `04-modes-pipeline`. Depends on ticket 01 (landed).

## What is already known

- `src/main/cleanup/index.ts`: `createCorrector(deps)`, `correct(text,
  speechMs)` returns `Correction` (`corrected` / `skipped` / `failed`). It
  strips fillers, builds messages via `prompt.ts`, sends with a budget from
  `text.ts` (`budgetMs`, `MAX_WORDS`), and runs `guard()` from `guard.ts`.
- `prompt.ts`: `systemPrompt(dictionary)`, `EXAMPLES` few-shot pairs,
  `messages(text, dictionary)`, delimiter `<<<TEKST ... TEKST>>>`.
- `guard.ts` exports `guard(input, raw)`; its internal `strip()` removes
  code fences and preambles. Do not change guard thresholds. You may export
  `strip`.
- `dictation.ts`: `host.settings()` returns `cleanup`; `submit()` calls
  `correct()` when `cleanup` is true; notices for skipped/failed come from
  `SKIP_NOTICE` and `describe()`. `dictation-host.ts` wires it.
- `Settings.cleanup` in `types.ts`; `GeneralPane.tsx` has the switch card
  "Poprawiaj podyktowany tekst". `transcripts.ts` `Outcome` has `off`.
- Tests: `test/cleanup.test.ts`, `test/dictation.test.ts`, `test/e2e`.

## Design

- New `src/shared/modes.ts`: `Mode { id, name, desc, ai: boolean, prompt:
  string, guard: boolean, builtin: true }` and `BUILTIN_MODES`:
  - `raw`: "Surowa transkrypcja", `ai: false`.
  - `correct`: "Korekta", today's prompt and examples, `guard: true`.
  - `message`: "Wiadomosc": short chat message, casual, keep the sender's
    voice, no greeting or sign-off unless dictated, Polish prompt.
  - `email`: "E-mail": greeting, paragraphs, sign-off placeholder only if
    dictated, formal unless the text is casual, Polish prompt.
  - `note`: "Notatka": headings and bullet points from spoken structure,
    keep every fact, Polish prompt.
  `CustomMode` = same fields with `builtin: false`, stored in settings.
- `Settings`: remove `cleanup`; add `mode: string` (active id, default
  `correct`) and `modes: CustomMode[]` (default `[]`). Migration in the
  function extracted in ticket 01: `cleanup === false` becomes `mode:
  'raw'`; unknown `mode` falls back to `correct`.
- `prompt.ts`: `messages(mode, text, dictionary)`. For `correct` the output
  is byte-identical to today (existing tests stay). For other AI modes:
  system = mode prompt, then the shared tail (dictionary section, delimiter
  rule, "answer with the text only"), no few-shot; user = delimited text.
- `index.ts`: `correct(text, speechMs, mode)`. Guard only when `mode.guard`;
  otherwise apply `strip` and reject only an empty result. Budget: guarded
  mode keeps `budgetMs`; unguarded modes get a flat 20 s ceiling and a word
  limit of 1500 instead of `MAX_WORDS`. `maxOutputTokens` for unguarded
  modes: at least 2x input plus 200, since a note can grow.
- `dictation.ts`: `host.settings()` returns the active `Mode`; `ai: false`
  skips correction (log outcome `off`). Overlay stays `correcting` while an
  unguarded mode runs.
- `transcripts.ts`: `OpenLine` gains `mode: string`.
- GeneralPane: remove the switch card (the pane in ticket 05 replaces it).
  Leave a one-line note pointing at "Tryby" if you want, no new pane here.
- Corrector deps: `mode()` and `dictionary()`; keep `chatProvider` /
  `chatModel` from 01.

## Done when

- Correct mode output and tests are unchanged; message/email/note produce
  their own system prompt, skip the guard, use the long budget (tests for
  prompt shape per mode, guard bypass, budget choice, word limit).
- Settings with `cleanup: false` migrate to `mode: 'raw'` and dictation
  pastes raw text with outcome `off` (unit test on migration, e2e or
  dictation test for the raw path).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No UI for modes beyond removing the switch (05). No per-mode shortcut (13).
No context injection. Do not touch guard thresholds or `test/eval`.

## Evidence bar

Command tails, test names, landed commit range, the five built-in prompts
quoted in notes so the reviewer can read them without the diff.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
