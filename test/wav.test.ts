import { describe, expect, it } from 'vitest'
import { hasSpeech, SAMPLE_RATE, encodeWav, silentWav } from '../src/shared/wav.js'

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('')

describe('encodeWav', () => {
  it('koduje naglowek 44 bajtow i payload PCM16', () => {
    const buffer = encodeWav([new Float32Array([0, 0.5]), new Float32Array([-0.5])])
    const view = new DataView(buffer)

    expect(buffer.byteLength).toBe(44 + 3 * 2)

    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(36 + 3 * 2)
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(view.getUint32(16, true)).toBe(16)
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE)
    expect(view.getUint32(28, true)).toBe(SAMPLE_RATE * 2)
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(3 * 2)

    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(Math.trunc(0.5 * 0x7fff))
    expect(view.getInt16(48, true)).toBe(Math.trunc(-0.5 * 0x8000))
  })

  it('przyjmuje inna czestotliwosc probkowania', () => {
    const view = new DataView(encodeWav([new Float32Array(4)], 8000))
    expect(view.getUint32(24, true)).toBe(8000)
    expect(view.getUint32(28, true)).toBe(16000)
  })

  it('obcina probki do asymetrycznych granic PCM16', () => {
    const view = new DataView(encodeWav([new Float32Array([1, -1, 2, -2])]))
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
    // Wartosci spoza zakresu maja trafic w te same granice, nie przepelnic sie.
    expect(view.getInt16(48, true)).toBe(32767)
    expect(view.getInt16(50, true)).toBe(-32768)
  })
})

describe('silentWav', () => {
  it('ma rozmiar wynikajacy z czasu trwania', () => {
    // 0,5 s przy 16 kHz to 8000 probek po 2 bajty.
    const buffer = silentWav(500)
    const view = new DataView(buffer)

    expect(buffer.byteLength).toBe(44 + 16000)
    expect(view.getUint32(40, true)).toBe(16000)
    expect(view.getUint32(4, true)).toBe(36 + 16000)
  })

  it('zawiera same zera', () => {
    const view = new DataView(silentWav(10))
    for (let offset = 44; offset < view.byteLength; offset += 2) {
      expect(view.getInt16(offset, true)).toBe(0)
    }
  })

  it('nie uznaje ciszy za mowe', () => {
    expect(hasSpeech(new Uint8Array(silentWav(1000)))).toBe(false)
    expect(hasSpeech(new Uint8Array(encodeWav([new Float32Array([0.02, -0.02])])))).toBe(true)
  })
})
