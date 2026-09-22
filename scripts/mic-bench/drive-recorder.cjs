/**
 * Steruje prawdziwym oknem recordera z `out/`. Mierzy, ile mija od rozkazu
 * `record:start` do meldunku `record:live`, czyli do pierwszej nagranej probki.
 */
const { app, BrowserWindow, ipcMain, session } = require('electron')
const { join } = require('node:path')

const ROOT = join(__dirname, '..', '..')
const ROUNDS = Number(process.env.ROUNDS ?? 3)
/** Przerwa krotsza niz MIC_WARM_MS, wiec drugie i trzecie nagranie trafia na cieply mikrofon. */
const GAP_MS = Number(process.env.GAP_MS ?? 1500)

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

  let onLive = null
  let onAudio = null
  ipcMain.on('record:live', () => onLive?.())
  ipcMain.on('record:level', () => {})
  ipcMain.on('record:error', (_e, failure) => console.log(JSON.stringify({ error: failure })))
  ipcMain.handle('record:audio', (_e, wav, durationMs) =>
    onAudio?.({ bytes: wav.byteLength, durationMs })
  )

  await win.loadFile(join(ROOT, 'out/renderer/recorder.html'))
  await wait(1500)

  for (let i = 0; i < ROUNDS; i++) {
    const live = new Promise((r) => {
      const t0 = performance.now()
      onLive = () => r(+(performance.now() - t0).toFixed(1))
      setTimeout(() => r(-1), 5000)
    })

    const t0 = performance.now()
    win.webContents.send('record:start')
    const liveMs = await live

    await wait(700)
    const audio = new Promise((r) => (onAudio = r))
    win.webContents.send('record:stop')
    const got = await Promise.race([audio, wait(4000).then(() => null)])

    console.log(
      JSON.stringify({
        round: i + 1,
        warm: i > 0,
        liveMs,
        totalMs: +(performance.now() - t0).toFixed(1),
        audio: got
      })
    )
    await wait(GAP_MS)
  }

  app.exit(0)
})

setTimeout(() => app.exit(1), 120000)
