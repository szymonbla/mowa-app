/**
 * Esc wcisniety w trakcie otwierania mikrofonu. Przed poprawka recorder zostawal
 * z sesja, o ktorej proces glowny nie wiedzial: kolejny start milczal (`liveMs: -1`),
 * a probki z porzuconego nagrania doklejaly sie do nastepnego (`durationMs` rosl
 * o caly czas od anulowania). Poprawny wynik to `liveMs` rzedu kilku ms i
 * `durationMs` blisko 500.
 */
const { app, BrowserWindow, ipcMain, session } = require('electron')
const { join } = require('node:path')
const ROOT = join(__dirname, '..', '..')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, p, cb) => cb(p === 'media'))
  app.dock?.hide()
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(ROOT, 'out/preload/index.mjs'),
      sandbox: false,
      backgroundThrottling: false
    }
  })
  let onLive = null,
    onAudio = null
  ipcMain.on('record:live', () => onLive?.())
  ipcMain.on('record:level', () => {})
  ipcMain.on('record:error', (_e, f) => console.log(JSON.stringify({ error: f })))
  ipcMain.handle('record:audio', (_e, wav, durationMs) => onAudio?.({ durationMs }))
  await win.loadFile(join(ROOT, 'out/renderer/recorder.html'))
  await wait(1500)

  // ZIMNY mikrofon: cancel ladnie w srodku `await getUserMedia`.
  win.webContents.send('record:start')
  await wait(20)
  win.webContents.send('record:cancel')
  console.log(JSON.stringify({ krok: 'cancel wyslany 20 ms po zimnym starcie' }))
  await wait(1500)

  const live = new Promise((r) => {
    const t0 = performance.now()
    onLive = () => r(+(performance.now() - t0).toFixed(1))
    setTimeout(() => r(-1), 4000)
  })
  win.webContents.send('record:start')
  const liveMs = await live
  await wait(500)
  const got = new Promise((r) => (onAudio = r))
  win.webContents.send('record:stop')
  const audio = await Promise.race([got, wait(4000).then(() => null)])
  console.log(JSON.stringify({ poZimnymWyscigu: { liveMs, audio } }))
  app.exit(0)
})
setTimeout(() => app.exit(1), 60000)
