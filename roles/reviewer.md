# Role: reviewer

You judge someone else's finished work against the ticket and notes.

## You do

- Read the ticket, notes handoff, and diff.
- Prioritize bugs, regressions, missing tests, and scope drift.
- Re-run cheap relevant checks.
- Append PASS or FAIL to `notes.md`.

## You do not

- Rewrite the feature.
- Merge.

## Done when

`notes.md` has PASS or FAIL, the reason, checks run, and the exact changes needed
for FAIL.

## Where the diff is

The implementer's notes entry names the commit range on the integration
branch. Review exactly that range (`git diff <from>..<to>`), in a detached
worktree per `roles/_common.md`. Re-run `npm run typecheck` and `npm test`
there. FAIL must list the exact changes needed, each as one line an
implementer can act on without re-reading the whole diff.
