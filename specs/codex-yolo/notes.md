# Handoff notes

## 2026-09-12 - szef - preparation - current coordinator

### For Szymon

Prepared two launcher-only tickets for the requested `codex --yolo` mode.
No product code has been changed. Dispatch awaits a verified live worker count.

### Changed

- Added the codex-yolo initiative and tickets Y1 and Y2.
- Recorded current launch flags, acceptance checks, and independent review gate.

### Checked

- Read SZEF.md, vision.md, build.md, AGENT-LOOP.md, AGENTS.md, active launcher
  scripts, role instructions, and previous initiative handoffs.
- `codex --yolo --help`: exit 0.
- `codex login status`: logged in using ChatGPT.
- `HERDR_ENV=1`.
- `herdr agent list`: sandbox denied access; escalated read requested.

### Decisions needed

- Scope clarification pending: all superwhisper-byok tasks or launcher work only.
- Execution approval pending for access to the Herdr socket; current-session
  sandbox permissions are independent of the requested future launch mode.

### Found, not fixed

- build.md still describes 15 as running despite an implementer handoff already
  recording local completion. Live review/agent state has not yet been verified.
- Existing product work and historical workflow documents remain untouched.

## 2026-09-12 - szef - dispatch - impl-yolo

### For Szymon

Y1 is running in a Codex Herdr session. The original coordinator remains in
its existing sandbox. No product work was dispatched.

### Changed

- Closed old Claude panes impl-15 (w9:p1) and rev-01 (wE:p1) after confirming
  both had reached their session limit; their handoffs and files are retained.
- Corrected board: 15 is locally implemented; 01 still needs a review verdict.
- Started impl-yolo in wF:p1 through mowa-dispatch-herdr on Y1.

### Checked

- Escalated Herdr reads succeeded; two old worker panes were the only workers.
- Both pane-close commands returned success.
- Dispatcher started Codex with gpt-5.6-sol/high and the pre-Y1 sandbox flags.
- The first prompt command reported success but the transcript showed no task.
  After reading live state and the transcript, Szef resubmitted Y1 once.
- The second prompt is visible, followed by reading Y1 and the role files and
  active implementation. No duplicate worker was started.
- Startup issue was a bubblewrap PATH warning with a bundled fallback, not a
  login/model error; no installation or global setting change was attempted.

### Decisions needed

No new decision for the launcher initiative. Pending scope clarification is
handled by completing the current launcher initiative and its review only.

### Found, not fixed

The dispatcher reporting agent_prompted/done did not establish that work had
started. Always inspect task activity and notes before claiming progress.

## 2026-09-12 - implementer - Y1 - impl-yolo

### For Szymon

Completed Y1. New coordinator and Herdr worker launches pass `--yolo` without
conflicting sandbox or approval flags. Defaults, overrides, prompts, ticket
arguments, and Herdr guards are preserved. The README describes disabled Codex
sandboxing/approval prompts for new sessions and preserves the two-worker limit
and Szymon-only merge rule. Existing sessions keep their current settings.
No blocker remains; independent review can use the saved evidence.

### Changed

- `/home/szymon/mowa/scripts/agents/mowa-szef`
- `/home/szymon/mowa/scripts/agents/mowa-dispatch-herdr`
- `/home/szymon/mowa/scripts/agents/README.md`
- Saved original/final copies, `launchers.diff`, the temporary-stub harness,
  verification logs, and `CHECKS.md` under
  `/home/szymon/mowa/specs/codex-yolo/evidence/Y1/`.
- Appended this handoff. Followed the ticket's in-place exception: no worktree
  creation, integration branch change, commit, push, or merge.

### Checked

