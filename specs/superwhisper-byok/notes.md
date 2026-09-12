# Handoff notes

Append one entry per worker/reviewer session. Use a single shell append
(`cat >> notes.md <<'EOF' ... EOF`) so parallel sessions do not clobber each
other. Never rewrite earlier entries.

## <YYYY-MM-DD> - <role> - <ticket id> - <session name>

### For Szymon

### Changed

### Checked

### Decisions needed

### Found, not fixed


## 2026-09-11 - implementer - 07-history-pane - impl-07 (resumed)

### For Szymon

Settings has a new "Historia" tab between Model and Ustawienia. It lists past
dictations newest first: one line per entry with the corrected text (raw when
there is no corrected one), date/time, word count and language. A search box
filters on raw and corrected text. Clicking a row expands it into two columns,
raw and corrected, each with its own "Kopiuj"; the corrected column explains
itself when it is empty (correction off, skipped, failed, or still pending).
"Usun" removes that entry from the file, "Wyczysc" removes everything; both
ask "Na pewno?" on the same button before acting. "Odswiez" reloads the list.
When transcript logging is off, a card at the top says so with a switch that
turns it back on; older entries stay visible and deletable. GeneralPane keeps
only the on/off switch; "Pokaz plik" moved to a link at the bottom of the
history pane. Copy runs in main through Electron's clipboard, the renderer
never sees a path or the file.

Not verified in the running app: this session has no macOS and no display.
Everything UI-side is covered by typecheck and the production build only.

### Changed

Landed on `byok` as `136dfe7..b54019d` (3 commits, pushed as new remote
branches `byok` and `t/07-history-pane`):

- `136dfe7` transcripts: read, pair and delete log entries for the history pane
  (previous session) — `parseEntries`, `withoutEntry`, `readEntries`,
  `deleteEntry` in `src/main/transcripts.ts`; `test/transcripts-history.test.ts`.
- `21e1c7b` history: flat TranscriptEntry in shared types, IPC list/delete/copy,
  nav entry — `Outcome` and `TranscriptEntry` moved to `src/shared/types.ts`;
  `transcripts:list|delete|copy` in `src/main/ipc.ts`; `listTranscripts`,
  `deleteTranscript`, `copyText` in `src/preload/index.ts`; `history` view in
  `views.ts`; `clock` and `search` icons. This was the previous session's
  uncommitted half; it typechecked and tested clean as found, committed as is.
- `b54019d` history pane — new `src/renderer/src/settings/HistoryPane.tsx`,
  `App.tsx` renders it, `GeneralPane.tsx` loses the Pokaz/Wyczysc row and its
  confirm state, `settings.css` gets a `.history-*` block.

### Checked

- `npm run typecheck` — both tsconfigs, no output (clean).
- `npm test` — `Test Files 10 passed (10)`, `Tests 154 passed (154)`.
  Ticket tests in `test/transcripts-history.test.ts`: paired lines, open
  without close, corrupt line in the middle, close without open;
  `withoutEntry` cuts both lines and leaves unparseable lines; `deleteEntry`
  rewrites a temp file and keeps mode 0600; `readEntries` newest-first with
  limit, empty when the file is missing.
- `npm run build` — electron-vite build succeeded, settings bundle 47.57 kB.
- `npx prettier --check` on the four renderer files — clean.
- Not checked: the pane in a running Electron window (no macOS here); no
  renderer tests exist in this repo and none were added.

### Decisions needed

- Per-entry "Usun" also uses the two-step "Na pewno?" confirm. The ticket
  required it only for "Wyczysc". Easy to drop if it feels heavy.
- When logging is off the pane still lists and lets you delete old entries,
  rather than hiding the list. Seemed more useful for cleaning up.

### Found, not fixed

- `readEntries` reads the whole file every time; at 200-entry limit that is
  fine for months of use, but a multi-MB log will make "Odswiez" noticeably
  slow. Reading from the end would fix it, out of scope here.
- The `lang` shown in the row meta is the raw id (`pl`), not the label from
  `LANGUAGE_LABELS`; a one-line follow-up if it bothers anyone.

## 2026-09-11 - implementer - 06-languages - impl-06

### For Szymon

The language select now offers 58 entries: Auto, Polski, English pinned at the
top in their own `<optgroup>`, then the 55 remaining Whisper languages sorted
by their own name (with diacritics, e.g. "Čeština", "Español"). Every non-auto
id is a two-letter ISO 639-1 code and reaches the provider unchanged as
`language` (xAI, OpenAI) or `language_code` (ElevenLabs). `LanguageId` is
still derived from the array. Landed on `byok` as `22a2be3..80d4444`.

