# Agent loop

Source of truth for why this exists: `vision.md`. Source of truth for code
habits: `AGENTS.md`.

## Model

Szymon communicates only with Szef, whose harness is Hermes Agent.
Szef controls separate Codex worker sessions through Herdr, with one role and
one ticket per session. Workers route questions and handoffs to Szef.
Harness, model, and session manager are separate choices: Hermes hosts Szef,
the configured provider supplies its model, and Herdr manages worker terminals.

Szef may edit:

- `build.md`
- `vision.md` when Szymon explicitly authorizes a durable product decision
- `AGENT-LOOP.md`
- `roles/`
- `specs/<slug>/`
- launcher scripts

Szef does not implement product code. Product code belongs to worker sessions.

## Minimal happy path

1. Szymon gives Szef a goal in Polish.
2. Szef ensures `specs/<slug>/`, writes `README.md`, `tickets/<ID>.md`, and a
   one-line `build.md` row.
3. Szef starts an implementer Herdr agent with role + ticket path + one why sentence.
4. Implementer works in an isolated worktree, commits the change, appends
   `specs/<slug>/notes.md`, then stops.
5. Szef inspects the handoff for acceptance coverage and starts an independent reviewer.
6. Reviewer appends PASS/FAIL to `notes.md`, then stops.
7. On FAIL, Szef writes a correction ticket and repeats implementation and review.
8. Szef verifies the initiative completion gate, then reports the outcome and
   evidence to Szymon in Polish. Progress updates do not end the loop.

## Ticket shape

A ticket is ready for a worker when:

- Goal is one product sentence.
- Outcome is an observable user or system result.
- Boundary names owned behavior/files and excluded adjacent work.
- Starting seam names the existing entry point or interface to investigate first.
- Scope is one coherent result that fits a fresh session, even across several files.
- Dependencies and the integration branch are explicit.
- Done When has at most three checkable conditions.
- Checks are named.
- Notes path is named.

If that does not fit, split before dispatch.

## Live corrections and handoffs

Szef owns ticket states: ready, running, handoff, reviewing, changes-requested,
verified, or blocked. Record the session, branch/commit, and next action in
`build.md`; detailed evidence belongs in the initiative's notes.

When Szymon changes a requirement, update the spec and affected ticket first.
Record the decision and which acceptance conditions changed. Inspect the
worker's state and output before sending a correction through Herdr. Send
normal follow-up prompts when the worker is ready for input; for an urgent
scope change, interrupt the worker and request a checkpoint before redispatch.
Preserve its edits and record the superseded assignment. A timeout or idle
terminal is not evidence that a ticket finished; read the written handoff.

Resolve technical questions within the agreed boundary. Ask Szymon when a
decision changes the product goal, boundary, or an action reserved to him;
continue independent tickets while awaiting that decision. Keep the board's
limit of two worker panes, including reviewers, and release finished panes
after their handoffs are recorded.

## Initiative completion gate

Every acceptance condition has evidence, every implementation has independent
PASS on its final commit range, and required integration checks pass on the
assembled result. Further commits invalidate review of the changed range.
Outstanding findings have been corrected or explicitly deferred by Szymon.
Szef records the final branch/commit and remaining manual checks in the board.
An unavailable required check leaves the initiative blocked or awaiting human
verification; report that status without claiming completion.

## Coordinator launcher

On the cloud host, start the coordinator with:

```bash
mowa-szef "goal in Polish"
```

This command must be run inside Herdr. It starts Hermes profile `szef` in the
current pane on Astra/high with `--yolo`, resuming its named conversation.
Configure the profile with `scripts/agents/mowa-setup-szef`; use
`hermes -p szef model` to configure provider login. Pi is optional and is not
part of this baseline.

After dispatch, use Hermes `terminal` with `background=true, notify=true` for
bounded `herdr agent wait <name> --timeout 120000` calls. When the wait exits,
inspect the live agent and written handoff. If still running, start another
bounded wait. Confirmed handoffs drive board transitions; terminal lifecycle
states alone do not. This uses Hermes process notifications, not a separate
job framework. Notification continuation must be exercised before claiming
unattended operation works.

Workers are started with:

```bash
mowa-dispatch-herdr <agent-name> <role> <ticket-path> [codex]
```

Do not use `claude --bg`, raw tmux, or ordinary detached shell sessions for
agents. They disappear from the Herdr board and break the workflow.

## Language

- Szef reports to Szymon in Polish.
- Worker prompts, notes, branches, commits, PR text, and reviews stay English.

## Merge

Only Szymon merges. A reviewer PASS means "ready for Szymon", not merged.
