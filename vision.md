# Vision

> Human-owned durable intent for `mowa`. Agents may propose edits; they do not
> rewrite this file unprompted.

## Product principles

- `mowa` is a quiet macOS dictation app: press a shortcut, speak, press again,
  and the text lands in the active field and clipboard.
- The product should feel local, fast, and predictable. Provider complexity stays
  behind the settings UI.
- User-facing failures are short and useful. Full technical detail belongs in
  settings, logs, or handoff notes.
- The app handles private voice input and API keys. Treat secrets, transcripts,
  screenshots, and test fixtures as sensitive by default.
- Szymon decides product direction and merges. Agents provide evidence and
  reviewed branches, not production decisions.

## Engineering principles

- One human; one coordinator conversation; many focused worker sessions.
- Durable intent, board state, specs, tickets, and handoffs live in files, not
  only in chat history.
- One ticket fits one fresh session. A session that overflows context is evidence
  the ticket was too large; split and redispatch.
- Implementer and reviewer are different sessions when the change is risky.
- Evidence before claims of completion: commands, counts, diffs, and review
  verdicts.
- Merge stays human.

## Reference workflow

```text
HUMAN -> SZEF -> tickets/specs -> WORKERS -> notes/reviews -> SZEF -> HUMAN
```

Rules that guide the loop:

- `AGENT-LOOP.md` - how work proceeds.
- `roles/*.md` - what a session owns.
- `AGENTS.md` - project coding rules and checks.
- `specs/<slug>/` - one initiative, its tickets, notes, and review evidence.

## Current direction

- Make autonomous overnight work possible on the cloud host.
- Keep the loop inspectable: every background worker must leave a ticket and a
  notes entry.
- Prefer small reviewed changes over one long session that tries to solve the
  whole product at once.
