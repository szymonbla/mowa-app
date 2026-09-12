# 10 - Paste options: clipboard-only mode, restore clipboard

## Goal

The user chooses whether `mowa` pastes into the active field or only copies,
and whether the previous clipboard content comes back after pasting.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `10-paste-options`. Depends on ticket 08 (landed).

## What is already known

- `src/main/paste.ts` `pasteText(text)`: writes the clipboard, checks
  Accessibility, waits 60 ms, runs `osascript` Cmd+V, maps failures to
  `paste` reasons, records Automation status. The header comment says the
  previous clipboard is not restored "as decided"; this ticket changes that
  decision behind a setting.
- `dictation.ts` calls `host.paste(text)` and shows `done`; `failure.ts`
  `PASTE_MESSAGES` all end with "tekst w schowku".
- `OverlayState` has `done`; `Overlay.tsx` renders it without a message.
- GeneralPane "System" card holds the launch-at-login switch.
- e2e test mocks `electron.clipboard` as an array and `child_process` for
  `osascript`.

## Design

- `Settings.output: 'paste' | 'clipboard'` (default `paste`) and
  `Settings.restoreClipboard: boolean` (default `false`).
- `pasteText(text, opts)`: in `clipboard` mode write and return, no
  Accessibility check, no osascript. In `paste` mode, when
  `restoreClipboard` is on: read `clipboard.readText()` before writing;
  after a successful Cmd+V wait 300 ms then write the previous text back
  (only if it was non-empty and the clipboard still holds our text). A
  failed paste never restores, so the user keeps the transcript.
- `dictation.ts`: in `clipboard` mode the overlay `done` state gets a
  message "W schowku" (add `message` support to the `done` pill in
  `Overlay.tsx`, same style as `warning` but not red).
- GeneralPane, new card "Wklejanie": a two-option select (Wklej w aktywne
  pole / Tylko do schowka) and the restore switch, with one-line descs.

## Done when

- `clipboard` mode copies without running osascript and shows "W schowku";
  `paste` mode with restore on puts the old clipboard back after a
  successful paste and leaves the transcript when the paste fails (e2e
  cases for all three).
- Both settings persist and render in GeneralPane.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No keystroke typing fallback, no per-app rules, no HTML clipboard.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
