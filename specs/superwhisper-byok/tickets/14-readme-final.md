# 14 - README and final build check

## Goal

Szymon opens README in the morning and finds every new setting described in
Polish, and `byok` builds clean at its tip.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `14-readme-final`. Depends on every other landed ticket; the
dispatch prompt lists which ones landed.

## What is already known

- `README.md` is Polish without diacritics, sections: Uruchomienie,
  Pierwsza konfiguracja, Uzycie, Bledy, Build lokalny.
- `specs/superwhisper-byok/notes.md` has each ticket's handoff with what
  changed and what was left out.

## Design

- Update "Dostawcy STT" line and "Pierwsza konfiguracja" for two provider
  choices, keys per provider, the custom server. Add sections: "Tryby",
  "Slownik i zamiany", "Historia", "Wklejanie", "Mikrofon i dzwieki", "Jezyki".
  Keep the existing voice: short sentences, facts, no marketing.
- Run `npm run typecheck`, `npm test`, `npm run build`, `npm run
  format:check` at the tip of `byok`; fix formatting only (`npm run
  format` on touched files) if `format:check` fails.
- Do not bump the version.

## Done when

- README covers every landed ticket's user-facing setting.
- All four commands pass at the tip; outputs in notes.
- Landed on `byok`.

## Scope edge

No code changes beyond formatting.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
