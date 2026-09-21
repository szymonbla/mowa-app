# J2a - Labeled corpus for ambiguous technical terms

## Goal

Know whether an arbiter is worth building before building one.

## Outcome

- A script, `scripts/corpus.ts`, reads `~/.mowa/transkrypty.jsonl` and emits
  every sentence containing a candidate alias, one row per occurrence.
- A checked-in fixture file with the label Szymon applied by hand:

```ts
type CorrectionFixture = {
  transcript: string
  proposal: { original: string; candidate: string }
  shouldApply: boolean
}
```

- A short measurement in notes: how many occurrences, how many are true
  positives, and how many would be wrong if the replacement were unconditional.

## Boundary

`scripts/`, `test/fixtures/`, `specs/jev-decisions/notes.md`. No `src/` changes.

## Starting seam

`src/shared/replacements.ts` already has the whole-word matcher. The candidate
scanner is the same function with a different rule list, so lift
`nextWholeWord` rather than writing a second matcher.

## What is already known

The 347-entry log gives these starting aliases. The first group is safe as
exact replacements and needs no model:

```text
weryfajer → verifier      promty → prompty       brancz → branch
Light LLM → LiteLLM       harness (ok as is)
```

The second group is the actual J2 population — each one is a legal Polish word
on its own:

```text
Potato → poteto           kursor → Cursor        bard → board
```

Required fixture classes, from the report: true positive, true negative,
two independent terms in one utterance, two overlapping candidates, package
and product names, and genuinely undecidable context.

## Done when

- At least 30 labeled rows, with real negatives, not only positives.
- notes.md states the decision: how many errors an unconditional replacement
  would introduce. If that number is zero, J2 is cancelled and the aliases move
  into the exact list instead.

## Scope edge

No JEV call in this ticket. No settings UI for editing aliases.

## Evidence bar

The corpus is one user's real speech. Do not pad it with invented sentences;
an invented negative proves nothing about the threshold.

## Deliverable

Append handoff to `specs/jev-decisions/notes.md`, then stop.
