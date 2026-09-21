import { createServer } from 'node:http'
import type { IncomingHttpHeaders, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeWav } from '../../src/shared/wav.js'
import type { OverlayPayload } from '../../src/shared/types.js'
import type { Line } from '../../src/main/transcripts.js'

/**
 * Test calej sciezki dyktowania: skrot → nagranie → transkrypcja →
 * schowek → Cmd+V → wpis w logu. Biegnie **prawdziwy** kod produkcyjny, razem
 * z `dictation-host.ts`, ktory sklada dyktowanie z pozostalych modulow — wlasnie
 * to sklejenie jest tu badane. Testy jednostkowe obok sprawdzaja kazdy modul
 * osobno i z definicji nie widza bledu w polaczeniu miedzy nimi.
 *
 * Atrapy stoja **wylacznie na krawedziach maszyny**, bo tylko one nie daja sie
 * uruchomic w tescie:
 *   electron           — okna, schowek, Keychain, skroty globalne
 *   node:child_process — `osascript` naprawde wyslalby Cmd+V do aktywnej aplikacji
 *   node:os            — bez tego log pisalby do prawdziwego `~/.mowa`
 *   fetch              — przekierowany na serwer lokalny; obce adresy sa bledem
 *
 * Wszystko miedzy nimi — dostawcy i log — jest prawdziwe.
 */

/** Zadanie HTTP zlapane przez serwer atrapy. */
interface Zadanie {
  url: string
  naglowki: IncomingHttpHeaders
  tresc: Buffer
}

/** Co serwer ma odpowiedziec. `milczy` = nie odpowiada nigdy, do testu budzetu. */
interface Odpowiedz {
  status?: number
  json?: unknown
  zwlokaMs?: number
  milczy?: boolean
}

const stan = vi.hoisted(() => ({
  /** Katalog domowy atrapy. Pusty = blad, zeby log nigdy nie trafil do prawdziwego. */
  dom: '',
  userData: '',
  port: 0,
  schowek: [] as string[],
  /** Wszystko, co poszlo do okien: `record:*` z recordera i `overlay:*` z pigulki. */
  wyslane: [] as { kanal: string; ladunek?: unknown }[],
  polecenia: [] as string[][],
  /** Ustawione = `osascript` konczy sie ta awaria. */
  osascriptBlad: null as { stderr?: string; killed?: boolean } | null,
  dostepnosc: true,
  zadania: [] as Zadanie[],
  stt: (() => ({})) as (zadanie: Zadanie) => Odpowiedz,
  czat: (() => ({})) as (zadanie: Zadanie) => Odpowiedz
}))

vi.mock('node:os', async (oryginal) => {
  const prawdziwy = await oryginal<typeof import('node:os')>()
  return {
    ...prawdziwy,
    homedir: (): string => {
      // Zabezpieczenie, nie ozdoba: bez atrapy log dopisywalby sie do materialu,
      // ktory uzytkownik zbiera do oceny korekty.
      if (!stan.dom) throw new Error('brak atrapy katalogu domowego')
      return stan.dom
    }
  }
})

vi.mock('node:child_process', () => {
  type Oddzwon = (blad: Error | null, wynik: { stdout: string; stderr: string }) => void
  return {
    execFile: (plik: string, argumenty: readonly string[], a?: unknown, b?: unknown): void => {
      stan.polecenia.push([plik, ...argumenty])
      const oddzwon = (typeof a === 'function' ? a : b) as Oddzwon | undefined
      const awaria = plik === 'osascript' ? stan.osascriptBlad : null
      const blad = awaria ? Object.assign(new Error('osascript'), awaria) : null
      queueMicrotask(() => oddzwon?.(blad, { stdout: '', stderr: '' }))
    }
  }
})

