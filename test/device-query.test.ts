import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeviceQuery } from '../src/main/device-query.js'
import type { AudioDevice } from '../src/shared/devices.js'

const LIST: AudioDevice[] = [{ deviceId: 'usb-1', label: 'Scarlett 2i2' }]

describe('createDeviceQuery', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pyta recorder i oddaje jego odpowiedz', async () => {
    let asked = 0
    const query = createDeviceQuery(() => asked++, 2000)

    const listing = query.list()
    expect(asked).toBe(1)
    query.reply(LIST)

    await expect(listing).resolves.toEqual(LIST)
  })

  it('po 2 s bez odpowiedzi oddaje pusta liste, zeby okno nie wisialo', async () => {
    const query = createDeviceQuery(() => {}, 2000)

    const listing = query.list()
    vi.advanceTimersByTime(2000)

    await expect(listing).resolves.toEqual([])
  })

  it('spozniona odpowiedz nie trafia do nastepnego pytania', async () => {
    const query = createDeviceQuery(() => {}, 2000)

    const first = query.list()
    vi.advanceTimersByTime(2000)
    await expect(first).resolves.toEqual([])

    const second = query.list()
    query.reply([])
    query.reply(LIST)
    await expect(second).resolves.toEqual([])
  })

  it('dwa pytania naraz to jedno pytanie do recordera', async () => {
    let asked = 0
    const query = createDeviceQuery(() => asked++, 2000)

    const a = query.list()
    const b = query.list()
    expect(asked).toBe(1)
    query.reply(LIST)

    await expect(a).resolves.toEqual(LIST)
    await expect(b).resolves.toEqual(LIST)
  })
})
