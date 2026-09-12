# 12 - Custom OpenAI-compatible endpoint (STT and chat)

## Goal

The user points `mowa` at any OpenAI-compatible server (Ollama, LM Studio,
a proxy, a self-hosted Whisper) with a base URL, an optional key, and a
typed model id, for transcription and for AI.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `12-custom-endpoint`. Depends on tickets 02 and 03 (landed).

## What is already known

- Catalog and specs (01, 02, 03). Specs have a fixed `url`; the OpenAI shape
  is shared by several providers.
- `dictation.ts` `start()` fails with `no-key` when `host.apiKey(provider)`
  is null. `setApiKey('')` deletes a key. `checkKey` returns `unknown`
  without a key.
- `ModelPane` free-text model input exists for OpenRouter (03).

## Design

- Catalog entry `custom`: label "Wlasny serwer (OpenAI API)", `stt` and
  `chat` with empty preset lists and `freeModel: true` for both; `keyHint`
  "opcjonalny"; `keyOptional: true`.
- `Settings.customBaseUrl: string` (default `http://localhost:11434/v1`).
  STT url is `<base>/audio/transcriptions`, chat is `<base>/chat/
  completions`. Specs get `url` as a function of a small `Env { baseUrl }`
  or a resolver; keep other providers' urls constant. Trailing slash is
  trimmed; missing scheme is rejected in the UI with a one-line error.
- `keyOptional`: when the entry declares it, `start()` does not require a
  key, `request.ts`/`send()` omit the auth header when the key is null, and
  `checkKey` runs the ping without a key instead of returning `unknown`.
- `ModelPane`: for `custom` show a "Adres serwera" input above the model
  input, in both groups (one shared value).

## Done when

- With base URL and no key, dictation transcribes and post-processes
  against a local stub (e2e test with the stub URL as base).
- Auth header is absent without a key and present with one (tests in
  `providers.test.ts` and the chat test file).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

One custom endpoint, not many. No Azure-style headers. No TLS options.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
