# Codex YOLO launches

## Goal

Szymon can run the mowa coordinator and its new Herdr workers with
`codex --yolo`, so unattended sessions use the launch mode he requested.

## Intent and scope

Szymon's goal on 2026-09-12 was `codex --yolo`, followed by a request to
continue and finish all tasks. This initiative covers the two active launchers
and their operating documentation. Szymon subsequently clarified the scope as
`yolo`: finish the launcher initiative and its review; leave BYOK queued.

`--yolo` disables Codex approval prompts and command sandboxing for new sessions.
Changing the launchers does not change an already running session's permissions,
authorize merges, or change the two-worker limit.

## Initial evidence

- Before Y1, both active launchers passed `--sandbox workspace-write` and
  `--ask-for-approval on-request`.
- `codex --yolo --help` exits 0; local help describes the canonical flag
  `--dangerously-bypass-approvals-and-sandbox`.
- `codex login status` reports `Logged in using ChatGPT`.
- `HERDR_ENV=1`; initial `herdr agent list` failed with `Operation not
  permitted` in this session's sandbox. The escalated read succeeded. Two old
  Claude workers had hit their session limit; their panes were closed after
  reading their output and existing handoffs.
- Launcher files are untracked user files in the main checkout, and runtime
  commands link to them. Preserve all pre-existing work.

## Workstreams

| Ticket | Outcome | Status |
|---|---|---|
| Y1 | Both active launchers pass the requested mode; docs and argument checks agree | done; reviewed PASS |
| Y2 | Independent reviewer checks Y1 and records a verdict | PASS; typecheck and 1,564 tests pass |

## Existing coordinator follow-up — complete

On continuation on 2026-09-12, the active runtime instructions confirm
`sandbox_mode=danger-full-access` and approval policy `never`, with network
access enabled. The environment also reports an unrestricted filesystem.
This satisfies the current-session YOLO request; no further restart is needed.

Szymon also requested YOLO mode for the current coordinator. Launcher changes
do not alter an already running process. This conversation's exact session ID
is `01a09487-eaf9-7a42-b9ca-3720a37577e3`, obtained from CODEX_THREAD_ID and
CODEX_SESSION_ID (both agree). The previously supplied resume command was:

```bash
codex --yolo resume 01a09487-eaf9-7a42-b9ca-3720a37577e3
```

The installed `codex resume --help` supports an exact session ID. Avoid `--last`
because worker sessions have started more recently. Permissions are now verified
from the active runtime configuration. Do not start BYOK work;
Szymon explicitly restricted this initiative to YOLO.

## Dispatch and completion

Use only `mowa-dispatch-herdr` and Codex. Confirm live agents before dispatch;
at most two workers including reviewers. Leave unrelated running work intact.
Y2 may start only after Y1 has an evidence-backed handoff. No product edits,
merges, pushes, credential changes, or changes to global Codex settings.

## Notes

Handoffs: `specs/codex-yolo/notes.md`.
