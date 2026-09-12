# Handoff notes

## 2026-09-11 - szef - H1 - mowa-szef

### For Szymon

The coordinator loop works end to end on the cloud host. This session was
started through `mowa-szef` with `MOWA_SZEF=1`, received `SZEF.md` through the
SessionStart hook, and found every canon file in place. No worker was started
because the goal passed to this session was empty (`...`).

### Changed

- `specs/herd-loop/README.md`: H1 marked done, open question added.
- `build.md`: H1 closed, board now waits for the first real goal.
- No product code touched.

### Checked

- Root workflow files present: `SZEF.md`, `vision.md`, `build.md`,
  `AGENT-LOOP.md`, `AGENTS.md`, `roles/*.md`, `specs/_template/*`.
- `/home/szymon/bin/mowa-szef` -> `scripts/agents/mowa-szef` (symlink, executable).
- `.claude/settings.json` registers `szef-context.sh` and `role-context.sh` on
  SessionStart; both scripts exist and gate on `MOWA_SZEF` / `MOWA_ROLE`.
- Working copy state: `npm run typecheck` clean, `npm test` 11 files / 160 tests
  passed with the uncommitted `diagnose()` + `test/eval/` changes in place.

### Decisions needed

1. The first real goal. `mowa-szef` refuses an empty argument, so this session
   was most likely started by hand with a placeholder.
2. Whether to commit the workflow files. Every root workflow file, `roles/`,
   `specs/`, `scripts/agents/`, `.claude/` and `test/eval/` is untracked in git.
   A worker worktree branched from HEAD would not see any of them.
3. What to do with the uncommitted product diff (`guard.ts` `diagnose()` and
   metrics, `package.json` `eval` script, `tsx` + `diff` deps). It passes checks
   but has no ticket and no notes entry.

### Found, not fixed

- Stray `Users/szymon/Programming/side/mowa` directory in the repo root, empty.
  Looks like an rsync path artifact.
- `HERD_SESSION.md` and `docs/agents/` describe the older `/home/szymon/mowa-work`
  layout. `AGENTS.md` already calls them legacy, but a fresh session could still
  follow them. Candidate for deletion or a one-line redirect.
- Roles cannot currently be dispatched through Herdr; workers still need
  `MOWA_ROLE=<role> claude --bg ...` by hand or through `mowa-agent`.

