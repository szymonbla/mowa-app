# 09 - Input device selection

## Goal

The user picks which microphone `mowa` records from, and the app falls back
to the system default when that device is gone.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `09-input-device`.

## Resume

A previous session started this ticket and was stopped. Its work is in the
worktree `/home/szymon/mowa/.claude/worktrees/09-input-device` on branch
`t/09-input-device` (one commit on top of `byok`, plus uncommitted changes):

- `3fcaf4f` input device: pickDevice helper and recorder device query with timeout
- Uncommitted: `src/main/dictation-host.ts`, `src/main/dictation.ts`,
  `src/main/settings.ts`, `src/shared/types.ts` (about 24 lines).

Do not run `git worktree add`; call `EnterWorktree` with that path, read
`git log -p byok..HEAD` and `git diff`, run `npm run typecheck`, commit what
is coherent, then continue with the `record:start` payload, the
`devices:list` IPC and the GeneralPane select.

## What is already known

- Recording runs in a hidden window: `src/renderer/src/recorder/main.ts`
  calls `getUserMedia({ audio: { channelCount: 1, ... } })`. The window is
  created in `windows.ts` (`getRecorderWindow`) and warmed at startup.
- Commands go main to recorder over `record:start|stop|cancel` (see
  `dictation-host.ts` `record()` and preload `recorderApi`). Recorder to main:
  `record:level`, `record:error`, `record:audio`.
- `Settings` in `src/shared/types.ts`, defaults in `src/main/settings.ts`.
  The renderer patches settings through `window.api.patchSettings`.
- `GeneralPane.tsx` has the "Uprawnienia" cards; the microphone row is the
  natural neighbour for a device select.
- Microphone permission must be granted before `enumerateDevices()` returns
  labels.

## Design

- `Settings.inputDevice: string`, `''` = system default.
- Recorder: on `record:devices` request, `enumerateDevices()` filtered to
  `audioinput`, reply with `{ deviceId, label }[]` over IPC. On start, pass
  `deviceId: { exact }` when the setting is non-empty and the id is present
  in the current device list; otherwise default. A pure helper
  `pickDevice(devices, wanted)` in `src/shared/` decides; unit-test it.
- Main: `ipcMain.handle('devices:list')` asks the recorder window and returns
  the list to the settings renderer. Time out after 2 s with an empty list so
  the pane never hangs.
- GeneralPane: a "Mikrofon" select above the permissions card, first option
  "Domyslny systemowy". Refresh the list on window focus like permissions.
- Since the recorder needs the setting, main sends `inputDevice` along with
  `record:start` (payload), so the recorder holds no settings state.

## Done when

- The user selects a device, the choice persists, and the recorder opens that
  device; with the device missing, recording still starts on the default
  (`pickDevice` tests cover both).
- The settings pane lists devices with labels after microphone permission.
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No output device, no level meter per device, no system audio capture.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
