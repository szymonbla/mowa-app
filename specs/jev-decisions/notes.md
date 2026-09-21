# Handoff notes

Append one entry per worker/reviewer session.

## 2026-09-21 - planning - spec drafted from the JEV research report

### For Szymon

The report assumed the classifier was still live and that no corrector existed.
Both assumptions are stale against your working tree, so the spec keeps your
generative corrector and points JEV at verifying it (J1) instead of following
the report's "never generate text" line to the letter. That deviation is in
`## Decisions`; reverse it there if you disagree.

The corpus check found the ambiguity class the report predicted, in your own
log: `Potato` for poteto, `kursor` for Cursor, `weryfajer`, `promty`, `brancz`,
`Light LLM`. Most of those are exact replacements and need no model. Two are
real Polish words, which is what J2 is for and why J2a comes first.

### Changed

`specs/jev-decisions/` only. No source file touched, nothing committed.

### Checked

`~/.mowa/transkrypty.jsonl`: 347 entries, avg 200 chars, enough for J2a.
`PR` 19x, `agent` 19x, `CI` 11x, `Potato` 3x, `kursor` 2x.

### Decisions needed

- Confirm J1 keeps the deterministic guards (URL, path, number, vocabulary) and
  adds JEV only for meaning drift, rather than replacing them wholesale.
- Confirm ~2.2 s STT-to-paste on the correction path is acceptable.
- J3 has no stated failure case yet. Either name one or leave it parked.

### Found, not fixed

`npm run typecheck` fails on `main`+working tree:
`dictation-host.ts(42,33): Property 'agentContext' does not exist on type
'Settings'`. The settings diff removed the field, the host still reads it. This
is J0 and it blocks everything else.

`protectedTokens` on the last 20 log entries returns 2.4 tokens per dictation,
nearly all sentence-initial Polish words (`Czy`, `Może`, `Niżej`). The
comparison is a case-sensitive `includes`, so merging two sentences lowercases
one of them and rejects the whole correction. Merging sentences is the main
thing a punctuation corrector does, so `textCorrection` may be rejecting its
own best output today. J1 covers it.

## 2026-09-21 - impl - J0 + J1 - poteto-mode session

### For Szymon

The pipeline is live behind the `textCorrection` switch, which is off by default. Turn it on in
Ustawienia → Korekta tekstu, where the model field defaults to `openai/gpt-4o-mini`.

One live call to the Decisions endpoint is still missing, and it is the only thing between this and
trusting the threshold. It needs your OpenRouter key, so it is yours to run. If the endpoint does
not return a `model` field, the log records `null` and the correction still applies.

### Changed

Deleted `agent-context.ts`, `agent-app.ts` and their tests. New `decisions.ts` (one noul, 700 ms),
`refine.ts` (replacements → correction → replacements), and `test/refine.test.ts`. `DictationHost`
swapped `agentContext()` for `refine()`. The transcript log's `agent` field became `correction`
carrying the six-variant union. GeneralPane's "Kontekst dla agenta" card became "Korekta tekstu".

`rejectReason` kept the URL, e-mail, path, number and vocabulary guarantees and lost the length
ceiling and the `[A-Z0-9_]` alternative. Replacement outputs joined the protected tokens, so the
corrector cannot undo a replacement.

### Checked

`npm run typecheck` clean. `npm test`: 9 files, 134 tests, all pass. `npm run build` succeeds.
Prettier clean on every touched file. Mutation check: ACCEPT_NOUL forced to 0 fails the
below-threshold test.

Two holes found in review and closed: `decisions.ts` threw when the response omitted `model`,
which turned missing telemetry into a veto and inverted the fail-open policy the rest of the path
follows; `model` is now `string | null` and only the `noul` vetoes. And clearing the model input
in settings would have posted `model: ''` to OpenRouter, so a blank model now short-circuits to
`unavailable` without a network call.

### Decisions needed

- 0.7 is uncalibrated. The README open question says 0.8. Pick one after the live run.
- `vocabulary` and `replacements` persist and validate but have no editor, so both are empty for
  every user. That UI is the next thing, and without it the second replacement pass is a no-op.

### Found, not fixed

The `vetoed` by `jev` variant records `model` and `noul` but no `ms`, so a vetoed correction's
latency is invisible. Harmless until you start measuring the 700 ms ceiling.

## 2026-09-21 - impl - J2a - korpus kandydatow

### Dla Szymona

