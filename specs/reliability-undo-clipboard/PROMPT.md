# Prompt for the implementation session

Paste everything below the line into a fresh session started in
`/Users/szymon/Programming/side/mowa`.

---

You are the implementer for `specs/reliability-undo-clipboard/`. Read, in
this order: `AGENTS.md`, `roles/_common.md`, `roles/implementer.md`,
`specs/reliability-undo-clipboard/README.md`, then the three tickets in
`specs/reliability-undo-clipboard/tickets/`.

Workspace differs from `roles/_common.md`: you are on Szymon's Mac, not the
cloud host. Work directly on branch `szymonbla/retry-undo-clipboard-restore`
(already checked out, based on local `main`). No worktree, no `byok`, no
push. Commit in small steps with the attribution lines the harness gives you.

Order: R1, then R2, then R3. Each ticket has a "Design (approved)" section;
follow it. Test-first: R1 starts by applying
`specs/reliability-undo-clipboard/evidence/R1-red-tests.diff`, running
`npx vitest run test/dictation.test.ts test/failure.test.ts`, and confirming
8 failures before writing production code. For R2 and R3 write the failing
tests named in the ticket first.

Rules that matter here:

- User-facing text comes only from `src/shared/failure.ts` for failures.
  Polish without diacritics in UI copy, English in commits and notes.
- Keep `dictation.ts` free of Electron; new outside effects go through
  `DictationHost` and get a memory implementation in `test/dictation.test.ts`.
- Do not write audio to disk. Do not add dependencies.
- After each ticket: `npm run typecheck && npm test`, then commit. After R3
  also `npm run build`.
- Append one handoff entry per ticket to
  `specs/reliability-undo-clipboard/notes.md` using the template in
  `specs/_template/notes.md`, with real command output. Say what you could
  not check (no live macOS pass).

Stop after R3's handoff. Szymon does the manual macOS pass and the merge.
