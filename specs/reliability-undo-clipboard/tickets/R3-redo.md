# R3 - Redo shortcut with Cmd+Z and feedback; paste last text

## Goal

A wrong paste is replaced with one gesture, and that gesture is the
feedback signal.

## Outcome

- Setting `redoShortcut` (default `Alt+Shift+Space`), registered with the
  same conflict validation as the main shortcut.
- `Dictation.redo()`: within `REDO_WINDOW_MS` of a successful paste, send
  Cmd+Z via `undoPaste()`, log feedback `bad`, start recording. Otherwise
  behave like `toggle()`.
- `Dictation.pasteLast()`: paste the last successful text again.
- Tray: "Wklej ostatni tekst" replaces the two feedback items.
- ShortcutPane shows the second recorder and explains the limitation
  (Cmd+Z works in text fields, not in terminals).

## Boundary

`src/main/dictation.ts`, `paste.ts`, `shortcut.ts`, `settings.ts`,
`types.ts`, `tray.ts`, `ipc.ts`, `preload`, `ShortcutPane.tsx`,
`feedback.ts`, tests.