The resumed session's uncommitted catalog and test matched the Design, so I
committed them as-is and added the select grouping plus the provider tests.

### Changed

- `src/shared/languages.ts`: `PINNED` (auto, pl, en) + `OTHERS` (55 ISO 639-1
  codes with native-name labels), one shared `desc` for non-pinned entries,
  new `pinned` flag on `LanguageEntry`.
- `src/renderer/src/settings/GeneralPane.tsx`: two `<optgroup>`s
  ("Najczesciej" / "Pozostale") instead of a flat option list.
- `test/languages.test.ts` (new): pinned order, two-letter lowercase ids,
  unique ids, count 58, rest sorted by label, shared desc, `spokenLanguage`.
- `test/providers.test.ts`: new `languageField` per case and a test per
  provider that a non-pinned language (`cy`) arrives as its ISO code.

Commits on `byok`:

```
80d4444 Group language select into pinned and rest; test ISO code reaches each provider
22a2be3 Language catalog: 57 Whisper languages, pinned Auto/Polski/English first
```

### Checked

- `npm run typecheck`: clean (both tsconfigs).
- `npm test` after rebase onto byok (`b54019d`): 11 files, 164 tests passed.
  New test names: "katalog jezykow" suite (7 tests) and
  "<provider>: jezyk spoza przypietych idzie jako kod ISO 639-1" x3.
- `npm run build`: `✓ built in 6.50s` (before the rebase; only tests and
  typecheck were re-run after it).
- `npx prettier --check` on the four touched files: clean.
- Docs read:
  - https://developers.openai.com/api/docs/guides/speech-to-text — the
    "Supported languages" section no longer names the 57 languages. It says
    the `language` field takes "ISO 639-1 codes, such as en, es, and fr" and
    points at the Whisper GitHub list for whisper-1 (98 languages). The 57 in
    the catalog are the historical OpenAI "below 50% WER" set; codes checked
    against https://github.com/openai/whisper/blob/main/whisper/tokenizer.py.
  - https://elevenlabs.io/docs/api-reference/speech-to-text/convert —
    `language_code`: "An ISO-639-1 or ISO-639-3 language_code ... Defaults to
    null, in this case the language is predicted automatically."
  - https://docs.x.ai/developers/model-capabilities/audio/speech-to-text —
    `language` is a two-letter code; `format=true` requires it.
- Not checked: the app in the real UI (no macOS here), and no live provider
  calls with the new codes.

### Decisions needed

None.

### Found, not fixed

- xAI documents only 25 language codes for `language` (ar, cs, da, nl, en,
  fil, fr, de, hi, id, it, ja, ko, mk, ms, fa, pl, pt, ro, ru, es, sv, th, tr,
  vi). The docs do not say what happens with the other 32 codes we can now
  send, and xAI spells Filipino `fil` while the catalog has Whisper's `tl`.
  Out of scope per "no per-provider capability matrix"; worth a live check.
- `settings.ts` spreads the saved file over defaults without validating
  `language`. A stale or hand-edited id survives into `Settings`; the select
  then shows nothing selected and `LANGUAGE_LABELS[...]` is undefined. Same as
  before this ticket, just a larger id space now.
- `.gitignore` has `node_modules/` (trailing slash), so the `node_modules`
  symlink in worker worktrees shows as untracked. Harmless if you `git add`
  by path.

## 2026-09-11 - implementer - 09-input-device - impl-09

### For Szymon

Resumed the earlier session's worktree. The user can now pick a microphone in
Ustawienia → Ogolne (new "Mikrofon" card above "Uprawnienia"). The choice is
saved in `Settings.inputDevice` (`''` = system default). On every dictation
start, main sends the chosen id with `record:start`; the recorder checks it
against `enumerateDevices()` and opens it with `deviceId: { exact }`, or falls
back to the default when the device is gone. A selected-but-missing device stays
selected and shows as "Odlaczony mikrofon" in the select, with a note that the
default records until it returns.

Landed on `byok` (four commits, after a rebase over the history and language
tickets):

```
e4f54f8 input device: microphone select in the general pane, refreshed with permissions
29fe072 input device: recorder opens the chosen microphone, main brokers the device list
faa9958 input device: setting, start payload carries the chosen microphone
81fbf6e input device: pickDevice helper and recorder device query with timeout
```

