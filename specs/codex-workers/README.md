# Codex workers

## Goal

Codex runs as a worker kind in the mowa loop next to Claude: Szef dispatches a
reviewer or implementer on Codex with the same command, the same ticket, and
the same notes handoff, so Claude quota is not the only thing that gates the
overnight loop.

## Why now

On 2026-09-12 at 23:59 both running Claude panes (rev-01, impl-15) hit the
Claude session limit. rev-01 died without a verdict. Szymon logged Codex in
the same morning (`codex login status` -> "Logged in using ChatGPT",
codex-cli 0.154.0, model GPT-6). The dispatcher had a `codex` branch that
started Codex with no flags and no role context, so it was never usable.

## Non-goals

- Replacing Claude for implementers. Codex reviewers first; implementers on
  Codex are a follow-up once one review has landed cleanly.
- Codex Cloud, `codex review`, or `codex exec` batch mode. Workers stay
  interactive Herdr agents so the board sees them.
- Changing what a ticket or a notes entry looks like.

## Decisions

- 2026-09-12: Codex gets the role text through `AGENTS.md` in its scratch
  workspace (Codex reads it from cwd; `.claude/` hooks are Claude-only). The
  dispatcher appends the output of `role-context.sh` to the workspace copy
  of `AGENTS.md` for `kind=codex`.
- 2026-09-12: Codex sandbox is `workspace-write` plus `--add-dir
  /home/szymon/mowa` and network on. Verified with `codex exec`: reads roles,
  writes under `specs/`, reaches the network. No `danger-full-access`.
- 2026-09-12: Approval policy `never`; reasoning effort maps from
  `MOWA_EFFORT` (`high` for reviewer/diagnoser, else `medium`).
- 2026-09-12: `MOWA_MODEL` stays a Claude name. Codex uses its default model
  unless `MOWA_CODEX_MODEL` is set.

## Open questions

- Does the Codex TUI show a trust dialog for a fresh scratch workspace? C2
  answers this; the dispatcher has a guard that presses Enter if it does.
- Should Codex implementers land on `byok` the same way (git push from a
  sandboxed shell)? Decide after C2.

## Workstreams

| Ticket | Outcome | Owner session | Status |
|---|---|---|---|
| C1 | Dispatcher and roles support `kind=codex` | szef (launcher scripts are Szef's) | done 2026-09-12 |
| C2 | First live Codex reviewer: verdict on ticket 01 lands in byok notes | rev-01-codex | dispatched |
| C3 | Second Codex reviewer: verdict on ticket 15 | rev-15-codex | waits for C2 to prove readiness |

## Done when

- `mowa-dispatch-herdr <name> reviewer <ticket> codex` starts a Codex agent
  that reads its role, reviews the range from notes, and appends PASS/FAIL to
  `specs/superwhisper-byok/notes.md`.
- `build.md` names Codex as an available reviewer kind.
