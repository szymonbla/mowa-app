# Handoff notes

Append one entry per worker/reviewer session.

## 2026-09-21 - planning - spec drafted from the JEV research report

### For Szymon

The report assumed the classifier was still live and that no corrector existed.
Both assumptions are stale against your working tree, so the spec keeps your
generative corrector and points JEV at verifying it (J1) instead of following
the report's "never generate text" line to the letter. That deviation is in
`## Decisions`; reverse it there if you disagree.

The corpus check found the ambiguity class the report predicted, in your own
log: `Potato` for poteto, `kursor` for Cursor, `weryfajer`, `promty`, `brancz`,
`Light LLM`. Most of those are exact replacements and need no model. Two are
real Polish words, which is what J2 is for and why J2a comes first.

### Changed

`specs/jev-decisions/` only. No source file touched, nothing committed.

### Checked

`~/.mowa/transkrypty.jsonl`: 347 entries, avg 200 chars, enough for J2a.
`PR` 19x, `agent` 19x, `CI` 11x, `Potato` 3x, `kursor` 2x.

### Decisions needed

- Confirm J1 keeps the deterministic guards (URL, path, number, vocabulary) and
  adds JEV only for meaning drift, rather than replacing them wholesale.
- Confirm ~2.2 s STT-to-paste on the correction path is acceptable.
- J3 has no stated failure case yet. Either name one or leave it parked.

### Found, not fixed

`npm run typecheck` fails on `main`+working tree:
`dictation-host.ts(42,33): Property 'agentContext' does not exist on type
'Settings'`. The settings diff removed the field, the host still reads it. This
is J0 and it blocks everything else.

`protectedTokens` on the last 20 log entries returns 2.4 tokens per dictation,
nearly all sentence-initial Polish words (`Czy`, `Może`, `Niżej`). The
comparison is a case-sensitive `includes`, so merging two sentences lowercases
one of them and rejects the whole correction. Merging sentences is the main
thing a punctuation corrector does, so `textCorrection` may be rejecting its
own best output today. J1 covers it.

## 2026-09-21 - impl - J0 + J1 - poteto-mode session

### For Szymon

The pipeline is live behind the `textCorrection` switch, which is off by default. Turn it on in
Ustawienia → Korekta tekstu, where the model field defaults to `openai/gpt-4o-mini`.

One live call to the Decisions endpoint is still missing, and it is the only thing between this and
trusting the threshold. It needs your OpenRouter key, so it is yours to run. If the endpoint does
not return a `model` field, the log records `null` and the correction still applies.

### Changed

Deleted `agent-context.ts`, `agent-app.ts` and their tests. New `decisions.ts` (one noul, 700 ms),
`refine.ts` (replacements → correction → replacements), and `test/refine.test.ts`. `DictationHost`
swapped `agentContext()` for `refine()`. The transcript log's `agent` field became `correction`
carrying the six-variant union. GeneralPane's "Kontekst dla agenta" card became "Korekta tekstu".

`rejectReason` kept the URL, e-mail, path, number and vocabulary guarantees and lost the length
ceiling and the `[A-Z0-9_]` alternative. Replacement outputs joined the protected tokens, so the
corrector cannot undo a replacement.

### Checked

`npm run typecheck` clean. `npm test`: 9 files, 134 tests, all pass. `npm run build` succeeds.
Prettier clean on every touched file. Mutation check: ACCEPT_NOUL forced to 0 fails the
below-threshold test.

Two holes found in review and closed: `decisions.ts` threw when the response omitted `model`,
which turned missing telemetry into a veto and inverted the fail-open policy the rest of the path
follows; `model` is now `string | null` and only the `noul` vetoes. And clearing the model input
in settings would have posted `model: ''` to OpenRouter, so a blank model now short-circuits to
`unavailable` without a network call.

### Decisions needed

- 0.7 is uncalibrated. The README open question says 0.8. Pick one after the live run.
- `vocabulary` and `replacements` persist and validate but have no editor, so both are empty for
  every user. That UI is the next thing, and without it the second replacement pass is a no-op.

### Found, not fixed

The `vetoed` by `jev` variant records `model` and `noul` but no `ms`, so a vetoed correction's
latency is invisible. Harmless until you start measuring the 700 ms ceiling.

