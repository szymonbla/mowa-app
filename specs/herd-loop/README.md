# Herd loop

## Goal

Run `mowa` work through one coordinator and several focused worker sessions on
the cloud host.

## Why now

Szymon wants to leave autonomous work running overnight without losing state in
chat history.

## Non-goals

- Unattended merge.
- Production deployment.
- Hidden work without a ticket and notes entry.

## Decisions

- 2026-09-11: Mirror the Slickshift shape: `vision.md`, `build.md`, roles, specs,
  ticket files, notes.
- 2026-09-11: Until Herdr exists on the cloud host, `mowa-szef` uses Claude
  background sessions.

## Open questions

- Should the workflow files (`SZEF.md`, `roles/`, `specs/`, `scripts/agents/`,
  `.claude/`) be committed, so worker worktrees branched from HEAD see them?
- Should `HERD_SESSION.md` and `docs/agents/` be removed now that `AGENTS.md`
  calls them legacy?

## Workstreams

| Ticket | Outcome | Owner session | Status |
|---|---|---|---|
| H1 | Coordinator loop exists on the cloud host | szef | done 2026-09-11 |

## Done when

- `mowa-szef "<goal>"` starts a coordinator.
- Coordinator has `SZEF.md`, `vision.md`, `build.md`, roles, and templates.
- Workers have role prompts available through hooks.
