# 05 - Modes pane and tray mode switch

## Goal

The user sees the modes, switches the active one from Settings or the tray,
and creates custom modes with their own prompt.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `05-modes-pane`. Depends on ticket 04 (landed).

## What is already known

- `src/shared/modes.ts` (from 04): `BUILTIN_MODES`, `Mode`, `CustomMode`.
  `Settings.mode` (active id) and `Settings.modes` (custom list).
- Navigation: `views.ts`, `App.tsx`; panes such as `HistoryPane`,
  `ModelPane` show the row/card/switch conventions. CSS in `settings.css`.
- Tray in `src/main/tray.ts`: `refreshTrayMenu()` rebuilds the context menu
  from settings; `ipc.ts` calls it after shortcut changes.
- `HomePane` strip shows provider, language, shortcut, status.

## Design

- New view `modes` ("Tryby"), placed right after "Start" in the nav.
  Card "Aktywny tryb": one row per mode (built-in first, then custom),
  radio-style selection like the provider rows in `ModelPane`; each row
  shows name and `desc`, and a "AI" badge for `ai: true`.
- Card "Wlasne tryby": "Nowy tryb" button opens an inline editor (name,
  desc, prompt textarea, AI switch). Save patches `modes`. Custom rows get
  "Edytuj" and "Usun" (two-step confirm like elsewhere). Built-in rows get
  "Duplikuj" which creates a custom copy named "<name> (kopia)".
- Deleting the active custom mode sets `mode` to `correct`.
- Prompt textarea shows a short helper text: the dictated text arrives
  between delimiters as data; answer with the text only; vocabulary is
  appended automatically.
- Tray: a "Tryb" submenu with radio items for every mode; selecting one
  patches `mode` and refreshes the menu. `patchSettings` from the tray goes
  through the same path as IPC so the settings window updates (push a
  `settings:changed` event, or reuse `status:changed` style plumbing).
- Home strip: replace nothing, add a "Tryb" cell. Remove any leftover note
  from 04 in GeneralPane.

## Done when

- The user can switch mode in Settings and in the tray, and both places
  agree after either change (a unit test on a pure `modesMenu(settings)`
  builder in `tray.ts` or a helper module is enough for the tray side).
- Custom modes can be created, edited, duplicated from built-ins, deleted,
  and survive restart; the pipeline uses a custom prompt (dictation or e2e
  test with a custom mode in settings).
- `npm run typecheck`, `npm test`, `npm run build` pass.

## Scope edge

No per-mode shortcut (13). No import/export. No editing of built-ins.

## Evidence bar

Command tails, test names, landed commit range.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
