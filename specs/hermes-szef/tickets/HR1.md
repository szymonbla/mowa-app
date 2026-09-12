# HR1 — Independent setup review

## Outcome

The new Hermes/Szef setup has an independent review of its exact workflow snapshot.

## Boundary

Review `specs/hermes-szef/evidence/candidate/` against the agreed Hermes + Herdr
design and `candidate-sha256.json`. Do not edit setup or product files, invoke
model login, overwrite profiles, push, merge, or touch unrelated sessions.
There is no product candidate commit: untracked setup files are intentionally
captured by SHA-256 for this review. Product worktree/landing instructions do not
apply. Run checks in disposable temporary directories when needed.

## Starting seam

The coordinator and worker launch scripts, setup script, and coordinator identity.
Inspect `evidence/setup-checks.md` and `smoke-result.md` for actual runtime proof.

## Done when

- Check invocation, identity injection, profile preservation, startup activity
  verification, asynchronous handoff handling, and restart behavior.
- Distinguish demonstrated fixture behavior from unverified product workflow.
- Write PASS or FAIL with actionable blocking findings and candidate hashes to
  `/home/szymon/mowa/specs/hermes-szef/setup-review.md`.

## Checks

Verify snapshot hashes and shell/Python syntax. Read the existing launcher
checks and runtime evidence. If using the local mocked launcher checker,
confirm actual files match the snapshot before and after running it.
Native project typecheck and tests already passed; no product code changed.
