# J2 - JEV arbitrates ambiguous technical terms

## Goal

"jak to robi kursor" becomes "jak to robi Cursor", while "ustaw kursor na
koncu linii" stays exactly as spoken.

## Outcome

- `src/shared/replacements.ts` gains a second rule kind: an alias that produces
  a *proposal* instead of an edit.
- Code builds the proposals, resolves overlaps, and sends one batched Decisions
  request with one `noul` per proposal.
- Accepted proposals are applied right to left, and each application re-checks
  that the slice still equals `original` before editing.
- Nothing is proposed, nothing is sent: an utterance with no ambiguous alias
  never reaches the network.

## Boundary

`src/shared/replacements.ts`, `src/main/decisions.ts`, `src/main/dictation.ts`,
the replacements UI in settings, `test/`.

## Starting seam

`applyReplacements()`. Today it takes `Replacement[]` and returns a string. It
splits into a scanner that returns `{ text, proposals }` and an applier that
takes accepted ids — the deterministic path uses both in one call, JEV sits
between them.

## Dependencies

J2a must report that unconditional replacement of these aliases would cause
real errors. If it would not, this ticket does not get built.

## What is already known

- `Replacement` is `{ from, to }` today and is persisted in settings. Adding a
  third field is a store migration; `initSettings()` already filters the array
  through `isReplacement`, so that is where the default goes.
- Proposal shape from the report:

```ts
type CorrectionProposal = {
  id: string
  start: number
  end: number
  original: string
  candidate: string
  leftContext: string
  rightContext: string
}
```

- A false correction costs far more than a missed one: it silently changes a
  word the user really said. The accept threshold starts at 0.8 and only moves
  on corpus evidence.
- Use `noul` per proposal for independent terms. Use one `choice` over complete
  sentence variants only when two proposals overlap, and always include the
  untouched original as a legal option.
- Instructions and criteria in English, transcript and candidates as data.
  JEV's strongest language is English and the transcript does not need to be
  translated for the judgement to be bounded.

## Done when

- Corpus replay: the false-correction rate on J2a's negatives is at or below
  the stated bar, and true positives improve over exact replacement alone.
- Unit tests: zero proposals sends no request; two independent proposals travel
  in one request; overlapping proposals never both apply; a stale offset skips
  that edit instead of corrupting the string; timeout and HTTP error paste the
  deterministic text.
- The settings row for a replacement lets Szymon mark it "wymaga kontekstu",
  with a one-line description: "Zamiana tylko wtedy, gdy zdanie na to wskazuje."

## Scope edge

No phonetic alias generator. Aliases come from observed errors in the log, one
at a time. A speculative table produces speculative corrections.

## Evidence bar

Report the false-correction rate, not overall accuracy. Accuracy hides the one
number that decides whether this ships.

## Deliverable

Append handoff to `specs/jev-decisions/notes.md`, then stop.