- `bash -n scripts/agents/mowa-szef`: PASS, exit 0 (`syntax.log`).
- `bash -n scripts/agents/mowa-dispatch-herdr`: PASS, exit 0 (`syntax.log`).
- `python3 specs/codex-yolo/evidence/Y1/verify-launchers.py`: PASS, exit 0,
  41 individually named checks in `argv-checks.log`:
  - Coordinator defaults, model override, effort override, both overrides:
    all PASS; exact multiline goal/full prompt, cwd, and `MOWA_SZEF` preserved.
  - Worker spec-writer defaults, model override, effort override, both overrides:
    all PASS; exact ticket/Why/prompt and Herdr arguments preserved.
  - Worker implementer defaults, model override, effort override, both overrides:
    all PASS; exact ticket/Why/prompt and Herdr arguments preserved.
  - Worker reviewer defaults, model override, effort override, both overrides:
    all PASS; exact ticket/Why/prompt and Herdr arguments preserved.
  - Worker diagnoser defaults, model override, effort override, both overrides:
    all PASS; exact ticket/Why/prompt and Herdr arguments preserved.
  - Worker investigator defaults, model override, effort override, both overrides:
    all PASS; exact ticket/Why/prompt and Herdr arguments preserved.
  - Worker default Why text: PASS.
  - Coordinator missing goal and empty goal: both PASS, exit 2, no launch.
  - Coordinator Herdr guard: PASS, exit 1, no launch.
  - Worker missing arguments and extra arguments: both PASS, exit 2, no launch.
  - Worker Herdr guard: PASS, exit 1, no launch.
  - Worker traversal name, uppercase name, and long name: all PASS, exit 2,
    no launch.
  - Worker invalid role, disabled Claude, and invalid kind: all PASS, exit 2,
    no launch.
  - Worker missing ticket and existing-agent guard: both PASS, exit 1, no launch.
  - Coordinator missing Codex and worker missing Codex: both PASS, exit 1,
    no external calls.
  All successful launches assert one `--yolo`, no conflicting flags, exact
  model/effort, and preserved quoting. Worker checks include role/pane/kind,
  timeouts, `--add-dir`, and implicit/explicit Codex selection. Synthetic shell
  content was never evaluated; no live Codex/Herdr or live workspace was used.
- Final live files compared byte-for-byte with after copies: all three PASS;
  hashes saved in `snapshot-checks.log`; unified diff saved in `launchers.diff`.
- `npm run typecheck` from `/home/szymon/mowa`: PASS, exit 0 (`typecheck.log`).
- `npm test` inside sandbox: FAIL, exit 1; 104 files passed, 9 failed,
  1,468 tests passed, 96 skipped; localhost `listen EPERM` caused 9 errors
  (`test.log`). The command collected existing `.claude/worktrees/` suites too.
- `npm test` retried outside sandbox after escalation: PASS, exit 0;
  113 files and 1,564 tests passed (`test-unsandboxed.log`). No test failures
  caused by existing user changes remained.
- Not checked: live nested launches or missing-workspace provisioning. No build
  required because no Electron/Vite boundary changed. No broad format check
  required for this narrow change. No live workers dispatched or closed.

### Decisions needed

None for implementation. Independent review remains the coordinator's next step.

### Found, not fixed

- Existing tracked changes in `package.json`, `package-lock.json`,
  `src/main/cleanup/guard.ts`, and `test/cleanup-guard.test.ts` were preserved.
- The sandbox blocks localhost test-server binding; the required retry outside
  the sandbox passed. Existing `.claude/worktrees/` tests are included by the
  root test command; test discovery was left unchanged.

## 2026-09-12 - szef - live launch - rev-yolo

### For Szymon

Szymon confirmed launcher-only scope. Y1 is implemented with passing checks;
Y2 was dispatched independently through the changed launcher.

### Changed

Closed completed impl-yolo (wF:p1) after its handoff and done state. Started
rev-yolo (wG:p1) through mowa-dispatch-herdr on Y2. Only one worker remains.

### Checked

Herdr returned agent_started for rev-yolo with these exact arguments:

```
codex --model gpt-5.6-sol -c 'model_reasoning_effort="high"' --yolo --add-dir /home/szymon/mowa
```

No sandbox or approval-policy flags appear. This is a live worker launch;
coordinator invocation is covered by the Y1 stub checks, not a coordinator
restart. Review verdict and confirmed task activity are still pending.

### Decisions needed

None. The current coordinator's existing permissions remain in effect.

### Found, not fixed

Dispatcher returned agent_prompted/done immediately again. Check actual task
activity before relying on that lifecycle status.

## 2026-09-12 - reviewer - Y2 - rev-yolo

### For Szymon

