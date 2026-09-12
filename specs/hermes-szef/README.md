# Hermes Szef

## Goal

Szymon directs one Hermes Agent coordinator, Szef, which owns focused worker
jobs, handoffs, live corrections, independent review, and outcome verification.

## Status

Runtime setup in progress. Hermes CLI 0.21.2 is installed; profile `szef` uses
Astra/high, local terminal commands, and project-owned coordinator instructions.
Hermes imported the existing ChatGPT login through its native model wizard.
The coordinator launcher now starts Hermes with `--yolo`; workers stay Codex.
End-to-end coordination and notification continuation still require validation.

## Reference

[overment/limen](https://github.com/overment/limen) is a learning reference,
not a dependency or runtime to adopt. Szymon wants a simple workflow built
around Hermes and Herdr, borrowing useful loop concepts rather than installing
Limen. `limen-research.md` describes upstream mechanisms only; its earlier
adapter recommendation is superseded by this decision.

## Agreed boundaries

- Szymon communicates with Szef; Szef owns worker instructions and corrections.
- Specs and tickets define outcomes, boundaries, starting seams, acceptance,
  dependencies, checks, and handoff locations.
- The product vision remains human-owned. The coordinator maintains the board.
- Workers implement and commit in isolated worktrees. Fresh reviewers assess
  the final candidate; Szef checks the assembled initiative before completion.
- Human merge authority and the board's two-worker resource limit remain.

## Intended architecture (pending runtime verification)

Human -> Hermes/Szef -> Herdr -> focused worker and reviewer sessions.
The existing dispatch scripts are the starting point. Tickets, notes, the board,
and Git provide durable intent, handoffs, and evidence. Verify how Hermes keeps
the coordination loop active and discovers written worker completions; start
with existing Hermes capabilities before adding any notification mechanism.
There is no Limen dependency or requirement to reproduce its runtime.

Direct Codex workers are the initial path already supported by the dispatch
script. Pi is optional: introduce it only if an exercised workflow shows a
specific benefit. Each worker has one assigned ticket and one owning Szef.

## Implementation slices to specify after research

1. Runtime bootstrap: establish Hermes availability and model access,
   preserving existing project workflow files.
2. Coordinator context: load Szef's instructions, vision, and board into Hermes
   and give it access to the existing Herdr dispatch and inspection commands.
3. Completion discovery: verify that Szef notices written handoffs and continues
   the loop while remaining available to Szymon. Add wake routing only if needed.
4. Worker lifecycle: exercise spawn, correction, checkpoint/resume, handoff, and
   independent review on one small disposable task.

Each slice needs its own ticket before dispatch. These are proposed workstreams,
not active jobs or claims that Hermes integration already exists.

## Done when

- One human request runs through Szef, an isolated worker, independent review,
  and a verified outcome without human worker management.
- A live correction reaches the worker and appears in durable task history.
- Szef discovers worker handoffs and continues independently; restart recovery
  reconstructs the actual ticket/worker state without duplicate dispatch.