Zeskanowalem Twoj log i J2 w obecnym ksztalcie nie zarabia na siebie. Dzisiejsza zamiana calego
slowa nie popsula w 314 transkryptach **ani jednego zdania** - czyli arbiter nie ma czego ratowac.
Za to ta sama zamiana **nie widzi 19 z 30** miejsc, gdzie chcialbys poprawki, bo mowisz po polsku
z koncowkami: `branczu`, `Kodeksie`, `weryfajera`, `dzidow`. JEV nigdy nie zostanie o nie zapytany,
bo nic sie nie dopasowalo. To nie jest problem znaczenia, tylko odmiany.

Gdyby dopuscic dopasowanie po rdzeniu, zeby te 19 zlapac, wpada 8 bledow - i 7 z nich to jeden
alias: `bard` -> `board` odpalajace sie na `bardzo` i `bardziej`. To najczestszy polski wzmacniacz,
wiec taka pomylka jest widoczna w kazdym zdaniu.

Zgodnie z "Done when" tiketu J2a: liczba bledow przy bezwarunkowej zamianie wynosi **zero**, wiec
rekomendacja brzmi **anulowac J2** i przeniesc aliasy do listy dokladnej. Decyzja jest Twoja.

Etykiety `shouldApply` nadal agent, nie Ty. Przejrzyj `test/fixtures/ambiguous-terms.ts` - 38
wierszy, kazdy to zdanie, ktore naprawde wypowiedziales.

### Pomiar

314 transkryptow, 69 wystapien kandydata, 38 z nich w korpusie z etykieta (30 poprawnych,
8 blednych).

|                                | wystapienia       | psuje zdanie |
| ------------------------------ | ----------------- | ------------ |
| zamiana calego slowa (dzisiaj) | 11 z 30 chcianych | 0            |
| dopasowanie po rdzeniu         | 30 z 30 chcianych | 8            |

Rozklad blednych: `bardzo`/`bardziej` x7 (alias `bard`), `klaudach` x1 - tam chodzilo o pliki
CLAUDE.md, wiec zadna pisownia `Claude` nie jest poprawna.

Aliasy, ktore log naprawde pokazuje: `kodeks`->Codex (8), `brancz`->branch (4), `Potato`->poteto (3),
`grochbot`->Grokbot (3), `dzid`->JID (3), `flit`->Fleet (2), `kursor`->Cursor (1), `kron`->cron (1),
`piar`->PR (1), `weryfajer`->verifier (1), `promty`->prompty (1), `Light LLM`->LiteLLM (1),
`klaud`->Claude (1), `bard`->board (1 trafiony `Barda`, 38 razy `bardzo`).

Zaden kandydat nie okazal sie dwuznaczny **w tresci**. `Potato`, `kursor` i `kodeks` maja zwykle
polskie znaczenia, ale w 314 transkryptach nie padly ani razu w tym znaczeniu. Czyli populacja,
dla ktorej powstalo J2, jest w tym korpusie pusta.

### Zmienione

`scripts/corpus.ts` (skaner, `--tsv` i `--log`), `test/fixtures/ambiguous-terms.ts` (korpus),
`test/corpus.test.ts` (odtworzenie pomiaru). `nextWholeWord` w `src/shared/replacements.ts` zostal
wyeksportowany, zeby skaner pytal o dokladnie te same dopasowania, ktore wykona zamiana - to jedyne
dotkniecie `src/`, poza granica tiketu, swiadome. `tsconfig.node.json` obejmuje teraz `scripts/**/*.ts`,
bo test importuje skaner.

### Sprawdzone

`npm run typecheck` czysty. `npm test`: 10 plikow, 139 testow, wszystkie przechodza. `npm run build`
przechodzi. Prettier czysty na dotknietych plikach (`npm run format:check` ma 33 wczesniejsze
ostrzezenia, zadne w moich plikach). Test mutacyjny: poluzowanie `nextWholeWord` do dopasowania
prefiksu wywala dokladnie te dwa testy, ktore o tym mowia (8 popsutych zdan, zasieg z 11 na 30).

### Znalezione, nienaprawione

`pryta` -> `prytę` nie lapie sie ani na cale slowo, ani na rdzen, bo polska odmiana zmienia tez
ostatnia samogloske rdzenia. Skaner z sufiksem doklejanym do pelnego aliasu tego nie zobaczy nigdy.

W 314 transkryptach nie ma ani jednego przypadku dwoch nakladajacych sie kandydatow, wiec wymaganie
J2 o rozstrzyganie nakladania nie ma pokrycia w prawdziwych danych. Nie dopisalem takiego zdania -
wymyslony przyklad nie dowodzi niczego o progu.

Korpus to prawdziwa mowa. Repo musi zostac prywatne.
