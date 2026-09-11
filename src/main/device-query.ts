import type { AudioDevice } from '../shared/devices.js'

/** Tyle czekamy na okno recordera. Potem pusta lista — okno ustawien nie moze wisiec. */
const DEVICES_TIMEOUT_MS = 2000

export interface DeviceQuery {
  /** Lista wejsc audio. Nigdy nie rzuca; po czasie oddaje pusta liste. */
  list(): Promise<AudioDevice[]>
  /** Odpowiedz recordera. Spozniona albo nieproszona jest ignorowana. */
  reply(devices: AudioDevice[]): void
}

/**
 * Broker pytanie-odpowiedz miedzy oknem ustawien a oknem recordera. Tylko recorder
 * moze wywolac `enumerateDevices()`, a main jest jedyna droga miedzy oknami.
 * Jedno pytanie w locie: rownolegle prosby dostaja te sama obietnice.
 */
export function createDeviceQuery(
  ask: () => void,
  timeoutMs: number = DEVICES_TIMEOUT_MS
): DeviceQuery {
  let pending: Promise<AudioDevice[]> | null = null
  let settle: ((devices: AudioDevice[]) => void) | null = null

  return {
    list() {
      if (pending) return pending
      pending = new Promise<AudioDevice[]>((resolve) => {
        const finish = (devices: AudioDevice[]): void => {
          clearTimeout(timer)
          pending = null
          settle = null
          resolve(devices)
        }
        const timer = setTimeout(() => finish([]), timeoutMs)
        settle = finish
      })
      ask()
      return pending
    },
    reply(devices) {
      settle?.(devices)
    }
  }
}
