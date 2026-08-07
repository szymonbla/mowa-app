# mowa

Dyktowanie glosowe na macOS. Nacisnij skrot, mow, nacisnij ponownie — tekst wkleja sie
w aktywne pole i trafia do schowka.

Dostawcy STT: **xAI Grok** (domyslny), OpenAI, ElevenLabs. Wlasne klucze API, bez subskrypcji.

## Uruchomienie w trybie dev

```bash
npm install
npm run dev
```

Aplikacja nie ma ikony w Docku. Zyje w pasku menu (ikona trzech slupkow).
Okno ustawien: menu tray → **Ustawienia…**

### Wklejanie w trybie dev

`Cmd+V` idzie przez Apple Event do `System Events`. Przy starcie z terminala macOS
przypisuje ten event **terminalowi**, a nie Electronowi: proces odpowiedzialny za cale
drzewo `iTerm → zsh → npm → node → Electron` to iTerm. Zgode trzeba wiec nadac iTermowi.

**Ustawienia systemowe → Prywatnosc → Automatyzacja → iTerm → System Events.**

Gdy pozycji nie ma na liscie, macOS trzyma stara odmowe. Kasowanie i ponowny monit:

```bash
tccutil reset AppleEvents com.googlecode.iterm2
```

Zbudowana `.dmg` tego nie dotyczy — Finder uruchamia ja przez LaunchServices, wiec
odpowiada sama za siebie i pyta pod wlasna nazwa.

Sprawdzenie, czy zgoda dziala (`-1743` = brak zgody):

```bash
osascript -e 'tell application "System Events" to return UI elements enabled'
```

Uwaga na sonde: `return 1`, `return name` i `return version` AppleScript odpowiada sam,
bez wysylania eventu. Taki test przechodzi zawsze i nic nie sprawdza.

## Pierwsza konfiguracja

1. Wybierz dostawce i wklej klucz API. Klucz szyfruje `safeStorage` (Keychain).
   Aplikacja sprawdza klucz sama przy starcie; zly klucz zapala czerwona lampke.
2. Nacisnij **Test**, aby sprawdzic klucz recznie.
3. Nadaj trzy zgody w sekcji **Uprawnienia**:
   - **Mikrofon** — nagrywanie.
   - **Accessibility** — wyslanie `Cmd+V`.
   - **Automatyzacja** — zgoda na sterowanie `System Events`. Osobna od Accessibility;
     bez niej `Cmd+V` nie dochodzi i tekst zostaje tylko w schowku.
4. Ustaw skrot. Domyslnie `⌥␣` (Option+Space).

Monit o Automatyzacje pokazuje sie raz. Zapytanie, ktore go wywolalo, konczy sie bledem
`-1743` takze po kliknieciu "Zezwol" — dopiero nastepne dziala. Po odmowie monit nie
wraca; zostaje **Ustawienia systemowe → Prywatnosc → Automatyzacja**, albo:

```bash
tccutil reset AppleEvents com.szymon.mowa
```

## Uzycie

| Akcja | Klawisze |
|---|---|
| Start nagrywania | skrot (domyslnie `⌥␣`) |
| Koniec + wklejenie | ten sam skrot |
| Anulowanie | `Esc` w trakcie nagrywania |

Pigulka nad dolna krawedzia ekranu pokazuje stan: fala przy nagrywaniu, pulsowanie przy
transkrypcji, zolty blysk po wklejeniu, czerwony komunikat przy bledzie.

## Bledy

Pigulka miesci jedno zdanie i znika. Pelna tresc bledu — kod HTTP dostawcy albo `stderr`
z `osascript` — zostaje w oknie ustawien jako czerwony pasek, razem z przyciskiem naprawy.

Miejsce, w ktorym awaria powstaje, podaje same fakty. Tresc dla uzytkownika tworzy
`src/shared/failure.ts` i tylko on — pigulka, pasek i lampka klucza mowia to samo.

Stan klucza API ma wlasna czerwona lampke: przy zakladce **Model**, przy nazwie dostawcy
i na karcie **Start**. Klucz sprawdza sie sam przy starcie, po zapisie i po zmianie
dostawcy. Odpowiedz 401/403 w trakcie dyktowania takze zapala lampke.

## Build lokalny

