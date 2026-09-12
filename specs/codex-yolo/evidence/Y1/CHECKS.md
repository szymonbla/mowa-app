# Y1 verification evidence

Only the two active launchers and their README were edited in place. No branch,
commit, push, merge, live worker dispatch, or live worker closure was performed.

## Artifacts

- `before/`: original copies of the three allowed files, saved before editing.
- `after/`: final copies of those files.
- `launchers.diff`: unified before/after diff with explicit file labels.
- `syntax.log`: shell syntax command results for both live launchers.
- `verify-launchers.py`: reproducible temporary-stub argument-capture harness.
- `argv-checks.log`: every mocked check named individually, with PASS results.
- `snapshot-checks.log`: live files match the final copies, with SHA256 values.
- `typecheck.log`: complete typecheck output.
- `test.log`: complete sandboxed test output, including localhost EPERM errors.
- `test-unsandboxed.log`: complete successful test output outside the sandbox.

## Commands and results

Run from `/home/szymon/mowa`:

| Command | Result |
| --- | --- |
| `bash -n scripts/agents/mowa-szef` | PASS, exit 0 |
| `bash -n scripts/agents/mowa-dispatch-herdr` | PASS, exit 0 |
| `python3 specs/codex-yolo/evidence/Y1/verify-launchers.py` | PASS, exit 0; 41 checks |
| `npm run typecheck` | PASS, exit 0 |
| `npm test` inside sandbox | FAIL, exit 1; 9 files failed, 104 passed, 1,468 tests passed, 96 skipped; 9 localhost `listen EPERM` errors |
| `npm test` outside sandbox after escalation | PASS, exit 0; 113 files and 1,564 tests passed |

The harness checks four coordinator settings combinations and all five worker
roles with the same four combinations: defaults, model override, effort
override, and both overrides. It asserts a single `--yolo`, absence of
conflicting approval/sandbox options, exact model and effort, full prompt
contents, coordinator cwd and `MOWA_SZEF`, worker role/pane/kind/timeouts,
`--add-dir`, and implicit/explicit Codex kind. Synthetic goals, ticket paths,
and Why text contain spaces, quotes, backslashes, newlines, Polish characters,
and shell-looking content; marker files must remain absent. The default Why
text is checked separately.

Guard checks cover coordinator missing/empty goal and outside-Herdr invocation;
worker missing/extra arguments, outside-Herdr invocation, traversal/uppercase/
too-long names, invalid role, disabled Claude, invalid kind, missing ticket,
and existing agent; both launchers reject missing Codex. Expected exit codes
and messages are asserted, and no rejected invocation starts or prompts an
agent. All 41 checks are named in `argv-checks.log`.

The harness runs the final copies with temporary `codex`, `herdr`, and `rsync`
stubs and precreated temporary workspaces. Fixtures are removed at completion.
It never invokes real Codex, real Herdr, or the absolute workspace-creation
helper; it does not source goal/ticket content as shell code. An initial harness
attempt lacked the system `env` utility in its isolated PATH; that fixture was
corrected before the recorded successful verification.

The full test command also collected existing `.claude/worktrees/` suites.
The initial failures were sandbox restrictions on localhost binding, not
launcher regressions; the same command passed outside the sandbox. No failures
from existing user changes remained. Preexisting tracked modifications in
`package.json`, `package-lock.json`, `src/main/cleanup/guard.ts`, and
`test/cleanup-guard.test.ts` were left untouched.

Live nested launches and missing-workspace provisioning were not exercised.
Packaging was not run because no Electron/Vite boundary changed. Broad
formatting checks were not run for this narrow launcher/documentation change.