vi.mock('electron', () => {
  class Okno {
    webContents = {
      send: (kanal: string, ladunek?: unknown): void => {
        stan.wyslane.push({ kanal, ladunek })
      },
      on: (): void => {},
      setWindowOpenHandler: (): void => {}
    }
    on(): void {}
    loadFile(): void {}
    loadURL(): void {}
    show(): void {}
    showInactive(): void {}
    hide(): void {}
    focus(): void {}
    destroy(): void {}
    isDestroyed(): boolean {
      return false
    }
    setAlwaysOnTop(): void {}
    setVisibleOnAllWorkspaces(): void {}
    setIgnoreMouseEvents(): void {}
    setBounds(): void {}
  }

  return {
    app: {
      getPath: (): string => stan.userData,
      focus: (): void => {},
      quit: (): void => {}
    },
    BrowserWindow: Okno,
    screen: {
      getCursorScreenPoint: (): { x: number; y: number } => ({ x: 0, y: 0 }),
      getDisplayNearestPoint: (): { workArea: Record<string, number> } => ({
        workArea: { x: 0, y: 0, width: 1440, height: 900 }
      })
    },
    clipboard: {
      writeText: (tekst: string): void => {
        stan.schowek.push(tekst)
      }
    },
    // Keychain przechodzi przez prawdziwy `settings.ts`, wiec klucz naprawde
    // przechodzi cykl zapis → szyfrowanie → odczyt.
    safeStorage: {
      isEncryptionAvailable: (): boolean => true,
      encryptString: (tekst: string): Buffer => Buffer.from(tekst, 'utf8'),
      decryptString: (bufor: Buffer): string => bufor.toString('utf8')
    },
    systemPreferences: {
      getMediaAccessStatus: (): string => 'granted',
      isTrustedAccessibilityClient: (): boolean => stan.dostepnosc,
      askForMediaAccess: (): Promise<boolean> => Promise.resolve(true)
    },
    shell: { openExternal: (): Promise<void> => Promise.resolve() },
    globalShortcut: {
      register: (): boolean => true,
      unregister: (): void => {},
      unregisterAll: (): void => {}
    }
  }
})

/** Adresy dostawcow. Wszystko poza ta lista jest bledem testu, nie ruchem w sieci. */
const ORIGINY = ['https://api.x.ai', 'https://api.openai.com', 'https://api.elevenlabs.io']

const KLUCZ = 'xai-e2e'
const SUROWY = 'no więc yyy jutro wysyłam raport do klienta'
/** Rozni sie od surowego tylko interpunkcja i wielka litera — straz to przepuszcza. */
const POPRAWIONY = 'No więc jutro wysyłam raport do klienta.'

const prawdziwyFetch = globalThis.fetch
type Wejscie = Parameters<typeof fetch>[0]

function przekieruj(wejscie: Wejscie): string {
  const url =
    typeof wejscie === 'string' ? wejscie : wejscie instanceof URL ? wejscie.href : wejscie.url
  const origin = ORIGINY.find((o) => url.startsWith(o))
  if (!origin) throw new Error(`zapytanie poza atrapa: ${url}`)
  return `http://127.0.0.1:${stan.port}${url.slice(origin.length)}`
}

let serwer: Server

beforeAll(async () => {
  serwer = createServer((req, res) => {
    // Rozgrzewka polaczenia (`warm()`) — HEAD bez tresci, nie jest zadaniem.
    if (req.method === 'HEAD') {
      res.writeHead(200)
      res.end()
      return
    }
    const kawalki: Buffer[] = []
    req.on('data', (c: Buffer) => kawalki.push(c))
    req.on('end', () => {
      const zadanie: Zadanie = {
        url: req.url ?? '',
        naglowki: req.headers,
        tresc: Buffer.concat(kawalki)
      }
      stan.zadania.push(zadanie)
      const czat = /chat\/completions|responses/.test(zadanie.url)
      const odp = czat ? stan.czat(zadanie) : stan.stt(zadanie)
      if (odp.milczy) return
      const odeslij = (): void => {
        res.writeHead(odp.status ?? 200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(odp.json ?? {}))
      }
      if (odp.zwlokaMs) setTimeout(odeslij, odp.zwlokaMs)
      else odeslij()
    })
  })
  await new Promise<void>((gotowe) => serwer.listen(0, '127.0.0.1', gotowe))
  stan.port = (serwer.address() as AddressInfo).port
  globalThis.fetch = ((wejscie: Wejscie, init?: RequestInit) =>
    prawdziwyFetch(przekieruj(wejscie), init)) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = prawdziwyFetch
  serwer.closeAllConnections()
  await new Promise<void>((gotowe) => serwer.close(() => gotowe()))
})

beforeEach(() => {
  stan.schowek = []
  stan.wyslane = []
  stan.polecenia = []
  stan.zadania = []
  stan.osascriptBlad = null
  stan.dostepnosc = true
  stan.stt = () => ({ json: { text: SUROWY } })
  stan.czat = () => ({ json: odpowiedzCzatu(POPRAWIONY) })
})

