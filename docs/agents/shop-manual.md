# Herd shop manual

The workflow is one tmux session named `mowa-herd`.

Think of it as one room:

- `coordinator` decides what should happen next.
- `worker-1`, `worker-2`, `worker-3` each work in an isolated copy.
- `reviewer` checks worker output.
- `board` shows tickets, handoffs, and reviews.

Start it on the server:

```bash
mowa-herd
```

Attach later:

```bash
tmux attach -t mowa-herd
```

## Server layout

Main repo:
`/home/szymon/mowa`

Worker copies:
`/home/szymon/mowa-agents/worker-1`
`/home/szymon/mowa-agents/worker-2`
`/home/szymon/mowa-agents/worker-3`
`/home/szymon/mowa-agents/reviewer`

Shared state:
`/home/szymon/mowa-work`

## How work moves

1. Human tells `coordinator` the goal.
2. `coordinator` writes small tickets in `/home/szymon/mowa-work/tickets/`.
3. Each worker takes one ticket and writes a handoff in `/home/szymon/mowa-work/handoffs/`.
4. `reviewer` reads the ticket, handoff, and diff, then writes a review in
   `/home/szymon/mowa-work/reviews/`.
5. `coordinator` merges only reviewed work into `/home/szymon/mowa`.

## Ticket minimum

Every ticket needs only:

- Objective.
- Owner.
- Acceptance criteria.
- Checks.
- Handoff path.

## Worker stop condition

A worker stops when it has either:

- a passing implementation plus handoff, or
- a blocked handoff naming the exact missing decision or failing command.

## Review stop condition

Reviewer stops with one status:

- `merge-ready`
- `needs-fix`
- `needs-human`
