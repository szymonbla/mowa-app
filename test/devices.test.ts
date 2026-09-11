import { describe, expect, it } from 'vitest'
import { audioInputs, pickDevice } from '../src/shared/devices.js'
import type { AudioDevice } from '../src/shared/devices.js'

const DEVICES: AudioDevice[] = [
  { deviceId: 'built-in', label: 'MacBook Pro Microphone' },
  { deviceId: 'usb-1', label: 'Scarlett 2i2' }
]

describe('pickDevice', () => {
  it('zwraca wybrane urzadzenie, gdy jest na liscie', () => {
    expect(pickDevice(DEVICES, 'usb-1')).toBe('usb-1')
  })

  it('pusty wybor to domyslne systemowe', () => {
    expect(pickDevice(DEVICES, '')).toBeNull()
  })

  it('odlaczone urzadzenie cofa sie do domyslnego', () => {
    expect(pickDevice(DEVICES, 'usb-gone')).toBeNull()
  })

  it('pusta lista nigdy nie wymusza urzadzenia', () => {
    expect(pickDevice([], 'usb-1')).toBeNull()
  })
})

describe('audioInputs', () => {
  const infos = [
    { kind: 'audioinput', deviceId: 'default', label: 'Default - Scarlett 2i2' },
    { kind: 'audioinput', deviceId: 'usb-1', label: 'Scarlett 2i2' },
    { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers' },
    { kind: 'videoinput', deviceId: 'cam', label: 'FaceTime HD' },
    { kind: 'audioinput', deviceId: 'built-in', label: '' }
  ] as const

  it('zostawia same wejscia audio, bez wpisu "default" — ten jest juz pierwsza opcja', () => {
    expect(audioInputs(infos)).toEqual([
      { deviceId: 'usb-1', label: 'Scarlett 2i2' },
      { deviceId: 'built-in', label: '' }
    ])
  })
})
