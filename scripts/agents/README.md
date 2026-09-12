# Agent helper scripts

Runtime commands in `/home/szymon/bin` link to these scripts. The active process
is documented in `SZEF.md`, `AGENT-LOOP.md`, and `roles/`.

Run inside Herdr:

```bash
mowa-szef "Dodaj ..."
mowa-dispatch-herdr spec-name spec-writer /home/szymon/mowa/specs/<slug>/tickets/<id>.md
mowa-dispatch-herdr impl-name implementer /home/szymon/mowa/specs/<slug>/tickets/<id>.md
mowa-dispatch-herdr rev-name reviewer /home/szymon/mowa/specs/<slug>/tickets/<id>.md
```

The coordinator uses Hermes profile `szef`; worker dispatch uses Codex through
Herdr. Set up Szef once with `scripts/agents/mowa-setup-szef`, then configure
login with `hermes -p szef model`. The profile's `SOUL.md` links to
`scripts/agents/szef-soul.md`. The launcher resumes the conversation named
`szef`, with project instructions in the initial prompt and worker helpers on
PATH. Pi is optional and not configured. Limen is a reference only.
If the named Szef is already live, the launcher refuses a second coordinator;
return to its conversation with `herdr agent focus szef`.
Claude dispatch is disabled;
login or model errors must be resolved before continuing, with no provider fallback.

| Role                   | Model           | Reasoning |
| ---------------------- | --------------- | --------- |
| Szef / spec-writer     | `gpt-6-astra`   | high      |
| implementer / reviewer | `gpt-5.6-sol`   | high      |
| diagnoser              | `gpt-6-astra`   | high      |
| investigator           | `gpt-5.6-terra` | medium    |

Override one launch with `MOWA_MODEL` and/or `MOWA_EFFORT`. Both coordinator and
worker launchers pass these settings to Hermes and Codex respectively. Existing sessions keep their
current model; these defaults apply to newly launched sessions.

Workers explicitly read `roles/_common.md` and their role file after the ticket.
New coordinator and worker sessions use `--yolo` in their respective CLIs.
Workers retain `--add-dir` for the main
checkout used for worktrees and shared notes. Existing sessions keep their
current sandbox and approval settings. Merge rules remain in `roles/_common.md`;
only Szymon merges.
Keep the board’s limit of two worker panes, including reviewers.

Dispatch creates a Herdr workspace in the main checkout for reading instructions;
workers create/use the ticket's isolated worktree before product edits. It does
not copy the repository or reinstall dependencies in a scratch copy. Dispatch
returns after observed worker activity; it waits up to ten seconds for startup,
so successful text submission alone is not mistaken for a running ticket.
A stalled/timeout result leaves the named agent for inspection before retrying.
Szef uses bounded Herdr waits through Hermes
background terminal commands with completion notifications, then reads handoffs.

`mowa-agent`, `mowa-herd`, `mowa-ticket`, and `mowa-board` are legacy helpers;
use the Herdr commands above for the active workflow.
