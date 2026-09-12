# 03 - AI providers: Anthropic, Groq, OpenRouter, Google Gemini

## Goal

The user can run post-processing on Anthropic, Groq, OpenRouter or Gemini
with their own key, chosen in the "Model AI" group from ticket 01.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `03-ai-providers`. Depends on ticket 01 (landed).

## What is already known

- Catalog `src/shared/providers.ts` (entries with `stt` / `chat`).
- Chat specs in `src/main/cleanup/chat.ts`: `ChatSpec { id, url, auth,
  body(model, messages, maxTokens), read(json) }` and the common `send()`.
  `messages` is `{ role: 'system' | 'user' | 'assistant', content }[]` with
  the system message first, then few-shot pairs, then the input.
- Key check for chat-only providers is the chat ping added in ticket 01.
- Ticket 02 (parallel) adds Groq with `stt`. On rebase, merge into one Groq
  entry with both capabilities.
- `test/cleanup.test.ts` covers the corrector and `pickCorrector`; request
  shape tests for chat live there or in a new `test/chat.test.ts`.
- Load the `claude-api` skill before writing the Anthropic spec: it has the
  current model ids and Messages API shape.

## Design

Verify each shape against current docs (WebFetch) and record URLs in notes.
Starting points:

- Anthropic: `POST https://api.anthropic.com/v1/messages`, headers
  `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/
  json`. Body `{ model, max_tokens, system, messages }`: the system message
  is lifted out of `messages` into `system`; the remaining user/assistant
  turns stay in order. Text at `content[0].text`. Default model: the current
  fast Haiku; offer the current Sonnet as a second option. `auth` in
  `ChatSpec` already allows a header without prefix.
- Groq chat: `POST https://api.groq.com/openai/v1/chat/completions`, Bearer,
  OpenAI chat shape (same `body`/`read` as xAI today; share the helper rather
  than copy it). Pick two current production models from the Groq model
  list, fastest first.
- OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions`, Bearer,
  OpenAI chat shape. Model ids are `vendor/model`; offer three sensible
  defaults and allow a free-text model id (see below). Keys at
  `https://openrouter.ai/keys`.
- Gemini: use the OpenAI-compatible endpoint
  `POST https://generativelanguage.googleapis.com/v1beta/openai/chat/
  completions`, Bearer key, OpenAI chat shape. Models: current Flash as
  default, one more. Keys at `https://aistudio.google.com/apikey`.
- Free-text model id: `chat.models` entries stay the presets; add
  `chat.freeModel?: true` on OpenRouter so the model control in `ModelPane`
  becomes a text input with a datalist of presets. Persist through the
  existing `chatModels` record.

## Done when

- Four providers selectable as AI provider; each has a request-shape test
  (URL, auth header, body shape, response parsing). Anthropic's test proves
  the system prompt is lifted and the turn order is kept.
- OpenRouter accepts a typed model id and the pipeline sends it (test on
  `pickCorrector` / spec model resolution).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No STT for these (02). No custom base URL (12). No streaming, no tool use.

## Evidence bar

Command tails, docs URLs, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