afterEach(async () => {
  serwer.closeAllConnections()
  const domy = [stan.dom, stan.userData].filter(Boolean)
  stan.dom = ''
  stan.userData = ''
  await Promise.all(domy.map((k) => rm(k, { recursive: true, force: true })))
})

/** Ksztalt odpowiedzi xAI — czyta ja prawdziwy `chat.ts`. */
function odpowiedzCzatu(tresc: string): unknown {
  return { choices: [{ message: { content: tresc } }] }
}

type ModulUstawien = typeof import('../../src/main/settings.js')
type ModulStatusu = typeof import('../../src/main/status.js')
type ModulLogu = typeof import('../../src/main/transcripts.js')
type ModulZgod = typeof import('../../src/main/permissions.js')

interface Aplikacja {
  dyktowanie: (typeof import('../../src/main/dictation-host.js'))['dictation']
  ustawienia: ModulUstawien
  status: ModulStatusu
  log: ModulLogu
  zgody: ModulZgod
}

/**
 * Start aplikacji bez `index.ts`: tray, sesja i okna nie maja tu nic do sprawdzenia,
 * a `dictation-host.ts` to caly szew miedzy dyktowaniem a reszta programu.
 * Kazdy test dostaje wlasny proces w sensie modulow — `resetModules()` kasuje stan
 * globalny ustawien, statusu i logu, ktory inaczej przeciekalby miedzy testami.
 */
async function uruchom(nadpisania: Record<string, unknown> = {}): Promise<Aplikacja> {
  vi.resetModules()
  stan.dom = await mkdtemp(join(tmpdir(), 'mowa-dom-'))
  stan.userData = await mkdtemp(join(tmpdir(), 'mowa-dane-'))

  const ustawienia = await import('../../src/main/settings.js')
  ustawienia.initSettings()
  ustawienia.setApiKey('xai', KLUCZ)
  ustawienia.patchSettings({
    provider: 'xai',
    language: 'pl',
    transcripts: true,
    ...nadpisania
  })

  const log = await import('../../src/main/transcripts.js')
  log.initTranscripts()

  const status = await import('../../src/main/status.js')
  const zgody = await import('../../src/main/permissions.js')
  const { dictation } = await import('../../src/main/dictation-host.js')
  return { dyktowanie: dictation, ustawienia, status, log, zgody }
}

/** Krotki sygnal mowy. `durationMs` opisuje czas z recordera, nie rozmiar fixture. */
function nagranie(durationMs = 4000): {
  ok: true
  wav: Buffer
  durationMs: number
} {
  return { ok: true, wav: Buffer.from(encodeWav([new Float32Array([0.02, -0.02])])), durationMs }
}

/** Pelne dyktowanie: skrot start, skrot stop, nagranie z okna recordera. */
async function podyktuj(app: Aplikacja, durationMs?: number): Promise<void> {
  app.dyktowanie.toggle()
  app.dyktowanie.toggle()
  await app.dyktowanie.submit(nagranie(durationMs))
}

function kanaly(): string[] {
  return stan.wyslane.map((w) => w.kanal)
}

function pigulka(): string[] {
  return stan.wyslane
    .filter((w) => w.kanal === 'overlay:state')
    .map((w) => (w.ladunek as OverlayPayload).state)
}

function sciezkaLogu(): string {
  return join(stan.dom, '.mowa', 'transkrypty.jsonl')
}

type Wiersz = Partial<Line>

/**
 * Log jest zapisem „poza sciezka krytyczna" — `appendLine` nie jest oczekiwany,
 * wiec plik pojawia sie chwile po zakonczeniu dyktowania.
 */
async function wiersze(ile: number): Promise<Wiersz[]> {
  for (let proba = 0; proba < 100; proba++) {
    const tresc = await readFile(sciezkaLogu(), 'utf8').catch(() => '')
    const linie = tresc.split('\n').filter(Boolean)
    if (linie.length >= ile) return linie.map((l) => JSON.parse(l) as Wiersz)
    await czekaj(10)
  }
  throw new Error(`log ma mniej niz ${ile} wierszy`)
}

/** Jedyny zapis jednego dyktowania. */
async function wpis(): Promise<Line> {
  const [linia] = await wiersze(1)
  if (linia.raw === undefined) throw new Error('log nie ma wpisu z transkrypcja')
  return linia as Line
}

function czekaj(ms: number): Promise<void> {
  return new Promise((gotowe) => setTimeout(gotowe, ms))
}

