# HS1 — wynik testu koordynatora Hermes/Szef

Status: PASS dla przypisanej pętli fixture, z ograniczeniami opisanymi poniżej.
Data wykonania: 2026-09-12, CEST (+02:00). Końcowy handoff odczytany 11:09:06.

## Zakres i źródła

- Koordynator: jedna interaktywna rozmowa Hermes, profil szef, Herdr wH:p1.
- Przeczytano SZEF.md, vision.md, build.md, AGENT-LOOP.md, AGENTS.md i specs/hermes-szef/tickets/HS1.md oraz minimalne role fixture.
- Fixture: /tmp/mowa-hermes-smoke-jwjzk8fm.
- Aktualny ticket: /tmp/mowa-hermes-smoke-jwjzk8fm/specs/smoke/tickets/S1.md.
- Oryginalne pisemne handoffy pozostają wyłącznie w fixture: /tmp/mowa-hermes-smoke-jwjzk8fm/specs/smoke/notes.md (initial, corrected, independent PASS).
- Nie realizowano backlogu produktu. Szef zmieniał ticket i raport, nie kod fixture ani mowa. Kod fixture implementował worker. Bez push, merge, instalacji Limen/Pi i zmian cudzych sesji.

## Sesje i Git

| Etap | Sesja / Herdr | Gałąź / SHA | Worktree |
|---|---|---|---|
| Baza | fixture | smoke: ad7e94bbbc3a8acedcc5b9f0187cc4a704f31584 | /tmp/mowa-hermes-smoke-jwjzk8fm |
| Pierwsza implementacja | hs1-impl / wJ:p1 | t/s1: 5cd888aa7dfa4b3f0e8ff7280d8bd2fbf24936fe | /tmp/mowa-hermes-smoke-jwjzk8fm/worktrees/s1 |
| Korekta | ten sam hs1-impl / wJ:p1 | t/s1: 38fef6777df35aaedff4676f3c904791aabb5c5b | ten sam worktree s1 |
| Niezależny review | hs1-review / wK:p1 | detached HEAD: 38fef6777df35aaedff4676f3c904791aabb5c5b | /tmp/mowa-hermes-smoke-jwjzk8fm/worktrees/s1-review |

Obaj workerzy wystartowali jako Codex gpt-5.6-sol, high, --yolo. Maksymalnie dwie sesje fixture jednocześnie. Zewnętrzne sesje mowa w4:p1 i w4:p2 nie należały do tego testu i nie były sterowane.

Finalny commit ma bezpośredniego rodzica 5cd888aa7dfa4b3f0e8ff7280d8bd2fbf24936fe: zachowano pierwszy commit, gałąź i worktree. smoke pozostał na bazowym SHA. Pełny diff smoke..candidate zmienia wyłącznie greeting.py: return "TODO" → return f"Cześć, {name}!".

## Rzeczywiste polecenia i wyniki

Dispatch z wymaganym absolutnym helperem (MOWA_WHY dodatkowo ograniczał zakres):

    MOWA_ROOT=/tmp/mowa-hermes-smoke-jwjzk8fm /home/szymon/mowa/scripts/agents/mowa-dispatch-herdr hs1-impl implementer /tmp/mowa-hermes-smoke-jwjzk8fm/specs/smoke/tickets/S1.md codex
    MOWA_ROOT=/tmp/mowa-hermes-smoke-jwjzk8fm /home/szymon/mowa/scripts/agents/mowa-dispatch-herdr hs1-review reviewer /tmp/mowa-hermes-smoke-jwjzk8fm/specs/smoke/tickets/S1.md codex

Pierwszy check, wykonany przez implementera w worktree s1:

    python3 -c 'from greeting import greet; assert greet("Szymon") == "Hello, Szymon!"'

PASS, exit 0, bez outputu. Szef powtórzył asercję z -B i print(repr(...)): exit 0, output 'Hello, Szymon!'. Pierwszy pisemny handoff oraz Git odczytano przed korektą.

Korekta: najpierw zaktualizowano wymaganie i check w absolutnym tickecie. Następnie wysłano `herdr agent prompt hs1-impl <correction> --wait --until working --timeout 15000`; exit 0 i obserwowane working. Prompt jawnie wymagał dokładnego `greet("Szymon") == "Cześć, Szymon!"`, ponownego odczytu ticketu, nowego commitu bez amend/reset i osobnego handoffu. Terminal implementera pokazał odebrany prompt i realizację korekty.

Końcowy check, wykonany przez implementera, niezależnego reviewera i Szefa:

    python3 -B -c 'from greeting import greet; assert greet("Szymon") == "Cześć, Szymon!"'

PASS, exit 0. Szef dodatkowo wypisał wynik: 'Cześć, Szymon!'.

Przed dispatch reviewera ticket zawierał jawnie finalny SHA, bazowy SHA, gałąź i ścieżkę implementacji oraz wymaganą ścieżkę detached review worktree. Reviewer wykonał:

    git worktree add --detach /tmp/mowa-hermes-smoke-jwjzk8fm/worktrees/s1-review 38fef6777df35aaedff4676f3c904791aabb5c5b
    git rev-parse HEAD
    git symbolic-ref -q HEAD
    git diff ad7e94bbbc3a8acedcc5b9f0187cc4a704f31584 HEAD --
    git diff --name-only ad7e94bbbc3a8acedcc5b9f0187cc4a704f31584 HEAD --
    git status --porcelain

