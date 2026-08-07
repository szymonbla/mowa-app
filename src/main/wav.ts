export const SAMPLE_RATE = 16000

/** Nagranie ciszy do testu klucza API. */
export function silentWav(durationMs: number): Buffer {
  const samples = Math.round((SAMPLE_RATE * durationMs) / 1000)
  const header = Buffer.alloc(44)
  const dataBytes = samples * 2

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
  header.writeUInt16LE(2, 32) // block align
  header.writeUInt16LE(16, 34) // bity na probke
  header.write('data', 36)
  header.writeUInt32LE(dataBytes, 40)

  return Buffer.concat([header, Buffer.alloc(dataBytes)])
}
