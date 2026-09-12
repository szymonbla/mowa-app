# 11 - Start and stop sounds

## Goal

The user hears a short tone when recording starts and another when it stops,
and can turn both off.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `11-sounds`. Depends on ticket 09 (landed): the recorder
already receives a payload with `record:start`.

## What is already known

- The recorder window (`src/renderer/src/recorder/main.ts`) owns an
  `AudioContext` at 16 kHz and a muted output graph. It receives
  `record:start` (with payload after 09), `record:stop`, `record:cancel`.
- No audio assets exist and the CSP allows no external files. Tones must be
  synthesized (`OscillatorNode` + `GainNode` envelope).
- The recording `AudioContext` is suspended between recordings; a separate
  small context for tones avoids fighting with that lifecycle.
- GeneralPane "System" card.

## Design

- `Settings.sounds: boolean`, default `true`. Main passes `sounds` in the
  `record:start` payload and sends a new `record:stop` payload too, so the
  recorder does not read settings.
- `src/renderer/src/recorder/tones.ts`: `playTone(kind: 'start' | 'stop' |
  'cancel')`. Start: two rising short notes; stop: one falling note; cancel:
  one low short note. Total under 150 ms each, gain peak 0.2, exponential
  release. Export a pure `toneSchedule(kind)` returning `[freq, at, dur][]`
  and unit-test it (values and total duration under 150 ms).
- Play start tone before `getUserMedia` resolves, so the user gets the cue
  immediately. Stop tone at `record:stop` before encoding.
- GeneralPane: "Dzwieki" switch in the System card.

## Done when

- Tones play on start, stop, cancel when the setting is on and never when
  off (recorder logic covered by a small unit test on the decision plus
  `toneSchedule` tests).
- Setting persists and renders.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No custom sound files, no volume slider, no error sound.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