describe('cala sciezka dyktowania', () => {
  it('surowy tekst trafia do schowka bez dodatkowego zadania do modelu', async () => {
    const app = await uruchom()
    await podyktuj(app)

    expect(stan.schowek).toEqual([SUROWY])
    expect(stan.polecenia.some(([plik]) => plik === 'osascript')).toBe(true)
    expect(kanaly()).toContain('record:start')
    expect(kanaly()).toContain('record:stop')
    expect(pigulka()).toEqual(['recording', 'transcribing', 'done'])
    expect(stan.zadania.map((z) => z.url)).toEqual(['/v1/stt'])

    const otwarcie = await wpis()
    expect(otwarcie.raw).toBe(SUROWY)
    expect(otwarcie.lang).toBe('pl')
    expect(otwarcie.speechMs).toBe(4000)
    const info = await stat(sciezkaLogu())
    expect(info.mode & 0o777).toBe(0o600)
  })

  it('zadanie do xAI ma jezyk, format i plik na koncu', async () => {
    const app = await uruchom()
    await podyktuj(app)

    const zadanie = stan.zadania[0]
    expect(zadanie.url).toBe('/v1/stt')
    expect(zadanie.naglowki['authorization']).toBe(`Bearer ${KLUCZ}`)

    const tresc = zadanie.tresc.toString('latin1')
    expect(tresc).toContain('name="language"')
    expect(tresc).toContain('name="format"')
    // xAI odrzuca nagranie, gdy `file` nie jest ostatnim polem multipart.
    expect(tresc.indexOf('name="file"')).toBeGreaterThan(tresc.indexOf('name="language"'))
    expect(tresc.indexOf('name="file"')).toBeGreaterThan(tresc.indexOf('name="format"'))
  })

  it('zly klucz do transkrypcji nie zostawia wpisu', async () => {
    stan.stt = () => ({ status: 401, json: { error: 'zly klucz' } })
    const app = await uruchom()
    await podyktuj(app)

    expect(stan.schowek).toEqual([])
    expect(app.status.getStatus().keyHealth.xai.state).toBe('invalid')
    expect(app.status.getStatus().lastError?.fix).toBe('key')
    expect(pigulka().at(-1)).toBe('error')
    // Wpis zaczyna sie dopiero po udanej transkrypcji — nie ma czego zapisac.
    await expect(stat(sciezkaLogu())).rejects.toThrow()
  })

  it('wylaczony log nie tworzy pliku, a czyszczenie go kasuje', async () => {
    const app = await uruchom({ transcripts: false })
    await podyktuj(app)

    expect(stan.schowek).toEqual([SUROWY])
    await czekaj(50)
    await expect(stat(sciezkaLogu())).rejects.toThrow()

    // Przelacznik dziala od razu, bez restartu, a "Wyczysc" kasuje caly plik.
    app.ustawienia.patchSettings({ transcripts: true })
    await podyktuj(app)
    await wpis()
    await app.log.clearTranscripts()
    await expect(stat(sciezkaLogu())).rejects.toThrow()
  })

  it('odmowa Apple Events zostawia tekst w schowku', async () => {
    stan.osascriptBlad = { stderr: 'execution error: Not authorised to send Apple events (-1743)' }
    const app = await uruchom()
    await podyktuj(app)

    // Tekst jest w schowku, zanim wklejenie w ogole ruszy — Cmd+V recznie ratuje.
    expect(stan.schowek).toEqual([SUROWY])
    const blad = app.status.getStatus().lastError
    expect(blad?.fix).toBe('automation')
    expect(blad?.message).toBe('Brak zgody Automatyzacja — tekst w schowku')
    // Nieudane wklejenie jest jedynym pewnym dowodem braku zgody.
    expect(app.zgody.getPermissions().automation).toBe('denied')
  })

  it('Esc w trakcie transkrypcji porzuca wynik', async () => {
    let wszedl = (): void => {}
    const sttWszedl = new Promise<void>((gotowe) => {
      wszedl = gotowe
    })
    stan.stt = () => {
      wszedl()
      return { json: { text: SUROWY }, zwlokaMs: 100 }
    }
    const app = await uruchom()
    app.dyktowanie.toggle()
    app.dyktowanie.toggle()
    const bieg = app.dyktowanie.submit(nagranie())
    await sttWszedl
    app.dyktowanie.cancel()
    await bieg
    expect(stan.schowek).toEqual([])
    await expect(stat(sciezkaLogu())).rejects.toThrow()
  })
})
