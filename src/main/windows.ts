import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppStatus, OverlayPayload } from '../shared/types.js'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const preload = join(dirname, '../preload/index.mjs')

const OVERLAY_W = 220
const OVERLAY_H = 90
/** Odstep pigulki od dolnej krawedzi ekranu. */
const OVERLAY_BOTTOM_GAP = 100

function rendererUrl(page: string): { url?: string; file?: string } {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (dev) return { url: `${dev}/${page}` }
  return { file: join(dirname, `../renderer/${page}`) }
}

function load(win: BrowserWindow, page: string): void {
  // Bez tego bledy w rendererze gina — okno po prostu zostaje puste.
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') {
      console.error(`[${page}] ${e.message} (${e.sourceId}:${e.lineNumber})`)
    }
  })
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[${page}] nie wczytano: ${desc} (${code})`)
  })

  const { url, file } = rendererUrl(page)
  if (url) void win.loadURL(url)
  else void win.loadFile(file!)
}

let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let recorderWindow: BrowserWindow | null = null

export function showSettingsWindow(): void {
  // Dock jest ukryty, wiec aplikacja nie ma jak stac sie aktywna sama.
  // Bez `steal` okno otwiera sie za oknem, w ktorym wlasnie pracujesz.
  app.focus({ steal: true })

  if (settingsWindow) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 560,
    minWidth: 720,
    minHeight: 480,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: 'SimpleWhisper',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#161615',
    vibrancy: undefined,
    webPreferences: { preload, sandbox: false }
  })

  settingsWindow.on('ready-to-show', () => {
    settingsWindow?.show()
    settingsWindow?.focus()
  })
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  // Linki do konsol dostawcow otwieramy w przegladarce, nie w oknie aplikacji.
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  load(settingsWindow, 'index.html')
}

/** Okno ustawien powstaje pozno — pierwsze sprawdzenie klucza trafia w pustke. */
export function sendStatus(status: AppStatus): void {
  settingsWindow?.webContents.send('status:changed', status)
}

function createOverlay(): BrowserWindow {
  const win = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // `panel` + focusable:false — pigulka nie zabiera fokusu docelowej aplikacji.
    type: 'panel',
    focusable: false,
    acceptFirstMouse: false,
    webPreferences: { preload, sandbox: false, backgroundThrottling: false }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true)
  load(win, 'overlay.html')
  return win
}

/** Ustawia pigulke na ekranie, na ktorym jest kursor. */
function positionOverlay(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  win.setBounds({
    x: Math.round(x + (width - OVERLAY_W) / 2),
    y: Math.round(y + height - OVERLAY_H - OVERLAY_BOTTOM_GAP),
    width: OVERLAY_W,
    height: OVERLAY_H
  })
}

/**
 * Tworzy pigulke z wyprzedzeniem. Pierwsze nacisniecie skrotu czekalo wczesniej
 * na utworzenie okna i wczytanie strony — stad zwloka tylko przy pierwszym uzyciu.
 */
export function warmOverlay(): void {
  overlayWindow ??= createOverlay()
}

export function showOverlay(payload: OverlayPayload): void {
  overlayWindow ??= createOverlay()
  positionOverlay(overlayWindow)
  overlayWindow.webContents.send('overlay:state', payload)
  // showInactive() zamiast show() — fokus zostaje w aplikacji uzytkownika.
  overlayWindow.showInactive()
}

export function updateOverlay(payload: OverlayPayload): void {
  overlayWindow?.webContents.send('overlay:state', payload)
}

export function sendOverlayLevel(level: number): void {
  overlayWindow?.webContents.send('overlay:level', level)
}

export function hideOverlay(): void {
  overlayWindow?.hide()
}

/** Ukryte okno, ktore trzyma AudioContext i AudioWorklet. */
export function getRecorderWindow(): BrowserWindow {
  if (recorderWindow && !recorderWindow.isDestroyed()) return recorderWindow

  recorderWindow = new BrowserWindow({
    width: 300,
    height: 200,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload,
      sandbox: false,
      // Bez tego macOS uspi timery ukrytego okna i audio sie zatnie.
      backgroundThrottling: false
    }
  })
  recorderWindow.on('closed', () => {
    recorderWindow = null
  })
  load(recorderWindow, 'recorder.html')
  return recorderWindow
}

export function destroyWindows(): void {
  overlayWindow?.destroy()
  recorderWindow?.destroy()
  overlayWindow = null
  recorderWindow = null
}
