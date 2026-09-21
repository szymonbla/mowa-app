import { app, session } from 'electron'
import { initSettings, getSettings } from './settings.js'
import { registerIpc } from './ipc.js'
import { registerShortcut, unregisterAll } from './shortcut.js'
import { dictation, onActionsChanged } from './dictation-host.js'
import { createTray, refreshTrayMenu } from './tray.js'
import {
  getRecorderWindow,
  showSettingsWindow,
  destroyWindows,
  sendStatus,
  warmOverlay
} from './windows.js'
import { syncLaunchAtLogin } from './autostart.js'
import { checkKey, onStatusChanged } from './status.js'
import { initTranscripts } from './transcripts.js'

// Druga instancja przechwycilaby skrot globalny i nagrywala rownolegle.
if (!app.requestSingleInstanceLock()) app.quit()

app.on('second-instance', showSettingsWindow)

app.whenReady().then(() => {
  initSettings()
  const settings = getSettings()

  // Ukryte okno recordera prosi o mikrofon bez interakcji uzytkownika.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  app.dock?.hide()

  // Diagnostyka trafia do okna ustawien tylko stad — sam status o oknach nie wie.
  onStatusChanged(sendStatus)

  // Tak samo dyktowanie nie zna tray: menu odswieza sie stad, gdy pojawia sie powtorka.
  onActionsChanged(refreshTrayMenu)

  // Katalog logu robimy zawsze, takze przy wylaczonym przelaczniku: wykluczenie
  // z Time Machine ma juz obowiazywac, gdy uzytkownik go wlaczy.
  initTranscripts()

  registerIpc()
  createTray()
  syncLaunchAtLogin(settings.launchAtLogin)

  const result = registerShortcut(settings.shortcut, dictation.toggle)

  // Rozgrzewamy oba ukryte okna, zeby pierwsze dyktowanie nie czekalo na start.
  getRecorderWindow()
  warmOverlay()

  // Pierwsze uruchomienie albo konflikt skrotu — pokaz ustawienia.
  if (!result.ok || !app.getLoginItemSettings().wasOpenedAsHidden) showSettingsWindow()

  refreshTrayMenu()

  // Zly klucz ma byc widoczny przy starcie, a nie dopiero po nieudanym dyktowaniu.
  void checkKey(settings.provider).then((health) => {
    if (health.state === 'invalid') showSettingsWindow()
  })
})

// Aplikacja zyje w tray. Zamkniecie okna ustawien jej nie konczy.
app.on('window-all-closed', () => {})

app.on('activate', showSettingsWindow)

app.on('will-quit', () => {
  unregisterAll()
  destroyWindows()
})
