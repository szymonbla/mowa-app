# Standing rules for every worker session

## Ticket first

Your first prompt names a ticket file. Read it before opening anything else.
No ticket path means ask for one and wait.

## Language

Write English in this worker session: notes, commits, review text, and technical
reports. Szef translates for Szymon.

## Scope edge

Do exactly one ticket. Adjacent issues go into `Found, not fixed` in the notes.

## Evidence

A completion claim needs the command behind it:

- typecheck/test/build commands with real output
- what you did not check
- changed files or commits

## Notes

Append your report to `specs/<slug>/notes.md` using the template in
`specs/_template/notes.md`, then stop.

## Merge

Only Szymon merges.

## Workspace and landing

The ticket names an integration branch (currently `byok`). `main` is Szymon's;
never commit to it, never push it.

Set up before the first edit:

```bash
ID=<ticket id, e.g. 01-provider-catalog>
git -C /home/szymon/mowa worktree add /home/szymon/mowa/.claude/worktrees/$ID -b t/$ID byok
ln -s /home/szymon/mowa/node_modules /home/szymon/mowa/.claude/worktrees/$ID/node_modules
```

Use `/home/szymon/mowa/.claude/worktrees/$ID` as the working directory for
every product command. The `.claude` directory name is a legacy storage path.

Your Herdr pane starts in the main checkout to read shared instructions.
All product edits happen in the assigned isolated worktree under
`/home/szymon/mowa/.claude/worktrees/`, notes go to `/home/szymon/mowa/specs/`.

If the ticket has a `Resume` section, the worktree and branch already exist.
Skip `git worktree add` and `-b`; use the existing path as the working directory
and continue from the state the ticket describes.

Create worktrees from the ticket’s integration branch. If the ticket needs a
new npm dependency, remove the symlink and
run `npm install` inside the worktree instead.

Commit on `t/$ID` in small steps. Commit messages are English, one line of
intent, then the attribution lines the harness gives you.

Land when the ticket's checks pass:

```bash
git rebase byok                     # resolve conflicts, re-run checks after
npm run typecheck && npm test
git merge-base --is-ancestor byok HEAD && git branch -f byok HEAD
git push origin byok t/$ID
```

If `is-ancestor` fails, someone landed in between: rebase again. If the push
of `byok` is rejected, `git fetch origin byok`, rebase onto it, and repeat.
Record the landed commit range (`git log --oneline byok~N..byok`) in notes.

Reviewers do not land anything. A reviewer creates a detached worktree of
`byok` to run checks:

```bash
git -C /home/szymon/mowa worktree add --detach /home/szymon/mowa/.claude/worktrees/review-$ID byok
ln -s /home/szymon/mowa/node_modules /home/szymon/mowa/.claude/worktrees/review-$ID/node_modules
```

## Notes path

Notes live in the main checkout, not in your worktree:
`/home/szymon/mowa/specs/<slug>/notes.md`. Append with one shell heredoc.

## Docs, not memory

Provider request shapes and model ids change. When a ticket names an external
API, fetch the current docs using available web tools before writing the request, and put the
URL you read in notes under Checked.
