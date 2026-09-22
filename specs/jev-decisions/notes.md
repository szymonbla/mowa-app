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

Gdyby dopuscic dopasowanie po rdzeniu, zeby te 19 zlapac, w calym logu wpada **39 bledow na 69
wystapien** - i 38 z nich to jeden alias: `bard` -> `board` odpalajace sie na `bardzo` (26 razy)
i `bardziej` (12 razy). To najczestszy polski wzmacniacz, wiec taka pomylka bylaby widoczna
w co drugim zdaniu.

Zgodnie z "Done when" tiketu J2a: bezwarunkowa zamiana calego slowa - ta, ktora aplikacja ma
dzisiaj - wprowadza **zero** bledow. Rekomendacja brzmi wiec **anulowac J2** i przeniesc aliasy do
listy dokladnej. Brakujace 19 poprawek to zadanie dla odmiany, nie dla modelu: wystarczy pozwolic
regule dopasowac koncowke i trzymac `bard` na liscie wyjatkow. Decyzja jest Twoja.

Etykiety `shouldApply` nadal agent, nie Ty. Zdania, z ktorych pochodza, leza poza repo
w `~/.mowa/j2a-corpus.json` - 38 wierszy, kazdy to zdanie, ktore naprawde wypowiedziales.
W repo zostaly same formy, bo repo jest publiczne.

Reczny przebieg z "Done when" spec-a - `kursor` raz jako kareta, raz jako edytor - nie da sie
oprzec na logu: w 314 transkryptach `kursor` pada raz i za kazdym razem chodzi o edytor.

Git: scalilem prace w `main` lokalnie, bez pusha. Przed pushem przeczytaj "Blokada przed pushem"
na koncu tego wpisu.

### Pomiar

314 transkryptow, 69 wystapien kandydata: 30 to miejsca, gdzie zamiana jest poprawna, 39 to
miejsca, gdzie bylaby bledem.

W calym logu:

|                                | trafia w chciane | psuje   |
| ------------------------------ | ---------------- | ------- |
| zamiana calego slowa (dzisiaj) | 11 z 30          | 0 z 69  |
| dopasowanie po rdzeniu         | 30 z 30          | 39 z 69 |

Korpus w `test/fixtures/ambiguous-terms.ts` to 38 z tych 69 wierszy: wszystkie 30 poprawnych
i 8 blednych. Osiem, nie 39, bo powtarzanie tego samego `bardzo` w kolejnych wierszach niczego
nie dodaje. Liczba, ktora decyduje o J2, to ta z calego logu: **39**.

Rozklad blednych w calym logu: `bardzo` x26, `bardziej` x12 (alias `bard`), `klaudach` x1 - tam
chodzilo o pliki CLAUDE.md, wiec zadna pisownia `Claude` nie jest poprawna.

Aliasy, ktore log naprawde pokazuje: `kodeks`->Codex (8), `brancz`->branch (4), `Potato`->poteto (3),
`grochbot`->Grokbot (3), `dżid`->JID (3), `flit`->Fleet (2), `kursor`->Cursor (1), `kron`->cron (1),
`piar`->PR (1), `weryfajer`->verifier (1), `promty`->prompty (1), `Light LLM`->LiteLLM (1),
`klaud`->Claude (1), `bard`->board (1 trafiony `Barda`, 38 razy `bardzo`/`bardziej`).

Zaden kandydat nie okazal sie dwuznaczny **w tresci**. `Potato`, `kursor` i `kodeks` maja zwykle
polskie znaczenia, ale w 314 transkryptach nie padly ani razu w tym znaczeniu. Czyli populacja,
dla ktorej powstalo J2, jest w tym korpusie pusta.

### Zmienione

`scripts/corpus.ts` (skaner, `--tsv` i `--log`), `test/fixtures/ambiguous-terms.ts` (korpus
samych form), `test/corpus.test.ts` (odtworzenie pomiaru). `nextWholeWord` w `src/shared/replacements.ts` zostal
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

### Blokada przed pushem

`gh repo view szymonbla/mowa-app` zwraca `PUBLIC`. Korpus to 38 zdan Twojej prawdziwej dyktowanej
mowy, razem ze wzmiankami o firmie, kolegach i infrastrukturze. Merge zrobilem tylko lokalnie i
niczego nie wypchnalem - `git ls-remote` potwierdza, ze commit nie lezy na zadnym zdalnym branchu.

Zanim `main` pojdzie na GitHub, trzeba wybrac: ustawic repo na prywatne albo wyciac ten plik.
Nie redagowalem zdan sam, bo zmyslone zdanie przestaje byc dowodem - a to jedyne, czym ten
korpus jest.

Rozwiazane w nastepnym wpisie: repo zostaje publiczne, zdania wyszly z repo, pomiar zostal.

## 2026-09-22 - impl - zdjecie blokady przed pushem

### Dla Szymona

Wybrales publiczne repo bez wrazliwych danych, wiec zdania wyszly z repo, a nie repo z GitHuba.
Dwa commity J2a napisalem od nowa, zeby zdania nie zostaly w historii - w publicznym repo
skasowanie pliku nowym commitem niczego nie chowa, bo blob dalej wisi w poprzednim commicie.

Pomiar nic na tym nie stracil. Zadne stwierdzenie w `test/corpus.test.ts` nie czytalo zdania:
wszystkie pytaja o sama forme (`bardzo`, `flit`, `kronie`) i o etykiete. Korpus w repo ma wiec te
same 38 wierszy, tylko bez pola `transcript`, a testy przechodza w tej samej liczbie co wczoraj.

Pelny korpus ze zdaniami lezy w `~/.mowa/j2a-corpus.json`, obok logu, z ktorego powstal. Tam
przegladasz etykiety `shouldApply`, ktorych nadal nie potwierdziles.

### Do decyzji

W repo zostaje slownik aliasow: `scripts/corpus.ts` (`grochbot`->Grokbot, `dzid`->JID,
`flit`->Fleet, `Light LLM`->LiteLLM, `Potato`->poteto), te same nazwy w `specs/jev-decisions/`
i szesc kilkuwyrazowych cytatow w `README.md`. To nazwy narzedzi, nie mowa o ludziach, wiec
zostawilem je swiadomie. Jesli ktoras nazwa jest wewnetrzna, powiedz - wtedy lista aliasow tez
przenosi sie do pliku lokalnego, a skaner czyta ja stamtad.

### Zmienione

`test/fixtures/ambiguous-terms.ts` bez pola `transcript` (i bez zdan). `test/corpus.test.ts`
dopasowany do tego w commicie, ktory go wprowadza, zamiast w nastepnym. `specs/jev-decisions/README.md`:
tabela Workstreams mowila, ze J0 jest niezacommitowane i ze `npm run typecheck` sie wywala -
oba zdania byly nieaktualne od commitu `ff95da8`.

### Sprawdzone

`npm run typecheck` czysty. `npm test`: 10 plikow, 139 testow - tyle samo co przed zmiana.
`npm run build` przechodzi. `git rev-list --objects origin/main..main` plus skan kazdego bloba
w tym zakresie: ani jedno pole `transcript:` nie wchodzi na zdalny branch. Push bez `--force`,
bo `origin/main` dalej jest przodkiem `main`.

### Znalezione, nienaprawione

Stare commity z korpusem zyja jeszcze lokalnie w `refs/t3/checkpoints/*`. Nie ida na `origin`
przy `git push origin main`, ale `git push --all` albo `--mirror` by je zabral.
