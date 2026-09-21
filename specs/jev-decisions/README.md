# JEV as a decision layer in the commit path

## Goal

JEV only runs where its answer changes what the user gets: it vetoes a bad AI
correction before the paste, and it arbitrates technical terms that a
dictionary alone cannot resolve safely. Every JEV failure leaves the
deterministic result untouched.

Source: the deep-research report "JEV in Mowa: turn it into a verified
dictation commit layer" (2026-09-21).

## Why now

The report was written without access to this tree, so two of its
recommendations are already overtaken by work in progress:

- "Delete the `change/question/idea/note` classifier" — the uncommitted
  `settings.ts` diff already drops `agentContext` and migrates the key out of
  the store. The classifier is mid-deletion, not a ticket.
- "Exact deterministic replacements stay in code" — `src/shared/replacements.ts`
  already does that.

What the report does not know is that `src/main/text-correction.ts` now sends
the transcript to a generative model (`chat/completions`, 1500 ms) and guards
the answer with two heuristics: a length ceiling and a protected-token check.
That is the part with real risk and no typed decision behind it, so it is where
JEV earns its latency first.

The `~/.mowa/transkrypty.jsonl` log (347 entries, avg 200 chars) shows the
ambiguity class is real and specific to this user:

```text
"jakiegos skilla od Potato"         → poteto        (Potato is a legal word)
"jak to robi kursor"                → Cursor        (kursor is a legal word)
"dac do implementera, weryfajera"   → verifiera
"czesto w branczach, w tytule"      → branchach
"te promty umieszczane"             → prompty
"Mamy jeszcze Light LLM-a"          → LiteLLM
```

Half of these are safe as exact replacements. `Potato` and `kursor` are not:
replacing them unconditionally corrupts a sentence where the user meant the
ordinary word. That is the bounded judgement JEV exists for.

## Non-goals

- Replacing deterministic guards with a probability. `rejectReason`'s URL,
  e-mail, path, number and vocabulary checks are guarantees and they stay. JEV
  is added for meaning drift, which no regex can check. What goes is the length
  ceiling and the `\b[\w-]*[A-Z0-9_][\w-]*\b` alternative, which today
  protects every sentence-initial Polish word.
- Asking JEV to produce text. It only picks among candidates code produced.
- A generic "dictation confidence" score. A number with no branch behind it is
  analytics, not a feature.
- A "JEV verified" badge, dot, or any persistent AI status in the overlay.
  Successful dictation stays silent; only failure becomes UI.
- Automatic re-paste when a verdict says `failed`. A false negative followed by
  an automatic retry produces duplicated text, the worst failure in this app.
- Full macOS Accessibility snapshotting (`kAXFocusedUIElementAttribute`,
  `kAXSelectedTextRangeAttribute`) around the paste. The repo has no native
  code; every cross-app read shells to `osascript`, and `agent-app.ts` already
  budgets 300 ms for one frontmost-app read. Two AX round-trips would cost more
  than every model call in the flow. J3 buys the cheap part of that value.
- Restoring the intent classifier in any form.

## Decisions

- 2026-09-21: We keep the generative corrector the report calls the "wrong
  abstraction", and use JEV to verify its output instead. Rationale: the
  corrector is already built and it fixes punctuation and disfluency, which no
  bounded decision can do. The report's own cookbook pattern — produce an
  artifact, have JEV verify it against evidence, branch in code — applies
  exactly here.
- 2026-09-21: JEV never blocks a clean utterance. J1 calls it only when the
  corrector actually changed the text; J2 calls it only when an ambiguous alias
  matched. No candidates, no call.
- 2026-09-21: Accepted latency on the correction path is up to ~2.2 s
  (1500 ms corrector + 700 ms JEV) between STT and paste, and only there.
  Today's path with `textCorrection` on already costs 1500 ms.
- 2026-09-21: Fail-open everywhere. Timeout, HTTP error, malformed answer or an
  undecisive probability means the deterministic text goes to the clipboard
  unchanged. JEV can improve the baseline, never hold it hostage.
- 2026-09-21: The 700 ms ceiling from the deleted classifier stays. Published
  P50 is not a reason to make the failure window aggressive.
- 2026-09-21: The corrector must not be able to undo an exact replacement.
  Replacements run before it, so the terms they produce (`poteto`, `LiteLLM`)
  join the protected tokens that `rejectReason` still enforces deterministically.
- 2026-09-21: Order of the text pipeline is fixed: STT → exact replacements →
  AI correction → J1 veto → ambiguous proposals → J2 arbiter → paste. Exact
  replacements run before the corrector so the model sees the right spellings.

## Open questions

- Model pin. The code sends `~typesafe/jev-latest`; the report cites
  `typesafe/jev-1.13`. Log the `model` field the Decisions response returns
  from day one, and pin only once a threshold has been calibrated against a
  version.
- Thresholds. J1's veto probability and J2's accept probability start
  conservative (0.8 accept / 0.5 veto) and are calibrated on the corpus, not
  chosen by intuition.
- Zero data retention. OpenRouter documents ZDR routing through provider
  preferences for normal requests; whether the alpha Decisions endpoint honours
  the same preference is unverified. Check before J2 ships, because J2 sends
  sentence context, not just a word.
- What failure does J3 actually detect? Baselining the frontmost app at
  recording start fires every time the user deliberately clicks into the target
  app mid-dictation, which is normal. Baselining right before Cmd+V is
  tautological, because Cmd+V goes to whatever is frontmost. Without a third
  answer the ticket stays parked.
- Does the STT provider expose alternative hypotheses? If it does, they are a
  better proposal source than an alias list. Nothing in `providers/` reads them
  today.

## Workstreams

| Ticket | Outcome | Owner session | Status |
|---|---|---|---|
| J0 | Finish removing the intent classifier | in flight (uncommitted) | in progress |
| J1 | JEV vetoes a correction that changed the meaning | | ready |
| J2 | JEV arbitrates ambiguous technical terms | | recommend cancel: J2a found zero errors |
| J2a | Labeled corpus from `~/.mowa/transkrypty.jsonl` | impl session | done; measurement in notes.md |
| J3 | Warn when the paste went to a different app | | needs a failure case |

Order: J0 → J1 → J2a → (measure) → J2. J0 is a hard prerequisite, not a
preference: `npm run typecheck` currently fails, because `dictation-host.ts`
still reads `agentContext` off `Settings` and the settings diff removed it.

J2 only starts if J2a shows the arbiter beats exact replacements alone. J3 does
not start until the open question below has an answer.

## Done when

- `npm run typecheck`, `npm test` pass; `npm run build` when the Electron
  boundary moved.
- Every JEV failure mode has a test that asserts the deterministic text is what
  gets pasted.
- `~/.mowa/transkrypty.jsonl` records, per dictation: whether JEV was called,
  the returned model id, latency, the probability, and the outcome — never the
  surrounding text.
- Szymon does the manual pass: dictate a sentence containing "kursor" meaning
  the caret and one meaning the editor, and confirm only the second changes.
