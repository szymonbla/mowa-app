# 07 - History pane over the transcripts log

## Goal

The user opens Settings, sees past dictations newest first, and can copy one
or delete one without opening the JSONL file in an editor.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `07-history-pane`.

## Resume

A previous session started this ticket and was stopped. Its work is in the
worktree `/home/szymon/mowa/.claude/worktrees/07-history-pane` on branch
`t/07-history-pane` (one commit on top of `byok`, plus uncommitted changes):

- `136dfe7` transcripts: read, pair and delete log entries for the history pane
- Uncommitted: `src/main/ipc.ts`, `src/main/transcripts.ts`,
  `src/preload/index.ts`, `src/renderer/src/settings/Icon.tsx`,
  `src/renderer/src/settings/views.ts`, `src/shared/types.ts`,
  `test/transcripts-history.test.ts`. `HistoryPane.tsx` does not exist yet.

Do not run `git worktree add`; call `EnterWorktree` with that path, read
`git log -p byok..HEAD` and `git diff`, run `npm run typecheck` to see where
the uncommitted half stands, commit what is coherent, then continue with the
pane and the GeneralPane move.

## What is already known

- `src/main/transcripts.ts`: log at `~/.mowa/transkrypty.jsonl`, two lines per
  dictation (`OpenLine` with `id`, `t`, `lang`, `words`, `speechMs`, `raw`;
  `CloseLine` with `id`, `clean`, `outcome`, timings). `clearTranscripts()`
  removes the file. Appends are fire-and-forget.
- IPC in `src/main/ipc.ts` (`transcripts:show`, `transcripts:clear`), preload
  in `src/preload/index.ts`, types in `src/preload/index.d.ts`.
- Settings navigation: `views.ts` (`View`, `NAV`, `TITLES`), `App.tsx`
  renders panes by `view`. Icons are inline SVG in `Icon.tsx`.
- `GeneralPane.tsx` has the "Transkrypty" card with the on/off switch and
  the Pokaz / Wyczysc buttons.
- Tests: `test/transcripts.test.ts` covers writing. `test/e2e` mocks `node:os`
  so the log lands in a temp dir.

## Design

- Add pure functions in `transcripts.ts`: `parseEntries(text): Entry[]`
  (pairs open and close lines by id, tolerates a missing close line and a
  broken line) and `withoutEntry(text, id): string`. `readEntries(limit)`
  reads the file and returns the newest `limit` entries (default 200).
  `deleteEntry(id)` rewrites the file atomically (tmp + rename, mode 0600).
- IPC: `transcripts:list`, `transcripts:delete`, `transcripts:copy` (writes to
  the clipboard in main; the renderer never gets the clipboard API).
- New view `history` ("Historia") with a `HistoryPane`: search box filtering
  on raw and clean text, list rows showing date/time, the clean text if
  present else raw, and the word count. Clicking a row expands raw and clean
  side by side with "Kopiuj" and "Usun". Header buttons: "Odswiez",
  "Wyczysc" (with the same two-step confirm as GeneralPane). When
  `settings.transcripts` is off, the pane says so and offers a switch that
  patches the setting.
- Move the Pokaz / Wyczysc buttons out of GeneralPane into the new pane; the
  on/off switch stays in GeneralPane.

## Done when

- The pane lists entries newest first with raw and corrected text; copy and
  delete work end to end (delete is proven by a unit test on `withoutEntry`
  plus `deleteEntry` against a temp file).
- `parseEntries` has tests for: paired lines, open without close, a corrupt
  line in the middle.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No audio playback, no re-run of a dictation, no export. Do not change the log
format.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
