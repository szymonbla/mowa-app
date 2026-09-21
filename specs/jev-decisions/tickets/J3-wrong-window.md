# J3 - Warn when the paste went to a different app

**Parked.** The baseline is unresolved: reading the frontmost app at recording
start warns every time the user deliberately clicks into the target app while
speaking, and reading it right before Cmd+V is tautological. Nobody picks this
up until one sentence can say which failure it catches. The rest of the ticket
is the shape it would take if that answer exists.

## Goal

When the text landed somewhere the user was not looking, Mowa says so while
"Wklej ostatni tekst" is still one click away.

## Outcome

- `agent-app.ts` grows a `frontmostApp(): Promise<string | null>` next to the
  existing frontmost read.
- Dictation records the frontmost app at recording start and reads it again
  after a successful Cmd+V.
- Different name, or a name that was null at either end, changes nothing about
  the paste; it only changes the overlay's done state into an actionable one:
  "Wklejono w: <app>" with the existing paste-last action.
- Same name: silent, exactly as today.

## Boundary

`src/main/agent-app.ts`, `src/main/dictation.ts`, `src/main/dictation-host.ts`,
`Overlay.tsx`, `test/`.

## Starting seam

`frontmostIsAgent()` already runs the osascript that answers this, with a
300 ms timeout and a catch that returns a safe default. J3 needs the name
rather than the boolean; the seam is the same execFile call.

## What is already known

- This is the cheap part of the report's paste-verification job. It answers
  "did it go to the wrong window", which is the failure `pasteLast()` was built
  to recover from. It does not answer "did the text arrive intact" — that needs
  AX snapshots and native code, which is a non-goal.
- No JEV in this ticket. Comparing two strings is not a judgement, and the
  report is explicit that a model must not be asked what code can prove.
- The read after the paste must not delay the pill. Fire it after
  `host.paste()` resolves and let the overlay update if the answer arrives
  before the done state hides (`DONE_HIDE_MS` = 600 ms), otherwise drop it.
- Never re-paste automatically on a mismatch. The user decides.

## Done when

- Unit tests on the memory host: same app stays silent; different app shows the
  actionable done state; a null read on either side stays silent; a slow read
  that resolves after the pill hid changes nothing.
- The osascript read never throws into the paste path.

## Scope edge

No accessibility snapshots, no caret positions, no text comparison, no new
permission prompt. If this ticket needs a TCC dialog, it is out of scope.

## Evidence bar

Szymon dictates once into a text editor and once while deliberately clicking
another window mid-recording, and sees exactly one warning.

## Deliverable

Append handoff to `specs/jev-decisions/notes.md`, then stop.