PASS. Independently reviewed Y1's completed handoff, exact before/after artifacts,
saved unified diff, and all three current allowed files. All three acceptance
conditions are satisfied: both new-session launchers pass one `--yolo` without
conflicting flags; the existing dispatch contract is preserved; documentation
and reproducible evidence cover the requested behavior. No blocking findings
or implementer follow-up is needed. Existing sessions retain their current
permissions; this verdict does not claim they change.

### Changed

- Appended this verdict only. No launcher/product edits, fixes, worktrees,
  integration branch changes, commits, merges, pushes, or independent agent
  launches. Review fixtures and logs are under `/tmp/mowa-Y2-kbx8muwa/`.
- Exact reviewed identity: `/home/szymon/mowa/specs/codex-yolo/evidence/Y1/`.
  Independently regenerated `launchers.diff` from the before/after copies and
  matched it exactly; all live files matched after copies byte-for-byte before
  checks and again after the mocked checks.
- SHA256 identities (before -> after/current):
  - `scripts/agents/mowa-szef`:
    `590a486ad73bd514e07c3121f041c2a0864412ed2113ebe4ed3dedbf77e80b87`
    -> `0d0b1439e25ec2bad73f1b6e62738b7b3c597fafb200f7fc907baa9ae519b7c0`.
  - `scripts/agents/mowa-dispatch-herdr`:
    `ae3b748a62c3410de73a1eddf1235a6a36c54ef6020975f8903aef0ce534d951`
    -> `24437d50e7358652a968c6c543227a50420ac57aa8f9a6ce9fed5f71644d1007`.
  - `scripts/agents/README.md`:
    `6a0b8e1ff91b48858e952a02321bf28b7fc02e90ad94c58b0a30ea31fb82d56a`
    -> `6d60cf1195ebf6dac5d0eda29c843969a4588d582a3b3217bf881956158a4431`.
  - `launchers.diff`:
    `a013dadde45d7b1cca1c4d7f89ed9512dd4fbf5605b52ac7592bcacf628ecc8f`.
  - `verify-launchers.py`:
    `7861504f0e62f9ba40c3b0b91320431649af62ee0706adc3c5f1000b6a940ecb`.

### Checked

- Standards review: PASS, no findings. Changes are narrow and stay inside Y1's
  three allowed files; preexisting product modifications were preserved.
- Spec review: PASS, no findings. The diff replaces only the two old
  sandbox/approval flag sequences and updates README behavior. Role/model/effort,
  ticket/prompt handling, Herdr guards, worker-count rule, and Szymon-only merge
  rule remain intact. No conflicting flags occur in the reviewed launch commands.
- `bash -n /home/szymon/mowa/scripts/agents/mowa-szef`: PASS, exit 0.
- `bash -n /home/szymon/mowa/scripts/agents/mowa-dispatch-herdr`: PASS, exit 0.
  These are real shell syntax checks of live files, not live launches;
  results are in `/tmp/mowa-Y2-kbx8muwa/syntax.log`.
- Inspected the full Y1 argument-capture harness before execution. Re-ran its
  unchanged copy with `python3 /tmp/mowa-Y2-kbx8muwa/Y1/verify-launchers.py`:
  PASS, exit 0, 41 checks (`argv-checks.log`). Entirely mocked Codex/Herdr/rsync,
  isolated PATH, precreated temporary workspaces; shell-looking content was
  passed as data and marker files stayed absent. No user text was sourced.
- `python3 /tmp/mowa-Y2-kbx8muwa/verify-live-copy.py`: PASS, exit 0, 41 checks
  against separate copies of the actual live launchers. The sole harness change
  selects `/tmp/mowa-Y2-kbx8muwa/project/scripts/agents` as the launcher directory
  (`live-copy-argv-checks.log`). All launch cases assert one `--yolo`, no
  conflicting flags, defaults/individual/combined overrides for the coordinator
  and all five worker roles, exact multiline prompt/goal/ticket/Why text with
  spaces and shell metacharacters, cwd, MOWA_SZEF, role/pane/kind/timeouts,
  `--add-dir`, and implicit/explicit Codex. Invalid invocation checks assert
  expected exit codes and no launch/prompt: missing/empty goal, argument counts,
  Herdr-only guards, invalid names/roles/kinds, disabled Claude, missing ticket,
  existing agent, and missing Codex.
