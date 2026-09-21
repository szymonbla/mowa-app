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
