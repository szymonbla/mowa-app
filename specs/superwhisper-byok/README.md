# Superwhisper, BYOK only

## Goal

`mowa` covers what Superwhisper gives a user who brings their own API keys:
several STT providers, a separate AI model for post-processing, modes with
custom prompts, history, vocabulary and replacements, input device choice, a
full language list, paste options, sounds. No subscription, no local models.

Szymon's words (2026-09-11): "W pelni dzialajaca kopia Superwhisper, ale tylko
funkcjonalnosc podpiecia swoich wlasnych kluczy API. Rano gotowa aplikacja."

## Why now

The dictation core works (shortcut, STT, LLM correction, paste, key health,
transcripts log). What is missing is the breadth a Superwhisper user expects
before switching. The cloud host can run the full loop overnight.

## Non-goals

- Local models (whisper.cpp, Ollama as a bundled runtime). A custom
  OpenAI-compatible endpoint covers Ollama and LM Studio for users who run
  them themselves.
- Superwhisper cloud, accounts, licensing.
- Push-to-talk (hold to record). Electron `globalShortcut` has no key-up event;
  a native key hook is a new native module we cannot build or test on Linux.
- Per-app automatic mode switching, screenshot context, meeting/system audio.
- Windows or Linux builds.

## Decisions

- 2026-09-11 (Szymon, late): packaging is not optional. Ticket 15 moves the
  electron-builder config into `package.json` (dmg + zip, arm64) and adds
  Mac install steps to README. The GitHub release workflow is written but
  not exercised: no `gh`, no credentials, and local `main` has diverged from
  `origin/main`, so nothing gets pushed tonight.

- 2026-09-11: Integration branch is `byok`, cut from `main` at `c42e652`.
  Every ticket lands on `byok` by rebase plus fast-forward, after checks. The
  reviewer reviews landed commits and fixes go on top. Szymon merges `byok`
  into `main`; nobody else touches `main`.
- 2026-09-11: The uncommitted `guard.ts` `diagnose()` diff and `test/eval/`
  stay in the working copy of `main`, untouched. Tickets do not edit
  `src/main/cleanup/guard.ts` internals beyond what ticket 04 names.
- 2026-09-11: One provider catalog with capabilities. An entry declares `stt`
  and/or `chat`. One API key per provider. The user picks the STT provider and
  the AI provider independently.
- 2026-09-11: Modes replace the single `cleanup` switch. Built-in modes:
  raw, correct (today's guarded correction), message, email, note. Custom
  modes carry a user prompt. The guard applies only to the correct mode.
- 2026-09-11: The cloud host cannot run the macOS app. Evidence is
  `npm run typecheck`, `npm test`, `npm run build`, plus tests that pin request
  shapes against provider docs. Szymon does the manual macOS pass in the
  morning.
- 2026-09-11: Worker language is English in tickets, notes, commits. UI copy
  stays Polish without diacritics, matching the existing renderer.

## Open questions

- Anthropic, Gemini, OpenRouter and Groq model ids: the worker verifies them
  against live docs at implementation time and records the URLs in notes.
- Whether built-in mode prompts should be editable. Current answer: no,
  duplicate into a custom mode instead.

## Workstreams

Waves reflect file overlap, not importance. A wave starts when the tickets it
depends on have landed on `byok`.

| Ticket | Outcome | Wave | Depends on | Status |
|---|---|---|---|---|
| 01 | Provider catalog with stt/chat capabilities, separate AI provider and model choice | 1 | - | ready |
| 15 | Packaging: electron-builder config in package.json, Mac install steps in README, release workflow for later | 1 | - | ready |
| 06 | Full language list | 1 | - | ready |
| 07 | History pane over the transcripts log | 1 | - | ready |
| 09 | Input device selection | 1 | - | ready |
| 02 | STT providers: Groq, Deepgram, Mistral | 2 | 01 | ready |
| 03 | AI providers: Anthropic, Groq, OpenRouter, Gemini | 2 | 01 | ready |
| 04 | Modes in the pipeline, built-in prompts, migration off `cleanup` | 2 | 01 | ready |
| 08 | Vocabulary, replacements, STT hint | 2 | 07 | ready |
| 05 | Modes pane and tray mode switch | 3 | 04 | ready |
| 10 | Paste options: clipboard-only mode, restore clipboard | 3 | 08 | ready |
| 11 | Start and stop sounds | 3 | 09 | ready |
| 12 | Custom OpenAI-compatible endpoint (STT and chat) | 3 | 02, 03 | ready |
| 13 | Per-mode shortcuts | 4 | 05 | ready, stretch |
| 14 | README and final build check | 4 | all above, incl. 15 | ready |

## Done when

- Szymon can build a DMG and zip on his own Mac with `npm ci && npm run
  build:mac` following README (ticket 15). No build is possible on the cloud
  host.

- A user with only API keys can install `mowa`, pick STT and AI providers from
  the list, pick a mode, dictate, and get text pasted.
- Every ticket above has a PASS in `notes.md` or a named reason it was left out.
- `byok` passes typecheck, tests and build at its tip.
- README describes the new settings in Polish.
