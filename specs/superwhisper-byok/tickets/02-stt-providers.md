# 02 - STT providers: Groq, Deepgram, Mistral

## Goal

The user can transcribe with Groq (Whisper), Deepgram (Nova) or Mistral
(Voxtral) by pasting a key, the same way xAI, OpenAI and ElevenLabs work
today.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `02-stt-providers`. Depends on ticket 01 (landed).

## What is already known

- Catalog `src/shared/providers.ts` (after 01: entries with `stt` / `chat`).
- STT specs `src/main/providers/spec.ts`: `ProviderSpec { id, url, auth,
  fields(opts) }`, multipart body, response read as `json.text`. The common
  request is `src/main/providers/request.ts` and has no per-provider `if`.
- Key check sends 0.5 s of silence (`status.ts`); an empty transcript is
  expected there, only the HTTP status matters.
- `test/providers.test.ts` has a table of cases per provider: url, auth
  header, field order. Add rows there.
- Ticket 03 (running in parallel) adds `chat` to a Groq entry. If Groq
  already exists in the catalog when you rebase, merge the entry: one Groq
  entry with both `stt` and `chat`.

## Design

Verify each request shape against current docs with WebFetch before coding
and record the URLs in notes. Known starting points:

- Groq: `POST https://api.groq.com/openai/v1/audio/transcriptions`, Bearer,
  multipart `file`, `model`, `language`, `response_format=json`. Models
  `whisper-large-v3-turbo` (default), `whisper-large-v3`. Keys at
  `https://console.groq.com/keys`, hint `gsk_...`.
- Mistral: `POST https://api.mistral.ai/v1/audio/transcriptions`, Bearer,
  multipart `file`, `model` (`voxtral-mini-latest` default), `language`.
  Keys at `https://console.mistral.ai/api-keys`.
- Deepgram: `POST https://api.deepgram.com/v1/listen?model=nova-3&
  smart_format=true&language=<code>`, header `Authorization: Token <key>`,
  body is the raw WAV with `Content-Type: audio/wav`, not multipart. Text is
  at `results.channels[0].alternatives[0].transcript`. Auto language for
  nova-3 is `language=multi` (check docs). Keys at
  `https://console.deepgram.com/`.

Deepgram breaks two assumptions of `ProviderSpec`: body encoding and
response path. Extend the spec, do not special-case: add `query?(opts)`
for URL params, `body: 'multipart' | 'wav'` (default multipart), and
`read?(json): string | null` (default `json.text`). `request.ts` stays free
of provider names.

## Done when

- The three providers appear in the STT list, each with a key field and
  model select where the provider has more than one model.
- `providers.test.ts` pins for each: URL (including query for Deepgram),
  auth header, body encoding, field order or query, and response parsing
  (a Deepgram-shaped response yields the transcript; a shape without it
  yields `provider-response`).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No chat specs for these providers (03 does Groq chat). No streaming. No
custom base URL (12).

## Evidence bar

Command tails, docs URLs, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
