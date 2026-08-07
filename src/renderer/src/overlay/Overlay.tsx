import { useEffect, useRef, useState } from 'react'
import type { OverlayPayload } from '../../../shared/types.js'

/** Szerokosc slupka i odstep. Musza zgadzac sie z overlay.css. */
const BAR_W = 2
const GAP = 2
const STEP = BAR_W + GAP
/** Widoczne kolumny. Jedna dodatkowa czeka za prawa krawedzia. */
const COLS = 16
/**
 * Co ile ms wjezdza nowa kolumna. 50 ms = 3 klatki przy 60 Hz, wiec przewijanie
 * jest rowne. Na ekranie widac 0,8 s historii — tyle wystarcza za potwierdzenie.
 */
const SCROLL_MS = 50

const MIN_H = 2
const MAX_H = 18

/**
 * Bramka szumu. Szum pokoju to okolo -60 dBFS, cicha mowa -40, normalna -25.
 * Progi sa dwa: sciezka otwiera sie dopiero przy -46 dBFS, a zamyka przy -52.
 * Bez tej histerezy slupki migalyby na granicy progu.
 */
const OPEN_DB = -46
const CLOSE_DB = -52
/** Gorna granica okna. Powyzej sciezka jest juz w maksimum. */
const DB_CEIL = -14
/** Gamma < 1 podnosi ciche fragmenty — szept tez rusza sciezka. */
const GAMMA = 0.8

export function Overlay(): React.JSX.Element | null {
  const [payload, setPayload] = useState<OverlayPayload | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  /** Kolumny od najstarszej do najnowszej. Ostatnia jest jeszcze za krawedzia. */
  const cols = useRef<number[]>(Array(COLS + 1).fill(0))
  /** Szczyt glosnosci od ostatniej kolumny. Szczyt, nie srednia — transjenty zostaja ostre. */
  const peak = useRef(0)
  const live = useRef(false)

  useEffect(() => {
    /** Stan bramki szumu. Trzymany tutaj, bo zmienia sie tylko w tej petli. */
    let gateOpen = false

    /** Zwraca 0 dla ciszy i szumu tla — sciezka stoi, dopoki nie ma mowy. */
    const level = (rms: number): number => {
      const db = 20 * Math.log10(rms + 1e-8)
      if (db < (gateOpen ? CLOSE_DB : OPEN_DB)) {
        gateOpen = false
        return 0
      }
      gateOpen = true
      const n = (db - CLOSE_DB) / (DB_CEIL - CLOSE_DB)
      return Math.pow(Math.max(0, Math.min(1, n)), GAMMA)
    }

    const paint = (): void => {
      for (let i = 0; i < cols.current.length; i++) {
        const el = barsRef.current[i]
        if (el) el.style.height = `${(MIN_H + (MAX_H - MIN_H) * cols.current[i]).toFixed(1)}px`
      }
    }

    window.overlay.onState((next) => {
      setPayload(next)
      if (next.state === 'recording') {
        cols.current.fill(0)
        peak.current = 0
        gateOpen = false
        live.current = true
        paint()
      }
      // Poza nagrywaniem sciezka zamiera — CSS pulsuje wtedy przezroczystoscia.
      if (next.state !== 'recording') live.current = false
    })

    window.overlay.onLevel((rms) => {
      peak.current = Math.max(peak.current, level(rms))
    })

    let raf = 0
    let lastTick = performance.now()

    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick)
      if (!live.current) return

      if (now - lastTick >= SCROLL_MS) {
        // Przy zgubionych klatkach nie nadrabiamy zaleglosci — jedna kolumna na tick.
        lastTick = now
        cols.current.shift()
        cols.current.push(peak.current)
        peak.current = 0
        paint()
      }

      // Wysokosci zmieniaja sie skokowo, ale przesuw jest ciagly — stad plynny ruch.
      const progress = Math.min(1, (now - lastTick) / SCROLL_MS)
      if (stripRef.current) {
        stripRef.current.style.transform = `translateX(${(-STEP * progress).toFixed(2)}px)`
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!payload) return null
  const { state, message } = payload

  if (state === 'error') {
    return (
      <div className="pill error">
        <span className="message">{message ?? 'Blad'}</span>
      </div>
    )
  }

  return (
    <div className={`pill ${state}`}>
      <div className="track">
        <div className="strip" ref={stripRef}>
          {Array.from({ length: COLS + 1 }, (_, i) => (
            <div
              key={i}
              className="bar"
              ref={(el) => {
                barsRef.current[i] = el
              }}
              style={{ height: `${MIN_H}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
