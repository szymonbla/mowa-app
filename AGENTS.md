# mowa agent guide

Use this file as the always-loaded project index. Keep process detail in linked docs.

## Project shape

`mowa` is a macOS Electron/Vite/TypeScript app for voice dictation. The main process owns
recording state, permissions, settings, paste behavior, provider requests, and tray/windows.
The renderer owns settings UI, overlay UI, and recorder capture.

## Local checks

Before handing off code that changes behavior, run:

```bash
npm run typecheck
npm test
```

Use `npm run build` when packaging or Electron/Vite boundaries changed. Use
`npm run format:check` when changing broad formatting-sensitive files.

## Coordinator workflow

Use `vision.md`, `build.md`, `AGENT-LOOP.md`, `SZEF.md`, `roles/`, and
`specs/<slug>/` for coordinated multi-agent work. `docs/agents/` is legacy; the
root Slickshift-style files are the active workflow.

## Repo habits

Preserve existing user changes. Make narrow edits that match the current module boundaries.
Prefer shared catalogs in `src/shared/` for provider/language facts. Keep user-facing failure
messages flowing through `src/shared/failure.ts`.
