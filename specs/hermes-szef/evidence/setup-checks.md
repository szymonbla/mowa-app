# Setup checks

- Hermes CLI 0.21.2 installed using the official installer, with setup, browser,
  and computer-use stages skipped. Installed source revision:
  `be82d52cb730f582dd0f554a3ad942fc655c44e8`.
- Native Hermes model wizard imported the existing Codex CLI login and selected
  Astra. `hermes -p szef auth status openai-codex` reports logged in.
- Read-only Hermes/Astra/high/YOLO smoke run read Szef instructions and ran
  `pwd` and `herdr agent list` successfully. Session:
  `20260912_110158_0b8614`.
- Interactive Hermes coordinator registered as `szef` in Herdr pane `wH:p1`,
  workspace `wH`, session `20260912_110332_e2cb2f`.
- `bash -n scripts/agents/mowa-szef scripts/agents/mowa-dispatch-herdr`: PASS.
- Sixteen mocked launcher checks: PASS. See `launcher-checks.json`; they cover
  model/effort, YOLO, literal goal text, Herdr context, duplicate dispatch,
  startup failure, canonical checkout, activity verification, and duplicate coordinator refusal.
- Setup Python syntax and mocked fresh profile, repeated setup, and preservation
  of customized identity: PASS. Credentials are not touched by setup.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 11 files and 147 tests in the current repository configuration.
- `npm run format:check`: FAIL, 31 Markdown files reported at the time of the
  run, mostly existing board/legacy/spec files. Changed coordinator Markdown is
  checked separately; the changed ticket template was subsequently formatted.
  Existing unrelated files were not reformatted.

## Candidate review

The setup files are untracked workflow files in a checkout with unrelated user
edits. There is no product candidate commit. `candidate/` and
`candidate-sha256.json` capture the exact setup contents for independent review.
This snapshot does not include credentials, user transcripts, or product code.

## Runtime proof

See `../smoke-result.md` once HS1 finishes. The disposable fixture is
`/tmp/mowa-hermes-smoke-jwjzk8fm`; it is separate from product branches.
Initial prompt submission falsely appeared settled without worker activity.
Szef recovered autonomously in the same session; dispatch now verifies
`working` within a bounded startup wait instead of treating submission as work.
