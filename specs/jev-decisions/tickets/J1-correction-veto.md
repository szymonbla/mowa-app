# J1 - JEV vetoes a correction that changed the meaning

## Goal

The AI corrector can fix punctuation without being able to quietly rewrite what
the user said.

## Outcome

- `text-correction.ts` stops deciding alone. When the model returns a candidate
  different from the input, one JEV `noul` answers "does the candidate preserve
  the meaning, facts and terms of the original?".
- Below the threshold, or on any JEV failure, the raw text is pasted and the
  log says why.
- `rejectReason` keeps the checks that are guarantees — URLs, e-mail
  addresses, paths, numbers, vocabulary terms, empty and non-string answers —
  and loses exactly two things: the `original.length * 1.5 + 30` ceiling, and
  the `\b[\w-]*[A-Z0-9_][\w-]*\b` alternative in `protectedTokens`.
- The terms produced by the exact replacement pass join the protected tokens,
  so the corrector cannot turn `poteto` back into `Potato`.

## Boundary

`src/main/text-correction.ts`, a new `src/main/decisions.ts` (the Decisions
client, lifted from `agent-context.ts` before that file dies),
`src/main/dictation.ts`, `src/main/dictation-host.ts`, `test/`.

## Starting seam

`agentText()` in `src/main/dictation.ts` and the `agentContext()` method on
`DictationHost`. Both are still wired to the classifier that `settings.ts`
already dropped; J1 replaces that seam with a correction seam of the same
shape — host method in, `{ text, log }` out, never throws into the paste path.

## Dependencies

J0 (classifier removal) must land first, or two OpenRouter call sites fight
over the same 700 ms budget.

## What is already known

- `correctText()` already returns `{ text, log }` with an `unavailable` /
  `rejected` / `applied` union. The union is the right shape; only the reason
  for `rejected` changes.
- Measured on the last 20 corpus entries, `protectedTokens` returns 2.4 tokens
  per dictation and they are almost all sentence-initial Polish words: `Czy`,
  `Może`, `To`, `Niżej`, `Zrób`. The check is `candidate.includes(token)`, case
  sensitive, so merging two sentences — the most ordinary punctuation fix there
  is — lowercases such a word and rejects the entire correction. That single
  regex alternative is the defect; the URL, e-mail, path and number
  alternatives are doing real work and stay.
- The length ceiling goes because it duplicates, badly, the judgement JEV now
  makes: a correction can be long and faithful, or short and wrong.
- `AbortSignal.timeout(700)` and the Decisions request shape can be copied
  verbatim from `agent-context.ts`.

## Done when

- Unit tests, on a mocked fetch: candidate accepted above threshold; candidate
  vetoed below it; a candidate that drops a URL, a number or a vocabulary term
  is rejected without reaching JEV at all; JEV timeout, HTTP 500, and a malformed answer each paste the
  raw text; `candidate === text` sends no JEV request at all.
- A test asserts the JEV call happens only after the corrector returned, so a
  disabled `textCorrection` setting costs nothing.
- The log line carries `model`, `ms`, `noul` and the outcome, and no text
  beyond what `raw` already holds.

## Scope edge

Do not touch the exact replacement pass or the vocabulary field. They run
before the corrector and are out of this ticket.

## Evidence bar

Run the ten longest entries from `~/.mowa/transkrypty.jsonl` through the real
endpoint once, by hand, and paste the probabilities into notes. A threshold
picked without seeing real numbers is a guess.

## Found, do not fix

## Deliverable

Append handoff to `specs/jev-decisions/notes.md`, then stop.