- `python3 /tmp/mowa-Y2-kbx8muwa/verify-before.py`: PASS, exit 0, 41 checks
  (`before-argv-checks.log`). Independently adapted only the launcher directory
  and flag assertions to expect the original workspace-write/on-request flags;
  the same remaining contract assertions pass on the before artifacts.
- `npm run typecheck` from `/tmp/mowa-Y2-kbx8muwa/project`: PASS, exit 0
  (`typecheck.log`). This is a filesystem snapshot of the current main checkout,
  including existing user changes, with installed dependencies linked from the
  main checkout. Y2 overrides the detached-worktree procedure; generated check
  files remain in `/tmp`.
- `npm test` from that same snapshot: PASS, exit 0; 113 test files and 1,564 tests
  passed, duration 52.91s (`test.log`). This is a real unsandboxed test run,
  including the existing `.claude/worktrees/` suites; no mocked product tests
  and no localhost EPERM failures in this review. Y1's saved syntax, argv,
  snapshot, typecheck, sandbox-failure, and successful retry evidence was also
  inspected.
- Live-start evidence is supplied by Szef's preceding shared-notes entry,
  not independently generated by this reviewer: Herdr returned `agent_started`
  for rev-yolo with `codex --model gpt-5.6-sol -c
  'model_reasoning_effort="high"' --yolo --add-dir /home/szymon/mowa`.
  It has no sandbox or approval-policy flags. This session's execution of Y2
  confirms task activity. No live coordinator restart was checked; coordinator
  argv verification is mocked. No additional live workers were started/closed.
- Not checked: missing-workspace provisioning and an independent live launch.
  No build or broad formatting check was required for this narrow launcher-only
  change with no Electron/Vite boundary changes.

### Decisions needed

None. PASS; reviewer stops after this report.

### Found, not fixed

- No new findings in the reviewed scope. Existing product changes and root test
  discovery of `.claude/worktrees/` suites remain as recorded in Y1.
- Szef's previously recorded immediate `agent_prompted/done` reporting behavior
  is outside Y1's diff; successful status alone is not evidence of task activity.

## 2026-09-12 - szef - completion and current-session follow-up

### For Szymon

Y1 and Y2 are complete with independent PASS. New worker startup visibly shows
permissions: YOLO mode. Szymon's additional request to switch the current
coordinator still needs an exit/resume of that existing process; not yet done.

### Changed

Updated the board and spec with completion evidence and the exact current-session
resume command. No product code, merges, commits, or pushes were performed by
this coordinator. Prior tracked changes retain the same diff stat as at entry.

### Checked

Read the full Y1 handoff and independent Y2 PASS. Both report passing typecheck
and 1,564 tests across 113 files; launcher syntax and 41 argv cases pass.
Y2 also checks live-copy and baseline argv behavior. Read the live reviewer
startup showing permissions: YOLO mode. Local resume help and help-only parse
accept the exact-session resume command with --yolo.

### Decisions needed

Current process must be exited by the user and resumed in the same Herdr pane:
`codex --yolo resume 01a09487-eaf9-7a42-b9ca-3720a37577e3`.
This preserves the exact conversation; --last could select a worker instead.
An in-turn assistant cannot change its own active execution-permission policy.

### Found, not fixed

The current-session transition is pending until its new permissions are verified.
BYOK backlog remains outside the user's confirmed YOLO-only scope.

## 2026-09-12 - szef - current-session YOLO verified

### For Szymon

The current coordinator now has YOLO permissions. The launcher initiative and
the additional current-session request are complete.

### Changed

Closed the pending current-session entry in the board and spec. Only coordinator
documentation was edited during this continuation; no product work was started.

### Checked

Active runtime instructions explicitly report `sandbox_mode=danger-full-access`,
approval policy `never`, and enabled network access. The environment reports an
unrestricted filesystem. This is direct evidence of the current permissions;
the exact restart mechanism was not observed.

Both executable launcher SHA-256 hashes still match Y2's reviewed artifacts.
The launcher README has a subsequent change describing the target Hermes
coordinator and current Codex launchers; it was preserved. Y2's PASS applies to
its saved artifacts, not that later documentation edit. No executable changes
or new test failures require repeating the recorded passing checks.

### Decisions needed

None for the YOLO scope. BYOK remains outside Szymon's confirmed request.
