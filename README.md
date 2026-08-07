# SimpleWhisper

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

`predev` uruchamia `scripts/dev-plist.js`. Skrypt dopisuje
`NSAppleEventsUsageDescription` do `Electron.app` z `node_modules` i podpisuje ja na nowo.
Bez tego wpisu macOS odrzuca `Cmd+V` bez pokazania monitu (`osascript` zwraca `-1743`).

Nowy podpis to dla macOS nowa aplikacja, wiec **po pierwszym takim starcie**:

- w monicie Keychain kliknij **Zawsze zezwalaj** — inaczej zapisane klucze API znikna,
- nadaj **Accessibility** ponownie.

Skrypt jest idempotentny, ale `npm install` pobiera swiezy katalog `dist` — wtedy
zadziala jeszcze raz.

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

Monit o Automatyzacje pokazuje sie raz. Po odmowie wraca sie tylko przez
**Ustawienia systemowe → Prywatnosc → Automatyzacja**, albo:

```bash
tccutil reset AppleEvents com.szymon.simplewhisper
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

Wynik: `dist/SimpleWhisper-1.0.0-arm64.dmg`. Przy pierwszym uruchomieniu Gatekeeper
zablokuje aplikacje — otworz przez **prawy klik → Open**, albo:

```bash
xattr -dr com.apple.quarantine /Applications/SimpleWhisper.app
```

## Architektura

```
src/main/            proces glowny
  index.ts           cykl zycia, tray, single instance
  dictation.ts       maszyna stanow: idle → recording → transcribing → done | error
  windows.ts         okno ustawien, overlay (panel, non-focusable), ukryty recorder
  shortcut.ts        globalShortcut + walidacja konfliktu
  settings.ts        settings.json + safeStorage dla kluczy
  paste.ts           clipboard.writeText + osascript Cmd+V, klasyfikacja bledow
  permissions.ts     mikrofon, Accessibility, Automatyzacja
  status.ts          stan klucza API i ostatni blad; push do okna ustawien
  providers/         xai.ts, openai.ts, elevenlabs.ts
src/preload/         contextBridge — renderer nie widzi kluczy API, tylko maske
src/renderer/
  src/settings/      okno ustawien (React)
  src/overlay/       pigulka HUD
  src/recorder/      getUserMedia + enkoder WAV
  public/pcm-worklet.js   AudioWorklet, poza bundlem Vite
```

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
