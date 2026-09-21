# Build

> Living board for Szef and workers. Update on meaningful handoffs. Keep rows
> short; details belong in `specs/<slug>/`.

## Now

Current coordinator request (2026-09-12): `codex --yolo`.
`specs/codex-yolo/`: Y1 implemented, Y2 independently PASS.
Shell syntax, 41 mocked argument checks, typecheck, and all 1,564 tests pass.
Reviewer independently repeated checks; live reviewer startup showed YOLO mode.
The current coordinator conversation also has YOLO permissions, verified on
continuation: `sandbox_mode=danger-full-access`, approval policy `never`.
The YOLO initiative is complete; no action remains for Szymon in this scope.
Old Claude panes impl-15 and rev-01 have been closed after reading their output.
Product code stays with workers.
Szymon clarified the scope as `yolo`: finish the launcher initiative and its
review. BYOK remains queued below.

| ID  | Spec       | Workstream                          | Role / session                   | Status                    | Next |
| --- | ---------- | ----------------------------------- | -------------------------------- | ------------------------- | ---- |
| Y1  | codex-yolo | active launchers and operating docs | implementer / impl-yolo (closed) | done; reviewed PASS       | none |
| Y2  | codex-yolo | independent launch-mode review      | reviewer / rev-yolo (closed)     | PASS; all checks recorded | none |

Initiative: `specs/superwhisper-byok/`. Integration branch `byok`. Szymon
merges `byok` into `main` when the board says so.

Hard rule (Szymon, 2026-09-12 00:30): at most two worker panes at once,
reviewers included; the host has 8 GB and no swap. Close finished panes.
Order of dispatch: finish 01 and 15, then reviews of 06/07, resume 09 and 08,
then wave 2.

| ID  | Spec              | Workstream                                                                          | Role / session | Status                                                         | Next                                          |
| --- | ----------------- | ----------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------- | --------------------------------------------- |
| 01  | superwhisper-byok | provider catalog, separate AI model                                                 | -              | landed d0beef8..470d105; prior reviewer hit limit, pane closed | redispatch Codex review, then wave 2          |
| 06  | superwhisper-byok | full language list                                                                  | -              | landed 22a2be3..80d4444                                        | review when a slot frees                      |
| 07  | superwhisper-byok | history pane                                                                        | -              | landed 136dfe7..b54019d                                        | review when a slot frees                      |
| 09  | superwhisper-byok | input device                                                                        | -              | landed 81fbf6e..e4f54f8                                        | review when a slot frees                      |
| 15  | superwhisper-byok | packaging: electron-builder in package.json, Mac install README, workflow for later | -              | landed dbffc3b..7f3d657 locally; handoff recorded, pane closed | Codex review; must pass before 10, 11, 13, 14 |
| 02  | superwhisper-byok | STT: Groq, Deepgram, Mistral                                                        | -              | waits for 01                                                   | dispatch                                      |
| 03  | superwhisper-byok | AI: Anthropic, Groq, OpenRouter, Gemini                                             | -              | waits for 01                                                   | dispatch                                      |
| 04  | superwhisper-byok | modes in pipeline                                                                   | -              | waits for 01                                                   | dispatch                                      |
| 08  | superwhisper-byok | vocabulary, replacements, STT hint                                                  | -              | paused before edits, research in notes                         | resume when a slot frees                      |
| 05  | superwhisper-byok | modes pane, tray                                                                    | -              | waits for 04                                                   | dispatch                                      |
| 10  | superwhisper-byok | paste options                                                                       | -              | waits for 08                                                   | dispatch                                      |
| 11  | superwhisper-byok | sounds                                                                              | -              | waits for 09                                                   | dispatch                                      |
| 12  | superwhisper-byok | custom OpenAI-compatible endpoint                                                   | -              | waits for 02, 03                                               | dispatch                                      |
| 13  | superwhisper-byok | per-mode shortcuts (stretch)                                                        | -              | waits for 05                                                   | dispatch if time                              |
| 14  | superwhisper-byok | README, final build                                                                 | -              | waits for all                                                  | dispatch                                      |

## Next

- Install Herdr on the cloud host if we want the exact Slickshift pane model.

## Recently done

- 2026-09-12: Switched Szef and all new worker/reviewer launches to Codex.
  Astra handles specs and diagnosis, Sol implementation/review, Terra investigation.
  `codex login status` confirms ChatGPT login. Existing session rows below/above
  describe earlier launches; changing the defaults does not migrate running panes.
  Model overrides: `scripts/agents/README.md`.

- 2026-09-11 23:55: Szef restarted inside Herdr. The first wave-1 workers ran
  as `claude --bg` jobs, invisible to Herdr; Szymon stopped them. Their
  partial work stays on `t/01`, `t/06`, `t/07`, `t/09`; tickets got a
  `Resume` section and wave 1 was redispatched through `mowa-dispatch-herdr`
  (implementers on fable/high via `MOWA_MODEL`). Codex is installed but not
  logged in (it shows the ChatGPT sign-in screen), so reviewers run on Claude
  (fable, high). This login blocker was resolved on 2026-09-12 (see above).

- 2026-09-11: Spec `superwhisper-byok` written, 14 tickets, branch `byok` cut
  from `main` at `c42e652`. Wave 1 dispatched.
- 2026-09-11: H1 closed. `mowa-szef` starts a coordinator that receives
  `SZEF.md` through the hook. Evidence in `specs/herd-loop/notes.md`.

## Waiting on Szymon

- `git push origin byok` is rejected since `dbffc3b` added
  `.github/workflows/release.yml`: the stored token lacks the `workflow`
  scope. Local `byok` is the source of truth tonight; push from the Mac or
  with a wider token.

- Morning: manual macOS pass on `byok` (`npm run dev`, then `npm run build:mac`).
- Merge `byok` into `main` after reading `specs/superwhisper-byok/notes.md`.
- Commit or not: workflow files are still untracked on `main`.
