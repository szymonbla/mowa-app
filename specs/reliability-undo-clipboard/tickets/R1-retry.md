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
