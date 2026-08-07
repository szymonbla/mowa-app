import { Menu, Tray, app, nativeImage } from 'electron'
import { showSettingsWindow } from './windows.js'
import { toggleDictation } from './dictation.js'
import { getSettings } from './settings.js'

let tray: Tray | null = null

/**
 * Trzy slupki fali — ten sam motyw co pigulka HUD.
 * Rysujemy raster 32x32 @2x, zeby ikona byla ostra na Retinie.
 * createFromBitmap, nie createFromBuffer: ten drugi oczekuje PNG/JPEG.
 */
function trayIcon(): Electron.NativeImage {
  const size = 32
  const buf = Buffer.alloc(size * size * 4)
  // [x, polowa wysokosci] w pikselach @2x.
  const bars: [number, number][] = [
    [11, 4],
    [15, 8],
    [19, 5]
  ]
  const width = 3
  const center = size / 2

  for (const [x0, half] of bars) {
    for (let y = center - half; y < center + half; y++) {
      for (let x = x0; x < x0 + width; x++) {
        const i = (y * size + x) * 4
        // Kolejnosc BGRA; przy czerni nie ma to znaczenia. Liczy sie alfa.
        buf[i + 3] = 255
      }
    }
  }

  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 })
  // Template = macOS sam dobiera kolor do jasnego i ciemnego paska menu.
  img.setTemplateImage(true)
  return img
}

export function createTray(): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('SimpleWhisper')
  refreshTrayMenu()
}

export function refreshTrayMenu(): void {
  if (!tray) return
  const { shortcut } = getSettings()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Dyktuj', accelerator: shortcut, click: toggleDictation },
      { type: 'separator' },
      { label: 'Ustawienia…', click: showSettingsWindow },
      { type: 'separator' },
      { label: 'Zakoncz', click: () => app.quit() }
    ])
  )
}