Uprawnienia TCC (Mikrofon, Accessibility) macOS przypina do **podpisu kodu**. Podpis ad-hoc
zmienia sie przy kazdym buildzie, wiec system pytalby o zgody za kazdym razem.
Dlatego build wymaga wlasnego certyfikatu — tworzysz go raz.

### Certyfikat (jednorazowo)

1. Otworz **Keychain Access**.
2. Menu **Keychain Access → Certificate Assistant → Create a Certificate…**
3. Name: `SimpleWhisper Local`
4. Identity Type: **Self Signed Root**
5. Certificate Type: **Code Signing**
6. **Create**, potem **Done**.

Sprawdzenie:

```bash
security find-identity -v -p codesigning | grep "SimpleWhisper Local"
```

### Budowanie

```bash
npm run build:mac
```

Wynik: `dist/mowa-1.0.0-arm64.dmg`. Przy pierwszym uruchomieniu Gatekeeper
zablokuje aplikacje — otworz przez **prawy klik → Open**, albo:

```bash
xattr -dr com.apple.quarantine /Applications/mowa.app
```

## Architektura

```
src/main/            proces glowny
  index.ts           cykl zycia, tray, single instance
  dictation.ts       maszyna stanow: idle → recording → transcribing → done | error;
                     bez Electrona, cala reszta swiata wchodzi przez `DictationHost`
  dictation-host.ts  jedyny adapter Electronowy dyktowania (drugi, pamieciowy, jest w test/)
  windows.ts         okno ustawien, overlay (panel, non-focusable), ukryty recorder
  shortcut.ts        globalShortcut + walidacja konfliktu
  settings.ts        settings.json + safeStorage dla kluczy
  paste.ts           clipboard.writeText + osascript Cmd+V, rozpoznanie odmowy TCC
  permissions.ts     mikrofon, Accessibility, Automatyzacja
  status.ts          stan klucza API i ostatni blad; push przez listenera z index.ts
  providers/         spec.ts — opis kazdego dostawcy (adres, naglowek klucza, pola
                     multipart); request.ts — jedno zadanie dla wszystkich
src/preload/         contextBridge — renderer nie widzi kluczy API, tylko maske
src/renderer/
  src/settings/      okno ustawien (React)
  src/overlay/       pigulka HUD
  src/recorder/      getUserMedia + zbieranie PCM
  public/pcm-worklet.js   AudioWorklet, poza bundlem Vite
src/shared/
  types.ts           typy wspolne dla main, preload i renderera
  providers.ts       katalog dostawcow — zrodlo `ProviderId` i wszystkich map per dostawca
  languages.ts       katalog jezykow — zrodlo `LanguageId` i jezyka podawanego dostawcy
  wav.ts             enkoder WAV — jeden dla recordera i procesu glownego
  failure.ts         fakty o awarii → komunikat, detal i przycisk naprawy
```

Dodanie dostawcy STT to wpis w `src/shared/providers.ts` (nazwa, modele, podpowiedz klucza,
adres po klucz) i wpis w `src/main/providers/spec.ts` (adres, naglowek klucza, pola
multipart). Kodu zadania sie nie pisze — jest jeden. Lista w ustawieniach,
domyslny model, mapa stanu kluczy i lampka zdrowia klucza powstaja z katalogu same.
Tak samo jezyk: jeden wpis w `src/shared/languages.ts`. Wpis z `spoken: false` (dzis
**Auto**) nie idzie do dostawcy — dostawca ma rozpoznac jezyk sam.

Audio: `AudioContext({ sampleRate: 16000 })` resampluje zrodlo, AudioWorklet zbiera PCM
float32, enkoder tworzy WAV mono PCM16 (~32 kB/s). Wszyscy trzej dostawcy przyjmuja ten
format bez konwersji.

## Uwagi o dostawcach

- **xAI Grok** — `POST /v1/stt` nie przyjmuje pola `model`; jest jeden model STT, dlatego UI
  nie pokazuje selektora modelu. Interpunkcja (`format=true`) wymaga podanego jezyka, wiec
  jezyk **Auto** oznacza brak interpunkcji.
- **OpenAI** — `gpt-4o-transcribe` i `gpt-4o-mini-transcribe` przyjmuja tylko
  `response_format: json` albo `text`. Limit pliku 25 MB (~13 minut mowy).
- **ElevenLabs** — `tag_audio_events` jest domyslnie wlaczone i wstawialoby znaczniki typu
  `(laughs)`; kod wylacza je jawnie. `scribe_v1` jest wycofany.
