import { SAMPLE_RATE, encodeWav } from '../../../shared/wav.js'
import { audioInputs, DEFAULT_DEVICE, pickDevice } from '../../../shared/devices.js'
import type { AudioDevice, RecordStart } from '../../../shared/devices.js'

interface Session {
  stream: MediaStream
  node: AudioWorkletNode
  chunks: Float32Array[]
}

let session: Session | null = null

/**
 * AudioContext i modul workletu tworzymy raz, przy wczytaniu okna.
 * Wczesniej powstawaly przy kazdym nacisnieciu skrotu — to byly setki ms zwloki,
 * podczas ktorych pigulka byla widoczna, ale sciezka stala w miejscu.
 */
const ready: Promise<AudioContext> = (async () => {
  // AudioContext z sampleRate 16000 resampluje zrodlo sam — bez recznego downsamplingu.
  const context = new AudioContext({ sampleRate: SAMPLE_RATE })
  await context.audioWorklet.addModule(new URL('pcm-worklet.js', location.href).href)
  return context
})()

/** Wyjscie musi byc podlaczone, inaczej graf nie jest przetwarzany. Gain 0 wycisza je. */
let mute: GainNode | null = null

/** Same wejscia audio. Etykiety sa puste, dopoki macOS nie da zgody na mikrofon. */
async function listDevices(): Promise<AudioDevice[]> {
  return audioInputs(await navigator.mediaDevices.enumerateDevices())
}

/**
 * Ktory mikrofon otworzyc. Wybrane, ale odlaczone urzadzenie cofa sie do domyslnego —
 * `exact` na nieobecnym id rzucilby OverconstrainedError i nagranie by nie ruszylo.
 * Dla domyslnego nie pytamy o liste wcale: to jedna runda mniej przed startem.
 */
async function deviceConstraint(wanted: string): Promise<{ exact: string } | undefined> {
  if (wanted === DEFAULT_DEVICE) return undefined
  const picked = pickDevice(await listDevices(), wanted)
  return picked === null ? undefined : { exact: picked }
}

async function start({ inputDevice }: RecordStart): Promise<void> {
  if (session) return

  try {
    const context = await ready
    // Kontekst usypia sie miedzy nagraniami. Wznowienie jest natychmiastowe.
    if (context.state !== 'running') await context.resume()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: await deviceConstraint(inputDevice),
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: true,
        // AGC podbijalo wzmocnienie w ciszy, wiec szum pokoju rosl do poziomu mowy.
        // Bez niego poziom jest staly i bramka szumu ma sens.
        autoGainControl: false
      }
    })

    const source = context.createMediaStreamSource(stream)
    const node = new AudioWorkletNode(context, 'pcm-processor')
    const chunks: Float32Array[] = []

    // Worklet wysyla dwa rodzaje wiadomosci: paczke probek albo poziom glosnosci.
    node.port.onmessage = (event: MessageEvent<{ pcm?: Float32Array; rms?: number }>) => {
      const { pcm, rms } = event.data
      if (pcm) chunks.push(pcm)
      if (rms !== undefined) window.recorder.sendLevel(rms)
    }

    mute ??= new GainNode(context, { gain: 0 })
    source.connect(node)
    node.connect(mute)
    mute.connect(context.destination)

    session = { stream, node, chunks }
  } catch (err) {
    // Zglaszamy sam rodzaj awarii — tresc dla uzytkownika powstaje w procesie glownym.
    window.recorder.sendError(
      err instanceof Error && err.name === 'NotAllowedError'
        ? { kind: 'microphone' }
        : { kind: 'no-input' }
    )
  }
}

function teardown(): Session | null {
  const active = session
  session = null
  if (!active) return null
  active.node.port.onmessage = null
  active.node.disconnect()
  // Tracki zamykamy zawsze — inaczej pomaranczowa kropka mikrofonu zostaje w pasku menu.
  active.stream.getTracks().forEach((t) => t.stop())
  // Kontekst zostaje. Usypiamy go, zeby nie liczyl ciszy miedzy nagraniami.
  void ready.then((context) => context.suspend())
  return active
}

async function stop(): Promise<void> {
  const active = teardown()
  if (!active) {
    window.recorder.sendError({ kind: 'not-recording' })
    return
  }

  const samples = active.chunks.reduce((n, c) => n + c.length, 0)
  const durationMs = (samples / SAMPLE_RATE) * 1000
  const wav = encodeWav(active.chunks)
  await window.recorder.sendAudio(wav, durationMs)
}

window.recorder.onStart((payload) => void start(payload))
// Odpowiadamy zawsze, tez pusta lista: main i tak by ja przyjal po 2 s, ale po co czekac.
window.recorder.onDevices(
  () => void listDevices().then(window.recorder.sendDevices, () => window.recorder.sendDevices([]))
)
window.recorder.onStop(() => void stop())
window.recorder.onCancel(() => {
  teardown()
})
