import { Fragment, useCallback, useEffect, useState } from 'react'
import type {
  AppStatus,
  ErrorFix,
  KeyStatus,
  PermissionStatus,
  ProviderId,
  ProviderMeta,
  Settings,
  ShortcutName
} from '../../../shared/types.js'
import { Banner } from './Banner.js'
import type { Problem } from './Banner.js'
import { GeneralPane } from './GeneralPane.js'
import { HomePane } from './HomePane.js'
import { Glyph } from './Icon.js'
import { ModelPane } from './ModelPane.js'
import { ShortcutPane } from './ShortcutPane.js'
import { pretty } from './accelerator.js'
import type { View } from './views.js'
import { NAV, TITLES } from './views.js'

export function App(): React.JSX.Element | null {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [providers, setProviders] = useState<ProviderMeta[]>([])
  const [keys, setKeys] = useState<Record<ProviderId, KeyStatus> | null>(null)
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null)
  const [status, setStatus] = useState<AppStatus | null>(null)

  const refreshPermissions = useCallback(async (): Promise<void> => {
    setPermissions(await window.api.getPermissions())
  }, [])

  useEffect(() => {
    void (async () => {
      setSettings(await window.api.getSettings())
      setProviders(await window.api.getProviders())
      setKeys(await window.api.getKeys())
      setStatus(await window.api.getStatus())
      await refreshPermissions()
    })()
  }, [refreshPermissions])

  useEffect(() => {
    // Main sam wypycha zmiany — sprawdzenie klucza trwa i konczy sie pozniej.
    window.api.onStatus(setStatus)
  }, [])

  useEffect(() => {
    // Zgody nadaje sie w Ustawieniach systemowych. Odswiezamy po powrocie do okna.
    window.addEventListener('focus', () => void refreshPermissions())
  }, [refreshPermissions])

  const patch = useCallback((part: Partial<Settings>): void => {
    void window.api.patchSettings(part).then(setSettings)
  }, [])

  const setShortcut = useCallback(
    async (name: ShortcutName, accelerator: string): Promise<string | null> => {
      const result = await window.api.setShortcut(name, accelerator)
      if (result.ok) setSettings(await window.api.getSettings())
      return result.ok ? null : (result.error ?? 'Nie udalo sie ustawic skrotu')
    },
    []
  )

  /** Przycisk w pasku bledu prowadzi prosto do naprawy, a nie do instrukcji. */
  const applyFix = useCallback(
    async (fix: ErrorFix): Promise<void> => {
      if (fix === 'accessibility') await window.api.requestAccessibility()
      if (fix === 'automation') await window.api.requestAutomation()
      if (fix === 'microphone') await window.api.requestMicrophone()
      if (fix === 'retry') await window.api.retry()
      if (fix === 'key') setView('model')
      await refreshPermissions()
    },
    [refreshPermissions]
  )

  if (!settings || !keys || !permissions) return null

  const active = providers.find((p) => p.id === settings.provider)
  const { title, sub } = TITLES[view]

  const activeHealth = active ? status?.keyHealth[active.id] : undefined
  const keyInvalid = activeHealth?.state === 'invalid'
  const lastError = status?.lastError ?? null

  const problems: Problem[] = []
  if (keyInvalid) {
    problems.push({
      id: 'key',
      text: `Klucz ${active?.label} jest nieprawidlowy — dostawca go odrzucil`,
      detail: activeHealth?.message,
      fix: 'key'
    })
  }
  // Zly klucz ma juz swoj pasek. Drugi o tym samym tylko rozprasza.
  if (lastError && !(keyInvalid && lastError.fix === 'key')) {
    problems.push({
      id: `error-${lastError.at}`,
      text: lastError.message,
      detail: lastError.detail,
      fix: lastError.fix,
      onDismiss: () => {
        void window.api.clearError()
      }
    })
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        {/* Miejsce na przyciski okna. Caly obszar przeciaga okno. */}
        <div className="sidebar-top" />

        <nav className="nav">
          {NAV.map((item, i) => (
            // Fragment, nie <div> — inaczej selektor `.nav-item + .nav-item` nie zadziala.
            <Fragment key={item.view}>
              {i === 1 && <div className="nav-sep" />}
              <button
                className="nav-item"
                aria-current={view === item.view}
                onClick={() => setView(item.view)}
              >
                <Glyph name={item.icon} />
                {item.label}
                {/* Lampka prowadzi wzrok do zakladki, w ktorej lezy problem. */}
                {item.view === 'model' && keyInvalid && <span className="lamp nav-lamp" />}
              </button>
            </Fragment>
          ))}
        </nav>

        <div className="brand">
          <div className="brand-name">mowa</div>
          <div className="brand-note">Wlasne klucze API. Bez subskrypcji.</div>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <span className="topbar-note">{pretty(settings.shortcut)}</span>
        </div>

        <div className="pane">
          <div className="pane-head">
            <h1>{title}</h1>
            <p>{sub}</p>
          </div>

          {problems.map((problem) => (
            <Banner key={problem.id} {...problem} onFix={(fix) => void applyFix(fix)} />
          ))}

          {view === 'home' && (
            <HomePane
              settings={settings}
              provider={active}
              keyStatus={active ? keys[active.id] : undefined}
              keyHealth={activeHealth}
              permissions={permissions}
              onNavigate={setView}
            />
          )}

          {view === 'shortcut' && (
            <ShortcutPane
              shortcut={settings.shortcut}
              redoShortcut={settings.redoShortcut}
              onChange={setShortcut}
            />
          )}

          {view === 'model' && (
            <ModelPane
              providers={providers}
              active={active}
              model={active ? settings.models[active.id] : ''}
              keys={keys}
              health={status?.keyHealth}
              onProvider={(provider) => patch({ provider })}
              onModel={(id) => {
                if (active) patch({ models: { ...settings.models, [active.id]: id } })
              }}
              onKeySaved={(id, status) => setKeys({ ...keys, [id]: status })}
            />
          )}

          {view === 'general' && (
            <GeneralPane
              settings={settings}
              permissions={permissions}
              onPatch={patch}
              onRequestMicrophone={() =>
                void window.api.requestMicrophone().then(refreshPermissions)
              }
              onRequestAccessibility={() =>
                void window.api.requestAccessibility().then(refreshPermissions)
              }
              onRequestAutomation={() =>
                void window.api.requestAutomation().then(refreshPermissions)
              }
            />
          )}
        </div>
      </main>
    </div>
  )
}
