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

All sessions use Codex with the existing Codex login. Claude dispatch is disabled;
login or model errors must be resolved before continuing, with no provider fallback.

| Role | Model | Reasoning |
|---|---|---|
| Szef / spec-writer | `gpt-6-astra` | high |
| implementer / reviewer | `gpt-5.6-sol` | high |
| diagnoser | `gpt-6-astra` | high |
| investigator | `gpt-5.6-terra` | medium |

Override one launch with `MOWA_MODEL` and/or `MOWA_EFFORT`. Both coordinator and
worker launchers pass these settings to Codex. Existing sessions keep their
current model; these defaults apply to newly launched sessions.

Workers explicitly read `roles/_common.md` and their role file after the ticket.
Codex uses workspace-write sandboxing and on-request approvals; workers also
receive write access to the main checkout for worktrees and shared notes.
Keep the board’s limit of two worker panes, including reviewers.

`mowa-agent`, `mowa-herd`, `mowa-ticket`, and `mowa-board` are legacy helpers;
use the Herdr commands above for the active workflow.