Pushed `byok` (`80d4444..e4f54f8`) and `t/09-input-device`.

### Changed

- `src/shared/devices.ts`: `AudioDevice`, `DEFAULT_DEVICE`, `RecordStart`
  (moved here from `dictation.ts` because the preload types it and the web
  tsconfig cannot see `src/main`), `audioInputs()` (keeps `audioinput`, drops
  Chrome's virtual `default`/`communications` entries), `pickDevice()`.
- `src/shared/types.ts`, `src/main/settings.ts`: `inputDevice` setting with
  `''` default.
- `src/main/device-query.ts` (from the earlier session): ask/reply broker
  with 2 s timeout, one question in flight.
- `src/main/dictation.ts`, `src/main/dictation-host.ts`: `DictationSettings`
  and `record('start', { inputDevice })`.
- `src/main/ipc.ts`: `devices:list` handle → asks the recorder window over
  `record:devices`; `record:devices` reply from the recorder.
- `src/preload/index.ts`: `api.getInputDevices()`, `recorder.onStart(payload)`,
  `recorder.onDevices()`, `recorder.sendDevices()`.
- `src/renderer/src/recorder/main.ts`: `start(payload)` computes the
  `deviceId` constraint (skips enumerating for the default), answers device
  queries, replies with `[]` if `enumerateDevices()` throws.
- `src/renderer/src/settings/GeneralPane.tsx`: "Mikrofon" card with the select,
  first option "Domyslny systemowy"; description changes with permission state
  and with a missing device.
- `src/renderer/src/settings/App.tsx`: `devices` state, fetched together with
  permissions (startup, window focus, after each permission request).
- Tests: `test/devices.test.ts` (`pickDevice` x4, `audioInputs` x1),
  `test/device-query.test.ts` (x4), `test/dictation.test.ts` (new
  "rozkaz start niesie mikrofon z ustawien, bo recorder sam ich nie zna";
  fake host now records `starts`).

### Checked

After the rebase onto `byok` at `80d4444`, all in the worktree:

- `npm run typecheck`: clean (both tsconfigs).
- `npm test`: 13 files, 174 tests passed.
- `npm run build`: `✓ built in 7.89s`.
- `npx prettier --check` on the touched files: clean.
- Rebase conflicts: `src/main/ipc.ts` (history handlers vs device handlers,
  kept both) and `GeneralPane.tsx` (byok removed the `confirming` state when
  history moved to its own pane; kept only my `missing` line). No behaviour
  invented in either.
- Not checked: the real app on macOS. Nobody here has confirmed that
  `enumerateDevices()` returns labels in the hidden recorder window after the
  system microphone permission, nor that `deviceId: { exact }` picks the
  intended device on hardware. The 2 s timeout path is covered by unit tests
  only.
- No external API was involved; nothing fetched.

### Decisions needed

- The "Odlaczony mikrofon" option for a selected-but-missing device is a small
  step past the ticket's design (which only said: fall back to default). Without
  it the select silently shows "Domyslny systemowy" while the setting still holds
  the old id. Drop it if you prefer the select to reflect the effective device.

### Found, not fixed

- The device list refreshes on window focus and after permission requests, as
  the ticket asked. Plugging a microphone in while the settings window is
  already focused needs a refocus. `navigator.mediaDevices.ondevicechange` in
  the recorder could push updates; out of scope.
- `settings.ts` still spreads the saved file over defaults without validating
  fields, so a hand-edited `inputDevice` of the wrong type would reach the
  recorder. `pickDevice` treats anything not on the list as default, so it
  cannot break recording, but the general point from the language notes stands.
- The `record:start` listener in the preload passes the payload through
  untyped at runtime; a `record:start` sent without a payload (none exist now)
  would throw on destructuring in the recorder.

## 2026-09-12 - implementer - 09-input-device - impl-09 (paused)

Stop request from Szef arrived after the ticket had already landed. Nothing
remains on this ticket.

- Done: full ticket, landed on `byok` as `80d4444..e4f54f8` and pushed, with
  `t/09-input-device` pushed too. Full handoff is the entry directly above.
- Worktree `/home/szymon/mowa/.claude/worktrees/09-input-device` is clean
  (only the untracked `node_modules` symlink). No WIP commit was needed.
- Typecheck, tests and build were last run on the landed HEAD `e4f54f8` and
  passed; not re-run after the stop request since no file changed since then.
- Remaining: nothing for a resumed session. Only the manual macOS check listed
  under "Not checked" above.

## 2026-09-12 - implementer - 08-vocabulary-replacements - impl-08 (paused)

### For Szymon

Paused on Szef's request (host memory limit) before the first product edit.
Worktree `.claude/worktrees/08-vocabulary-replacements` on branch
`t/08-vocabulary-replacements` exists at `80d4444` (= `byok`), clean, no
commits of mine. Everything below is research and a decided design; the
next session starts at RED with the tests.

### Changed

Nothing in the repo. `npm run typecheck` on the untouched worktree: clean.

### Checked (docs for the STT hint)

- OpenAI `audio/transcriptions`: `prompt` string, "improve recognition of
  names, acronyms, formatting, or recording-specific vocabulary"; whisper-1
  has a 224-token limit; gpt-4o-transcribe and gpt-4o-mini-transcribe accept
  it; gpt-transcribe accepts it too and additionally has `keywords[]`
  (repeated multipart field, one per term).
  https://developers.openai.com/api/docs/guides/speech-to-text
- xAI `/v1/stt`: `keyterm` string, "Repeat the field for multiple terms
  ... Max 100 terms, each up to 50 characters."
  https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
- ElevenLabs `/v1/speech-to-text`: `keyterms` list of strings, max 1000, each
  under 50 chars and at most 5 words, characters `< > { } [ ] \` not allowed.
  **Using it adds a 20% surcharge on the base transcription cost.** The
  OpenAPI schema (`api.elevenlabs.io/openapi.json`, `Body_Speech_to_Text_v1_speech_to_text_post`)
  declares it `array` of `string` with no `encoding` entry, and the Fern
  Python SDK passes it as a plain `data={"keyterms": [...]}` list, so the
  wire shape is repeated `keyterms` fields.
  https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- Groq, Mistral, Deepgram named in the ticket are not in the provider
  catalog on `byok` (only xai, openai, elevenlabs), so nothing to do for them.

### Decided design (deviations from the ticket, with reasons)

- `TranscribeOptions.vocabulary?: readonly string[]` instead of
  `hint?: string`. Two of three providers want one multipart field per term
  with a per-term length cap, so a pre-joined string would be wrong for
  them. Each spec shapes it: openai -> one `prompt` = terms joined with
  ", " (after `language`); xai -> repeated `keyterm` before `file`;
  elevenlabs -> repeated `keyterms` after `language_code`. Empty list =
  no field at all.
- `applyReplacements(text, rules)` in `src/shared/replacements.ts`: regex
  per rule `(?<![\p{L}\p{N}_])<escaped from>(?![\p{L}\p{N}_])` with `giu`,
  literal `to`, rules in order; text produced by an earlier rule is kept in
  locked segments so later rules cannot re-match it. Empty `from` skipped.
- `dictation.ts`: `DictationSettings` gains `vocabulary` and
  `replacements`; `submit()` computes `chosen` (corrected or trimmed),
  `pasted = applyReplacements(chosen, replacements)`, passes
  `pasted !== chosen ? pasted : undefined` as a third argument to
  `host.logDone`, and pastes `pasted`. `transcripts.close(id, correction,
  final?)` writes `clean = final ?? (corrected ? correction.text : '')`.
- Renderer: view `dictionary` ("Slownik") between Model and Historia, new
  icon `book`; `DictionaryPane` with card "Slownictwo" (input + Dodaj,
  Enter adds, chips with x, dedupe case-insensitively) and card "Zamiany"
  (rows of two inputs + Usun, add row). Replacement inputs are local state
  and patch on blur/Enter, add/remove patch immediately; rows with empty
  `from` are dropped from the patch.
- Settings: `vocabulary: string[]`, `replacements: {from,to}[]`, defaults
  `[]`; `initSettings` spread over defaults already covers old files.

### Remaining work (in order)

1. `test/replacements.test.ts` (word boundary, case, order, Polish
   letters, no re-match) -> `src/shared/replacements.ts`.
2. `test/providers.test.ts`: per-provider hint field tests -> `spec.ts`.
3. `test/cleanup.test.ts` already covers the prompt slot; wire
   `dictionary: () => getSettings().vocabulary` in `dictation-host.ts`.
4. `test/dictation.test.ts`: replaced paste for raw and corrected, `clean`
   logged when replacements change the text -> `dictation.ts`,
   `transcripts.ts`, fake host in the test.
5. `types.ts`, `settings.ts` defaults, `views.ts`, `Icon.tsx`, `App.tsx`,
   `DictionaryPane.tsx`, `settings.css` block.
6. `npm run typecheck && npm test && npm run build`, prettier on touched
   files, rebase on `byok`, land, record range.

### Decisions needed

- ElevenLabs `keyterms` costs 20% extra per request once the vocabulary is
  non-empty. Plan is to send it anyway (the user asked for the terms) and
  say so in the pane; say if you would rather skip ElevenLabs.
- OpenAI gpt-transcribe: plan is `prompt` for all four OpenAI models (one
  shape, all documented). `keywords[]` for gpt-transcribe only is a small
  follow-up if the hint quality turns out weak.

### Found, not fixed

- `EnterWorktree` refuses the worktree path because the Herdr scratch copy
  `/home/szymon/mowa-agents/impl-08` is a separate repo, not the main
  checkout. Working by absolute path in the worktree instead.

## 2026-09-11 - implementer - 01-provider-catalog - impl-01

### For Szymon

Ticket 01 is implemented and landed on local `byok` (`470d105`). The push to
`origin/byok` was rejected: an earlier packaging commit already on local
`byok` (`dbffc3b`, release workflow) needs a token with the GitHub `workflow`
scope. My commits are not the cause. See Decisions needed.

What the user gets: in Settings > Model there are three groups. "Transkrypcja"
lists STT providers with a model select, "Model AI" lists chat providers with
a model select, "Klucze API" shows one key field per provider used in either
group. The home strip shows both "Transkrypcja" and "Model AI". The corrector
sends the chat request to the chosen AI provider with the chosen model. If
that provider has no key, correction is skipped (`skip:no-corrector`); there
is no silent fallback to another provider any more.

Resumed from the previous session's two commits. They did not typecheck
(`PROVIDERS` is a union of literals, so `p.chat` on the ElevenLabs entry was a
type error; `migrate()` rejected partial model maps). Fixed on top, commits
kept.

### Changed

Landed range on local `byok` (8 commits, `git log --oneline byok~8..byok`):

```
470d105 e2e: chat request goes to the chosen AI provider with the chosen model; choice survives restart
636c573 settings pane: transcription, AI model and API keys as separate groups; home strip shows AI provider
14b58bc settings defaults come from the catalog, not from provider ids
1a7c80d key check follows the provider's capability: silent wav for stt, chat ping otherwise
16cacd5 corrector: chat provider and model come from settings, no fallback search
7efae77 catalog: type the entries with optional capabilities, loosen migrate input
5278c1b settings: chatProvider and chatModels, migration extracted from Electron
d0beef8 catalog: entries declare stt and chat capabilities with model lists
```

Files:

- `src/shared/providers.ts`: entries are `{ id, label, keyHint, keysUrl, stt?, chat? }`;
  `CATALOG` typed view, `providerEntry`, `sttProviders`, `chatProviders`,
  `firstSttProvider`, `firstChatProvider`, `DEFAULT_CHAT_MODELS`.
- `src/shared/types.ts`: `Settings.chatProvider`, `Settings.chatModels`.
- `src/main/settings-file.ts` (new): `DEFAULTS`, `RawFile`, `migrate()` without
  Electron. Defaults derive from the catalog, no provider id literals.
- `src/main/settings.ts`: uses `migrate`, adds `getChatModel`, merges `chatModels`
  on patch.
- `src/main/cleanup/chat.ts`: `ChatSpec` lost `model`; `SendOptions.model`;
  `pickCorrector(chatProvider, hasKey)` returns the spec only if it has a key;
  `post()` split from `send()`; new `ping(spec, apiKey, model)` for the key check.
- `src/main/cleanup/index.ts`: deps are `chatProvider()` and `chatModel()`.
  The old `provider()` dep is gone, not kept next to the new ones: the STT
  provider no longer plays any part in picking the corrector.
- `src/main/dictation-host.ts`: wires `chatProvider` and `chatModel` from settings.
- `src/main/status.ts`: `checkKey` probes by capability (silent wav if `stt`,
  chat ping otherwise). 401/403 still mark `invalid`.
- `src/main/ipc.ts`: patching `chatProvider` triggers a key check for it.
- `src/main/index.ts`: startup checks both the STT and the AI provider key.
- `src/renderer/src/settings/ModelPane.tsx`: three groups, shared `Group`
  component. Existing `.row`, `.card`, `.check`, `.lamp` classes only; no CSS added.
- `src/renderer/src/settings/App.tsx`: banner and nav lamp cover a rejected key
  on either provider. `HomePane.tsx`: "Model AI" cell; first cell relabeled
  "Transkrypcja". `views.ts`: subtitle.
- Tests: `test/catalog.test.ts` (new), `test/settings.test.ts` (new, migration),
  `test/cleanup.test.ts` (rewritten selection cases, ping cases),
  `test/e2e/dyktowanie.test.ts` (three new cases).

New test names:

- catalog: "kazdy wpis deklaruje co najmniej jedna zdolnosc", "xAI i OpenAI robia
  STT i czat, ElevenLabs tylko STT", "domyslny model STT to pierwszy z listy, pusty
  dla jednego modelu", "domyslny model czatu to ten, ktory dotad byl wpisany na
  sztywno", "pierwszy dostawca z czatem to xAI"
- settings migration: "pusty plik daje domyslne: xAI robi STT i korekte", "plik bez
  chatProvider bierze dostawce STT, gdy ten ma czat", "plik bez chatProvider bierze
  pierwszego z czatem, gdy dostawca STT go nie ma", "zapisany chatProvider zostaje",
  "brakujace modele uzupelnia domyslnymi, zapisane zostawia"
- cleanup: "bierze wybranego dostawce AI, gdy ma czat i klucz", "nie szuka
  zapasowego, gdy wybrany dostawca AI nie ma klucza", "nie bierze dostawcy bez
  czatu", "wysyla model z ustawien, a nie wpisany na sztywno", "nie wysyla nic, gdy
  wybrany dostawca AI nie ma klucza", "wysyla jedna krotka wiadomosc z wybranym
  modelem i malym limitem", "odrzucony klucz wychodzi jako provider-http 401"
- e2e: "transkrypcja i korekta ida do roznych dostawcow, model z ustawien", "wybor
  dostawcy AI i modelu przezywa restart", "brak klucza u dostawcy AI pomija korekte
  zamiast brac innego"

### Checked

Run in the worktree after `git rebase byok` (three conflicts resolved: the
`inputDevice` default moved into `settings-file.ts`, an import line, and the
`history` title in `views.ts`).

`npm run typecheck`:

```
> tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json
(exit 0, no output)
```

`npm test`:

```
 Test Files  16 passed (16)
      Tests  200 passed (200)
   Duration  14.99s
```

`npm run build`:

```
../../out/renderer/assets/settings-Ckj7oLjq.js    53.61 kB
../../out/renderer/assets/index-B0AoExtV.js      554.46 kB
✓ built in 5.11s
```

Landing: `git merge-base --is-ancestor byok HEAD` ok, `git branch -f byok HEAD`
done. `git push origin byok t/01-provider-catalog` rejected (see below).

Docs read for the chat ping (nothing on a token minimum in either; the ping uses
16 tokens, which is the lowest value the OpenAI Responses API is known to accept):

- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/error-codes (401 for bad or
  under-scoped keys)
- https://docs.x.ai/docs/api-reference and https://docs.x.ai/docs/guides/chat
  (both now document the Responses API only; the chat completions spec in
  `chat.ts` is unchanged and was already in production)

No new chat model ids added beyond the previous session's two OpenAI entries.

Not checked: the app was not run in Electron. The three-group pane and the
five-cell home strip were verified by typecheck and build only, not by eye.
The chat-ping path of `checkKey` has a unit test but no provider in the catalog
is chat-only yet, so it is unreachable from the UI until ticket 03.

### Decisions needed

- Push blocked. `origin/byok` is at `e4f54f8`. Local `byok` has `dbffc3b`
  (release workflow), `7f3d657` (README) and my eight commits on top. GitHub
  rejects any push touching `.github/workflows/release.yml` from this token:
  "refusing to allow an OAuth App to create or update workflow ... without
  `workflow` scope". Either push `byok` and `t/01-provider-catalog` from a
  session whose token has that scope, or grant the scope to this one.
- `CorrectorDeps.provider()` removed rather than kept alongside `chatProvider()`.
  Ticket said "gain"; keeping an unused dep would be misleading. Say if you
  want it back.

### Found, not fixed

- Home strip readiness ignores the AI key. With STT on xAI (key ok) and AI on
  OpenAI (no key), the strip says "Gotowe" while every dictation silently skips
  correction. The "Klucz API" row on Home also only describes the STT key.
- `test/e2e/dyktowanie.test.ts` hardcodes provider origins in `ORIGINY`. Tickets
  02 and 03 need to extend it or derive it from the specs.
- The catalog does not assert that `chat.models` is non-empty. A chat entry with
  an empty list would send `model: ""`. A one-line catalog test would close this.
- `ApiKeyField`'s "Test" button on a provider selected only for AI now runs the
  STT probe when the entry has `stt` (xAI, OpenAI). That proves the key, not
  the chat scope. xAI keys have ACL scopes, so a key can pass Test and fail at
  correction. The existing `cleanup` failure path handles it, but the UI gives
  no hint.
- Worktrees `06-languages`, `07-history-pane`, `09-input-device` still exist
  under `.claude/worktrees/`; their branches appear landed on `byok`.

## 2026-09-11 - implementer - 15-packaging - impl-15

### For Szymon

Packaging is on `byok` locally, but **nothing reached GitHub**. The push of
`byok` and `t/15-packaging` was rejected:

```
! [remote rejected] byok -> byok (refusing to allow an OAuth App to create or
  update workflow `.github/workflows/release.yml` without `workflow` scope)
```

The git credential on this box is an OAuth token without the `workflow`
scope. GitHub refuses any push whose commits add or change a file under
`.github/workflows/`. Since `byok` history now contains that file
(commit dbffc3b), **every worker's push of `byok` is blocked until you act**.
Pick one:

1. Push from a credential that has the `workflow` scope (your own token or
   `gh auth login` with `-s workflow`), then `git push origin byok`. Nothing
   else changes. Recommended.
2. Tell a worker to purge `.github/workflows/release.yml` from `byok`
   history and keep it as a patch in `specs/`. Rewrites 10 shared commits;
   every open worktree has to rebase again.

Morning install, once `byok` is on GitHub (README "Instalacja na Macu"):

```bash
git clone https://github.com/szymonbla/mowa-app.git && cd mowa-app
git checkout byok
npm ci
npm run build:mac        # needs the "SimpleWhisper Local" cert, see README
open dist/mowa-1.0.0-arm64.dmg
```

A DMG built on the same Mac carries no quarantine flag. The
`xattr -dr com.apple.quarantine /Applications/mowa.app` step is only for a
build copied from elsewhere (or the unsigned CI build).

What I did not check: a real `electron-builder --mac` run. This machine is
Linux; the mac packager needs macOS. The config itself was validated with
electron-builder's own schema validator (see Checked), so a config typo is
unlikely, but the first `npm run build:mac` on the Mac is the real test.

### Changed

Landed on `byok` as `dbffc3b..7f3d657` (2 commits, `git log --oneline
e4f54f8..7f3d657`). Later tickets landed on top; `byok` tip at handoff:
`470d105`. `t/15-packaging` points at `7f3d657`.

- `package.json`: new `build` block (below). `electron-builder.yml` deleted.
- `test/packaging.test.ts`: 10 tests pinning the config and the workflow.
- `.github/workflows/release.yml`: `workflow_dispatch` + tag `v*`,
  `macos-14`, setup-node 22 with npm cache, `npm ci`, typecheck, test,
  `npm run build:mac -- -c.mac.identity=null` with
  `CSC_IDENTITY_AUTO_DISCOVERY=false`, `actions/upload-artifact@v7` with
  `dist/*.dmg` and `dist/*.zip`. Never run.
- `README.md`: new section "Instalacja na Macu" before "Build lokalny";
  "Budowanie" now lists dmg + zip, says the config lives in `package.json`,
  and shows the unsigned build line.

Final `build` block:

```json
"build": {
  "appId": "com.szymon.mowa",
  "productName": "mowa",
  "directories": { "buildResources": "build" },
  "files": ["out/**", "package.json"],
  "mac": {
    "category": "public.app-category.productivity",
    "target": [
      { "target": "dmg", "arch": ["arm64"] },
      { "target": "zip", "arch": ["arm64"] }
    ],
    "artifactName": "${productName}-${version}-${arch}.${ext}",
    "extendInfo": {
      "LSUIElement": true,
      "NSMicrophoneUsageDescription": "Aplikacja mowa nagrywa Twoj glos, aby zamienic go na tekst.",
      "NSAppleEventsUsageDescription": "Aplikacja mowa wysyla Cmd+V, aby wkleic transkrypcje."
    },
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "identity": "SimpleWhisper Local",
    "notarize": false
  },
  "dmg": { "artifactName": "${productName}-${version}-${arch}.dmg" }
}
```

Design notes:

- No `mac.icon`: electron-builder's icon resolver lists `icon.png` in
  `buildResources` as a candidate and converts it to `.icns`
  (`app-builder-lib/out/util/iconConverter.js`, `result.push("icon.png")`).
- There is no top-level `zip` config key in the schema. The zip name comes
  from `mac.artifactName`, which applies to all mac targets; `dmg.artifactName`
  is kept because the ticket asked for it (now redundant).
- Unsigned build: `-c.mac.identity=null`. `electron-builder/out/builder.js`
  coerces the string `"null"` to `null` for exactly this key
  ("ability to disable code sign using -c.mac.identity=null"). Verified with
  `normalizeOptions({config:{mac:{identity:"null"}}})` -> `null`.
  `npm run build:mac -- ARG` appends ARG to the end of the script, i.e. to
  the `electron-builder` call.

### Checked

Docs read (the live electron.build pages render client-side and came back
empty to WebFetch; read the sources instead):

- v26 mac page: https://www.electron.build/v26/mac
  (source: `release/v26:website/docs/mac.md`) - "Set `identity: null` to skip
  signing entirely. Set `identity: "-"` to use an ad-hoc signature".
  Default targets zip + dmg. `hardenedRuntime: true` default.
- v26 mac signing: https://www.electron.build/v26/code-signing-mac
  (`release/v26:website/docs/features/code-signing/code-signing-mac.md`) -
  "To skip signing, leave all `CSC_*` environment variables unset and set
  `CSC_IDENTITY_AUTO_DISCOVERY=false`, or set `mac.identity` to `null`";
  CLI form `-c.mac.identity=null`.
- configuration: https://www.electron.build/configuration - `build` key in
  package.json or `electron-builder.yml`; `${ext}` macro.
- icons: https://www.electron.build/icons-and-images - "A single `icon.svg`
  or `icon.png` in your `build/` directory is enough".
- GitHub Actions: https://www.electron.build/github-actions.
- Installed schema `node_modules/app-builder-lib/scheme.json` (26.15.3):
  `mac.identity` type `[null, string]`, `mac.icon` default
  `build/icon.icns`, `mac.notarize` boolean, `TargetConfiguration
  {target, arch}`.
- Note: master docs (labelled "next (v27)") describe `mac.sign.identity`;
  26.15.3 has `mac.identity`. Followed the installed version.
- Action versions via GitHub API `releases/latest`: checkout v7.0.1,
  setup-node v7.0.0, upload-artifact v7.0.1 -> pinned `@v7`.

Commands (in the worktree, on `byok` tip 470d105):

```
npm run typecheck        -> exit 0
npm test                 -> Test Files 16 passed (16), Tests 200 passed (200)
npm run build            -> "✓ built in 3.76s", exit 0
npm run format:check     -> "All matched files use Prettier code style!"
```

Config validation with electron-builder's own validator (Linux, no
packaging):

```
node -e 'getConfig(cwd) then validateConfiguration(cfg)'
  • loaded configuration  file=package.json ("build" field)
  VALID mac.target=[{dmg,arm64},{zip,arm64}] identity=SimpleWhisper Local
```

Tests in `test/packaging.test.ts`: nazywa aplikacje; buduje dmg i zip dla
arm64; nazywa artefakty z architektura; opisuje uzycie mikrofonu w
Info.plist; wskazuje istniejace pliki entitlements i ikony; podpisuje
wlasnym certyfikatem, bez notaryzacji; nie ma juz osobnego
electron-builder.yml; build:mac buduje przed pakowaniem; startuje recznie
albo z taga v*; buduje na macos-14 bez podpisu i wrzuca artefakty.

Not checked: `electron-builder --mac` (needs macOS); the workflow run
(no `gh`, no push); `ssh -T git@github.com` -> "Permission denied
(publickey)", so no SSH route around the token either.

### Decisions needed

- The push blocker above (option 1 or 2). Until then `origin/byok` is stuck
  at `e4f54f8` and the morning clone has none of tonight's work.

### Found, not fixed

- Landing race: I fast-forwarded `byok` to 7f3d657, got the push rejection,
  reset `byok` back to e4f54f8 to rebuild without the workflow, but another
  worker had already rebased onto 7f3d657 and re-landed on top. `byok` is
  consistent (all checks green at 470d105); only the push problem remains.
- The `node_modules` symlink shows as untracked in every worktree:
  `.gitignore` has `node_modules/` (directories only), a symlink does not
  match. Harmless, but `git add -A` in a worktree would try to add it.
- README hardcodes `mowa-1.0.0-arm64` in output paths; a version bump will
  need a README edit.
- `dmg.artifactName` duplicates what `mac.artifactName` already yields.
