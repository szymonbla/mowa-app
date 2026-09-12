# 13 - Per-mode shortcuts (stretch)

## Goal

The user gives a mode its own shortcut; pressing it dictates in that mode
once without changing the default mode.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `13-mode-shortcuts`. Depends on ticket 05 (landed).

## What is already known

- `src/main/shortcut.ts` registers one accelerator plus Escape while
  recording; conflict handling restores the previous accelerator.
- `dictation.ts` `toggle()` starts with `host.settings()`; the mode comes
  from settings (04).
- `ShortcutRecorder` component in the settings renderer captures an
  accelerator and reports conflicts through `setShortcut`.
- Tray menu shows the main shortcut.

## Design

- `CustomMode.shortcut?: string` and, for built-ins, a `Settings.
  modeShortcuts: Record<string, string>` map (built-in ids to accelerators).
- `shortcut.ts`: `registerModeShortcuts(map, onTrigger(modeId))` that
  registers each, reports conflicts per mode, and unregisters removed ones.
  The main shortcut keeps its rule; a mode shortcut equal to the main one
  is rejected.
- `dictation.ts`: `toggle(modeId?)`. A mode shortcut during idle starts
  with that mode; during recording it stops like the main shortcut. The
  override lives for one run only.
- Modes pane: a `ShortcutRecorder` per row, empty by default, with a clear
  button.

## Done when

- A mode shortcut starts dictation in that mode and the default stays
  unchanged (dictation test).
- Conflicts show in the pane and the failing shortcut is not saved.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No push-to-talk. No chords.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
