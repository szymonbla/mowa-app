import { app } from 'electron'

export function setLaunchAtLogin(enabled: boolean): void {
  // W trybie dev celem byloby Electron Helper, nie aplikacja. Pomijamy.
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
}

export function syncLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return
  if (app.getLoginItemSettings().openAtLogin !== enabled) setLaunchAtLogin(enabled)
}
