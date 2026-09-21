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

## Design (approved 2026-09-21)

Settings: `redoShortcut: string` (default `'Alt+Shift+Space'`).

`shortcut.ts`: registrations keyed by name (`'dictate' | 'redo'`), each
with its own current accelerator and the same restore-on-conflict rule.
Setting one to the other's accelerator is rejected with
"Skrot juz uzywany przez mowa". `registerShortcut(name, accelerator, fn)`;
`ipc` `settings:setShortcut` takes `name` as first argument; preload and
`App.tsx` pass it; `ShortcutPane.tsx` shows a second row "Cofnij i powtorz"
with its own `ShortcutRecorder` and a note: "Cofa ostatnie wklejenie przez
Cmd+Z i od razu nagrywa. Dziala w polach tekstowych; w terminalu tylko
nagrywa od nowa."

`paste.ts`: extract `keystroke(key)` running osascript; `pasteText` uses
`keystroke('v')`, new `undoPaste()` uses `keystroke('z')` and maps
failures the same way.

`dictation.ts`:

- `lastText: string | null`, `lastPasteAt: number | null`, set after a
  successful paste. `REDO_WINDOW_MS = 15000`.
- Host gains `now(): number`, `undoPaste(): Promise<void>`,
  `feedback(verdict: 'good' | 'bad'): void`, and `setActions({ retry,
  pasteLast })` replacing R1's `setRetryAvailable`.
- `redo()`: if phase is not `idle`, behave like `toggle()`. If
  `lastPasteAt` is within the window: `await host.undoPaste()` (a failure
  is logged to `setError` but does not stop the flow), `host.feedback('bad')`,
  then `start()`. Otherwise `start()`.
- `pasteLast()`: no-op without `lastText`; otherwise `showOverlay
  ({ state: 'done' })` after `host.paste(lastText)`, same hide timer.

Tray: remove "Ostatnie dyktowanie: trafione / bledne"; add "Wklej ostatni
tekst" (enabled when `pasteLast` action is available) next to "Powtorz
ostatnie nagranie". `feedback.ts` keeps `markLastDictation`; the host
calls it from `feedback()`.

Tests on the memory host: redo inside the window calls `undoPaste`, logs
`bad`, starts recording; redo outside the window starts recording without
`undoPaste`; redo during recording stops it like `toggle()`; `pasteLast`
pastes the last text and shows `done`; conflicting accelerator between the
two shortcuts is rejected (unit test on `shortcut.ts` with a mocked
`globalShortcut`).
