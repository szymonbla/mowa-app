# 01 - Provider catalog with STT and AI capabilities; separate AI model choice

## Goal

The user picks the transcription provider and the AI (post-processing)
provider and model independently in Settings, and the pipeline uses both.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md` (worktree, landing).
Worktree id: `01-provider-catalog`.

## Resume

A previous session started this ticket and was stopped. Its work is in the
worktree `/home/szymon/mowa/.claude/worktrees/01-provider-catalog` on branch
`t/01-provider-catalog` (two commits on top of `byok`, no uncommitted
changes):

- `d10c1bf` catalog: entries declare stt and chat capabilities with model lists
- `c6fb472` settings: chatProvider and chatModels, migration extracted from Electron

Design steps 1 and 2 are done there. Steps 3 to 6, the e2e proof, the checks
and the landing are not. Do not run `git worktree add`; call `EnterWorktree`
with that path, read `git log -p byok..HEAD` and the touched tests, then
continue. Keep the commits; fix them on top if something is wrong.

## What is already known

- `src/shared/providers.ts` is the only catalog. `PROVIDERS` is a `const`
  array; `ProviderId`, `byProvider()`, `DEFAULT_MODELS`, `providerMeta()` derive
  from it. The renderer imports this file directly.
- `src/main/providers/spec.ts` holds STT request specs, one per provider.
  `src/main/cleanup/chat.ts` holds chat specs with a hardcoded `model` per
  provider and `pickCorrector(stt, hasKey)` that prefers the STT provider and
  falls back to the first provider with a key. ElevenLabs has no chat spec.
- `Settings` (`src/shared/types.ts`): `provider`, `models: Record<ProviderId,
  string>` (STT model per provider), `cleanup`, and more. Defaults and
  migration live in `src/main/settings.ts` (`DEFAULTS`, `initSettings`).
- `src/main/status.ts` `checkKey()` validates a key by sending 0.5 s of
  silence to the STT endpoint. It is the only key check; the Test button uses
  it too.
- `src/main/dictation-host.ts` wires `createCorrector({ provider, apiKey,
  dictionary })`.
- Settings UI: `src/renderer/src/settings/ModelPane.tsx` (provider list, one
  model select, one `ApiKeyField`), `HomePane.tsx` strip shows provider.
- Tests: `test/providers.test.ts`, `test/cleanup.test.ts` (pickCorrector
  cases at the top), `test/e2e/dyktowanie.test.ts` runs the real
  `dictation-host.ts` against a local HTTP stub. Keep all green.

## Design

1. Catalog entry shape becomes:
   `{ id, label, keyHint, keysUrl, stt?: { models }, chat?: { models } }`.
   `models` is a list of `{ id, label }`; the first is the default. An STT
   entry with an empty list means "one model, no selector" (xAI today).
   Fill `chat.models` from the ids already hardcoded in `chat.ts`
   (xAI `grok-4.20-0309-non-reasoning`, OpenAI `gpt-5.6-luna`); add one or
   two more per provider only if you verify them in current docs and note the
   URL. ElevenLabs stays STT-only.
2. `Settings` gains `chatProvider: ProviderId` and `chatModels:
   Record<ProviderId, string>` (same pattern as `models`). Rename nothing
   else. Migration in `initSettings`: a file without `chatProvider` gets the
   STT provider if it has `chat`, else the first catalog entry with `chat`.
3. `ChatSpec` loses its hardcoded `model`; the model comes from settings via
   the corrector deps. `pickCorrector` becomes: the configured `chatProvider`
   if it has a chat spec and a key, else `null` (skipped, `no-corrector`).
   Remove the fallback search and its tests; replace with tests for the new
   rule. The corrector deps gain `chatProvider()` and `chatModel()`.
4. Key check per capability: `checkKey(provider)` uses the STT silent-wav
   check when the entry has `stt`; otherwise a minimal chat request (one
   short user message, `maxTokens` small) through `send()`. Put the chat ping
   in `cleanup/chat.ts` so chat-only providers in ticket 03 get it for free.
   Rejections 401/403 mark `invalid` as today.
5. Settings UI, `ModelPane`: three groups. "Transkrypcja": provider rows
   (only entries with `stt`) plus model select. "Model AI": provider rows
   (only entries with `chat`) plus model select. "Klucze API": one
   `ApiKeyField` per provider that is selected in either group (a provider
   used for both shows one field). Keep the existing row/card CSS classes;
   add CSS only when a class is missing. Home strip: add "Model AI" cell.
6. Nothing outside the catalog and the two spec files may branch on a
   provider id.

## Done when

- The user can select STT provider and AI provider plus model independently;
  the choice persists across restart and the pipeline sends the chat request
  to the chosen provider with the chosen model (e2e test proves it).
- Catalog entries declare `stt` and `chat`; settings without `chatProvider`
  migrate as in Design 2 (unit test on the migration function; extract it
  from `initSettings` so it runs without Electron).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No new providers here (tickets 02, 03, 12). No custom base URL. No prompt or
mode changes (ticket 04). Do not touch `guard.ts`.

## Evidence bar

Paste the three command outputs (tail is fine), the new test names, and the
landed commit range.

## Found, do not fix

List anything adjacent in notes.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
