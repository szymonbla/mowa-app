# HS1 — Exercise the Hermes coordinator loop

## Outcome

One Hermes/Szef conversation delegates a disposable implementation, handles a
correction, obtains independent review, and reports evidence without human
worker management.

## Boundary

Use the disposable Git fixture supplied in the coordinator prompt. Product
code, the active mowa board, existing workers, pushes, and merges are excluded.
The fixture's role instructions apply to fixture workers. Szef edits tickets
and reports only; workers edit fixture code.

## Starting seam

`scripts/agents/mowa-dispatch-herdr` with `MOWA_ROOT` set to the fixture root.
Use Hermes background terminal commands with completion notifications for
bounded Herdr waits, then inspect the written fixture handoffs.

## Done when

- An implementer commits the initial greeting in an isolated fixture worktree.
- Szef updates the ticket to the simulated correction: `greet("Szymon")`
  returns exactly `Cześć, Szymon!`; the worker commits and checks the correction.
- A separate reviewer checks the final candidate SHA and records PASS; Szef
  writes `specs/hermes-szef/smoke-result.md` with branches, SHAs, commands,
  notification behavior, and limitations.

## Evidence bar

Distinguish an initial handoff from corrected work, a process notification from
ticket acceptance, and automatic continuation from a manual coordinator nudge.
Do not claim mid-generation steering if the correction was delivered after a
handoff. Keep at most two fixture workers at once.
