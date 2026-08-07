/**
 * Jedyny enkoder WAV w projekcie. Uzywa go okno nagrywania i proces glowny,
 * wiec test klucza i dyktowanie nie moga sie rozjechac formatem.
 * Tylko DataView/ArrayBuffer — bez Buffera, bez electrona, bez DOM.
 */

export const SAMPLE_RATE = 16000

const HEADER_BYTES = 44

/** Skleja chunki Float32 i koduje WAV mono PCM16. */
export function encodeWav(chunks: Float32Array[], sampleRate = SAMPLE_RATE): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const buffer = new ArrayBuffer(HEADER_BYTES + total * 2)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bity na probke
  writeStr(36, 'data')
  view.setUint32(40, total * 2, true)

  let offset = HEADER_BYTES
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]))
      // Asymetryczne skalowanie: PCM16 ma zakres -32768..32767.
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }

  return buffer
}

/** Nagranie ciszy do testu klucza API. */
export function silentWav(durationMs: number, sampleRate = SAMPLE_RATE): ArrayBuffer {
  const samples = Math.round((sampleRate * durationMs) / 1000)
  return encodeWav([new Float32Array(samples)], sampleRate)
}
