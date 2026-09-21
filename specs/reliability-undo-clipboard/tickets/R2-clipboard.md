# R2 - Clipboard restore after paste; clipboard-only mode

## Goal

Pasting a dictation does not cost the user whatever they had copied.

## Outcome

- `paste.ts` snapshots text/HTML/RTF/image before writing, restores after a
  successful Cmd+V and `RESTORE_DELAY_MS`.
- Setting `restoreClipboard` (default true) and `pasteMode: 'paste' |
  'clipboard'` (default `paste`).
- GeneralPane rows for both.

## Boundary

`src/main/paste.ts`, `src/main/settings.ts`, `src/shared/types.ts`,
`src/main/dictation-host.ts`, `GeneralPane.tsx`, e2e test.

## Done when

- e2e: clipboard ends with the previous content after a successful paste;
  keeps the transcript after a failed paste; clipboard-only mode sends no
  osascript.

## Design (approved 2026-09-21)

`pasteText(text, opts: { mode: 'paste' | 'clipboard'; restore: boolean })`.

- Snapshot before `writeText`: `clipboard.availableFormats()`, then
  `readText()`, `readHTML()`, `readRTF()`, `readImage()` (skip when
  `isEmpty()`). No formats worth restoring (empty, or only file lists) →
  no restore.
- `mode === 'clipboard'`: write text, skip the accessibility check and
  osascript, resolve. Never restores (the clipboard is the deliverable).
- After a successful osascript, schedule the restore on
  `setTimeout(RESTORE_DELAY_MS = 400)`, not awaited, via
  `clipboard.write({ text, html, rtf, image })`. On any paste failure the
  transcript stays in the clipboard, as the error messages promise.

Settings: `restoreClipboard: boolean` (default `true`), `pasteMode`
(default `'paste'`). `dictation-host.ts` reads both per paste.

UI: `GeneralPane.tsx` new group "Wklejanie" above "Transkrypty": switch
"Przywracaj schowek po wklejeniu" (desc: "Po Cmd+V wraca to, co bylo w
schowku wczesniej. Listy plikow z Findera nie wracaja.") and switch
"Tylko do schowka" (desc: "Bez Cmd+V. Wklejasz sam, kiedy chcesz.").

e2e: extend the `electron` mock's `clipboard` with `availableFormats`,
`readText`, `readHTML`, `readRTF`, `readImage` (returns `{ isEmpty: () =>
true }`), `write`. Cases: previous text comes back after a successful
paste (wait > 400 ms); transcript stays after osascript failure;
clipboard-only mode sends no osascript and shows `done`.