Utworzenie worktree: exit 0. HEAD: dokładny finalny SHA. symbolic-ref: exit 1, brak outputu (detached). Diff: wyłącznie greeting.py. Status review worktree po checku: pusty. Pisemny werdykt: PASS dla 38fef6777df35aaedff4676f3c904791aabb5c5b, bez findings.

Po przeczytaniu werdyktu Szef niezależnie wykonał zbiorcze asercje rzeczywistego stanu Git i funkcji w review worktree. Exit 0, output:

    PASS: exact SHA, detached HEAD, clean reviewer worktree, unchanged smoke, preserved parent, greeting.py-only diff
    'Cześć, Szymon!'

## Powiadomienia i automatyczna kontynuacja

Każde poniższe polecenie uruchomiono narzędziem Hermes terminal z background=true, notify=true:

| Proces Hermes | Polecenie | Wynik powiadomienia |
|---|---|---|
| proc_eec001849d68 | herdr agent wait hs1-impl --timeout 120000 | exit 0, done, ale bez pracy/handoffu |
| proc_3390a0e629d4 | herdr agent wait hs1-impl --timeout 120000 | exit 0, done; potem potwierdzono pierwszy handoff |
| proc_e44fdf89a147 | herdr agent wait hs1-impl --timeout 120000 | exit 0, done; potem potwierdzono skorygowany handoff |
| proc_604c633df654 | herdr agent wait hs1-review --timeout 120000 | exit 0, done; potem odczytano niezależny PASS |

Automatyczna kontynuacja: TAK, zaobserwowana w tej interaktywnej sesji. Koordynator zwalniał rozmowę po uruchomieniu wait; komunikaty runtime `[IMPORTANT: Background process ... completed normally ...]` wznawiały jego działania bez wiadomości/nudge od człowieka. Każdy komunikat zawierał wynik procesu. Po nim odczytywano ticket, pisemny handoff, Herdr i rzeczywisty Git. Nie uznawano samego done ani exit 0 za akceptację. Nie było timeoutu wait.

Korekta: dostarczona PO PIERWSZYM HANDOFFIE, gdy hs1-impl był gotowy na input. Nie testowano i nie deklaruje się steeringu w trakcie generowania. Nie tworzono ponownie implementera.

## Ograniczenia i wykryty problem

1. Początkowy helper zwrócił sukces po samym wysłaniu promptu, lecz po pierwszym wait terminal implementera wciąż pokazywał ekran startowy; notes zawierały tylko nagłówek, a Git tylko bazowy worktree. To nie było wykonanie zadania. Szef odczytał stan i dopiero wtedy ponowił sam prompt w tej samej sesji, używając `--wait --until working --timeout 15000`. Uzyskano working i następnie prawdziwy handoff. Nie powielono dispatchu, gałęzi ani sesji. Przyczyny utraty/braku rozpoczęcia pierwszego promptu nie ustalono.
2. Helper został zmieniony równolegle POZA tą rozmową między implementerem a reviewerem. Przy pierwszym odczycie używał `herdr agent prompt "$name" "$prompt"` bez bramki aktywności. Przy review używał już `--wait --until working --timeout 10000` i faktycznie zwrócił working. SHA-256 późniejszej wersji odczytany 11:08:25: f91b5a4c0c4ab3e989bc7d171f82d790d7ecb81c92525c1870c1553417e6e8e1. Ten przebieg potwierdza pętlę koordynatora wraz z odzyskaniem po problemie, nie jednorodny test niezmienionego launchera ani naprawę przyczyny przez Szefa.
3. Automatyczne powiadomienia potwierdzono dla tej sesji i tych bounded waits, nie dla restartu procesu, utraty połączenia czy innych interfejsów Hermes.
4. Pierwszy Python check pozostawił nieśledzony __pycache__/ w worktree implementera; zachowano go. Finalne checki używały -B, worktree reviewera jest czysty. Kandydat zawiera wyłącznie greeting.py.
5. Codex pokazał ostrzeżenia o malejącym limicie i po PASS reviewera dialog propozycji innego modelu. Review zakończył się przed tym dialogiem; nie zmieniano modelu ani ustawień. Nie jest to blocker ukończonego testu, ale limit pozostaje ograniczeniem kolejnych uruchomień.
6. Aktywna tablica mowa nie była zmieniana przez test. SHA-256 build.md na początku i po review identyczny: 5f2dd5c2056d370bc02ccfc45d8e93198135533e12d13913aaff7021fc252340. W głównym repo trwały inne prace; nie przypisuje się wszystkich globalnych zmian temu testowi. Nie wykonywano npm checks, bo fixture nie jest projektem npm i produkt jest poza zakresem.

## Zamknięcie

Wszystkie kryteria HS1 pokryte: initial commit, korekta w zachowanej sesji i gałęzi, niezależny PASS dokładnego finalnego SHA, rzeczywiste kontrole i odnotowana automatyczna kontynuacja. Brak decyzji wymaganej od Szymona.

Ten raport zapisano PRZED zatrzymaniem sesji fixture. W momencie zapisu hs1-impl i hs1-review mają zakończone pisemne handoffy; cleanup dotyczy wyłącznie ich workspace wJ i wK. Potwierdzenie zamknięcia zostanie dopisane po odczycie Herdr. Gałąź, commity, oba worktree i notes pozostają do inspekcji.
