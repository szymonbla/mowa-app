# R1 - Recording survives failure; automatic and manual retry

## Goal

A transcription that fails on network, 429 or 5xx can be repeated without
speaking again.

## Outcome

- `dictation.ts` keeps the last valid recording until a paste succeeds or a
  new recording starts.
- First retryable failure: pill shows "Powtarzam…", one automatic retry
  after `RETRY_DELAY_MS`.
- Second failure: pill shows the error with a retry hint; pressing the
  dictation shortcut while that pill is visible retries instead of starting
  a new recording.
- `Dictation.retry()` is exposed for tray and settings banner.
- `failure.ts` gains fix `retry` with label "Powtorz".

## Boundary

`src/main/dictation.ts`, `src/shared/failure.ts`, `src/shared/types.ts`,
`src/main/tray.ts`, `src/main/ipc.ts`, `src/preload/index.ts`,
`src/renderer/src/settings/App.tsx`, `Banner.tsx`, tests.

## Done when

- Unit tests on the memory host: automatic retry succeeds; two failures then
  shortcut retries; new recording drops the pending one; Esc during retry
  drops the result.

## Design (approved 2026-09-21)

State in `createDictation`:

- `pending: { wav: Buffer; durationMs: number } | null` — last recording
  that passed the length and speech checks. Cleared by a successful paste,
  by `start()`, and by `cancel()` during an automatic retry.
- `autoRetried: boolean` — one automatic retry per pending recording.
- `retryArmed: boolean` — true while the error pill with the retry hint is
  visible; `toggle()` in that window calls `retry()` instead of `start()`.
  The pill hide timer resets it.
- A second timer handle for the automatic retry (`RETRY_DELAY_MS = 1500`),
  separate from the pill timer. `cancel()` clears both.

Flow: split `submit()` into validation (unchanged checks, then set
`pending`) and `process(recording)` (transcribe → agent → log → paste).
In the `catch` of `process`: if `isRetryable(failure)` and not
`autoRetried`, set `autoRetried`, `updateOverlay({ state: 'transcribing',
message: 'Powtarzam…' })`, schedule `process(pending)` on the retry timer.
Otherwise `fail(failure, { retry: isRetryable(failure) })`, which sets
`retryArmed`, uses `ACTION_HIDE_MS`, and calls `host.setRetryAvailable(true)`.

Public: `Dictation.retry()` — no-op unless `phase === 'idle'` and `pending`;
sets phase `transcribing`, `showOverlay({ state: 'transcribing' })`, runs
`process(pending)`.

Host: new method `setRetryAvailable(available: boolean)`. Electron adapter
stores the flag and calls `refreshTrayMenu()`; the tray item "Powtorz
ostatnie nagranie" is enabled only when true.

`failure.ts`: `isRetryable(failure)` is true for `network`, HTTP 429 and
HTTP >= 500. `describe(failure, opts?: { retry?: boolean })` with `retry`
returns fix `retry` and one of: `Brak sieci — skrot powtorzy`,
`Limit dostawcy — skrot powtorzy`, `Blad dostawcy — skrot powtorzy`;
`detail` stays as today.

`types.ts`: `ErrorFix` gains `'retry'`. `Overlay.tsx` renders
`payload.message` under the track when present in the `transcribing` state.
`Banner.tsx` label for `retry` is `Powtorz`; `App.tsx` routes it to
`window.api.retry()`; preload + `ipc.ts` add `dictation:retry`.

Paste failures are not retryable: the text is already in the clipboard.

Tests: `evidence/R1-red-tests.diff` holds the failing tests written for
this ticket (memory host gains `retryAvailable: boolean[]`). Apply with
`git apply specs/reliability-undo-clipboard/evidence/R1-red-tests.diff`,
watch them fail, then implement.
