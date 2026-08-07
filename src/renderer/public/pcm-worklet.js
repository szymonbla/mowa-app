// AudioWorklet dziala na watku audio. Nie moze byc bundlowany przez Vite,
// dlatego lezy w public/ i jest ladowany przez addModule('pcm-worklet.js').

/** Probki wysylamy w duzych paczkach — liczy sie przepustowosc. */
const PCM_BATCH = 2048
/** Poziom glosnosci wysylamy co 2 bloki (2 x 128 probek = 16 ms) — liczy sie plynnosc. */
const LEVEL_EVERY_BLOCKS = 2

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Float32Array(PCM_BATCH)
    this.offset = 0
    this.blocks = 0
    this.squareSum = 0
    this.sampleCount = 0
  }

  flushPcm() {
    const chunk = this.buffer.slice(0, this.offset)
    // Transferujemy bufor, zeby nie kopiowac probek miedzy watkami.
    this.port.postMessage({ pcm: chunk }, [chunk.buffer])
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i]
      this.squareSum += sample * sample
      this.buffer[this.offset++] = sample
      if (this.offset === PCM_BATCH) this.flushPcm()
    }
    this.sampleCount += channel.length

    if (++this.blocks >= LEVEL_EVERY_BLOCKS) {
      this.port.postMessage({ rms: Math.sqrt(this.squareSum / this.sampleCount) })
      this.blocks = 0
      this.squareSum = 0
      this.sampleCount = 0
    }

    return true
  }
}

registerProcessor('pcm-processor', PcmProcessor)
