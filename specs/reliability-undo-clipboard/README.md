# Reliability: retry, undo, clipboard restore

## Goal

A dictation that already happened is never lost, and the two most common
follow-ups (redo it, get my clipboard back) take one gesture.

Szymon (2026-09-21): approved the three solutions from the product review,
in order 1, 3, 2.

## Why now

Usage log shows 20 to 86 dictations a day, median 12 s, p90 45 s. Today a
network or provider error after 45 s of speech means speaking again, the
clipboard is overwritten on every paste, and a wrong paste needs manual
Cmd+Z plus a new dictation. The feedback entries in the tray were never used.

## Non-goals

- Writing audio to disk. Voice is sensitive; the recording lives in memory
  until success or the next recording. Quitting the app loses it.
- More than one automatic retry.
- Restoring file lists copied in Finder (no Electron API to round-trip them).
- History pane, vocabulary, auto-stop (separate initiatives).

## Decisions

- 2026-09-21: `dictation.ts` keeps the last valid recording. Retryable
  failures are `network`, HTTP 429 and HTTP 5xx. One automatic retry after a
  short delay, then the shortcut retries while the error pill is visible,
  then tray and settings banner offer "Powtorz ostatnie nagranie".
- 2026-09-21: Clipboard restore is on by default. It restores text, HTML,
  RTF and image formats after the paste succeeded, never after a paste
  failure (the error messages promise "tekst w schowku").
- 2026-09-21: Redo shortcut defaults to `Alt+Shift+Space`. Within 15 s of a
  successful paste it sends Cmd+Z, logs feedback `bad`, and starts a new
  recording. Outside that window it behaves like the main shortcut. The
  tray items "trafione / bledne" go away; "Wklej ostatni tekst" comes in.

## Open questions

- Exact restore delay after Cmd+V. Starting at 400 ms as a named constant.

## Workstreams

| Ticket | Outcome | Owner session | Status |
|---|---|---|---|
| R1 | Recording survives failure; automatic and manual retry | this session | in progress |
| R2 | Clipboard restore after paste; clipboard-only mode | this session | queued |
| R3 | Redo shortcut with Cmd+Z and feedback; paste last text | this session | queued |

## Done when

- `npm run typecheck`, `npm test`, `npm run build` pass.
- Dictation unit tests cover retry, redo window, and last-text paste on the
  memory host; e2e covers clipboard restore and Cmd+Z through the mocked
  osascript.
- Szymon does the manual macOS pass: dictate with Wi-Fi off, retry, see the
  clipboard come back, redo a paste in a text field.
