import { SAMPLE_RATE, encodeWav } from '../../../shared/wav.js'

/** Otwarty mikrofon. Zyje dluzej niz jedno nagranie — patrz `MIC_WARM_MS`. */
interface Mic {
  stream: MediaStream
  source: MediaStreamAudioSourceNode
}

interface Session {
  mic: Mic
  node: AudioWorkletNode
  chunks: Float32Array[]
}

/**
 * Jak dlugo mikrofon zostaje otwarty po nagraniu. Otwarcie urzadzenia kosztuje
 * setki ms i to ono gubilo pierwsze slowa; przy otwartym mikrofonie start jest
 * natychmiastowy. Cena: przez ten czas pali sie systemowy wskaznik mikrofonu,
 * a sluchawki Bluetooth zostaja w trybie zestawu glosnomowiacego.
 */
const MIC_WARM_MS = 20_000

/** Ustawiane tylko na czas oczekiwania na ostatnia paczke probek. */
let onFlushed: (() => void) | null = null

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

let mic: Mic | null = null
/** Odliczanie do zamkniecia mikrofonu. Kasowane, gdy nagranie ruszy wczesniej. */
let release: ReturnType<typeof setTimeout> | null = null

function cancelRelease(): void {
  if (release === null) return
  clearTimeout(release)
  release = null
}

function closeMic(): void {
  if (!mic) return
  mic.source.disconnect()
  // Tracki zamykamy zawsze — inaczej pomaranczowa kropka mikrofonu zostaje w pasku menu.
  mic.stream.getTracks().forEach((t) => t.stop())
  mic = null
}

/** Po nagraniu mikrofon gasnie z opoznieniem, razem z uspieniem kontekstu. */
function scheduleRelease(): void {
  cancelRelease()
  release = setTimeout(() => {
    release = null
    closeMic()
    // Kontekst zostaje. Usypiamy go, zeby nie liczyl ciszy miedzy nagraniami.
    void ready.then((context) => context.suspend())
  }, MIC_WARM_MS)
}

/**
 * Zwraca otwarty mikrofon. Ponowne uzycie omija `getUserMedia`, ktore jest
 * najdrozszym krokiem startu. Martwy track (wyjete sluchawki, odlaczony
 * interfejs) otwieramy od nowa.
 */
async function openMic(context: AudioContext): Promise<Mic> {
  cancelRelease()
  if (mic?.stream.getAudioTracks().every((t) => t.readyState === 'live')) return mic
  closeMic()

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: true,
      // AGC podbijalo wzmocnienie w ciszy, wiec szum pokoju rosl do poziomu mowy.
      // Bez niego poziom jest staly i bramka szumu ma sens.
      autoGainControl: false
    }
  })

  mic = { stream, source: context.createMediaStreamSource(stream) }
  return mic
}

async function start(): Promise<void> {
  if (session) return

  try {
    const context = await ready
    // Kontekst usypia sie miedzy nagraniami. Wznowienie jest natychmiastowe.
    if (context.state !== 'running') await context.resume()

    const active = await openMic(context)
    const node = new AudioWorkletNode(context, 'pcm-processor')
    const chunks: Float32Array[] = []

    // Worklet wysyla cztery rodzaje wiadomosci: pierwszy blok, paczke probek,
    // poziom glosnosci i potwierdzenie oproznienia bufora.
    node.port.onmessage = (
      event: MessageEvent<{ pcm?: Float32Array; rms?: number; flushed?: true; started?: true }>
    ) => {
      const { pcm, rms, flushed, started } = event.data
      // Dopiero pierwszy blok znaczy, ze urzadzenie oddaje probki. Wczesniej
      // pigulka nie ma prawa zapraszac do mowienia.
      if (started) window.recorder.sendLive()
      if (pcm) chunks.push(pcm)
      if (rms !== undefined) window.recorder.sendLevel(rms)
      if (flushed) onFlushed?.()
    }

    mute ??= new GainNode(context, { gain: 0 })
    active.source.connect(node)
    node.connect(mute)
    mute.connect(context.destination)

    session = { mic: active, node, chunks }
  } catch (err) {
    // Zglaszamy sam rodzaj awarii — tresc dla uzytkownika powstaje w procesie glownym.
    window.recorder.sendError(
      err instanceof Error && err.name === 'NotAllowedError'
        ? { kind: 'microphone' }
        : { kind: 'no-input' }
    )
  }
}

function teardown(active: Session): void {
  active.node.port.onmessage = null
  // Rozpinamy sama krawedz do workletu: zrodlo ma przetrwac do kolejnego nagrania.
  active.mic.source.disconnect(active.node)
  active.node.disconnect()
  scheduleRelease()
}

/** Wymusza w worklecie oddanie niepelnej paczki. Czekanie jest krotkie i z limitem. */
async function flush(active: Session): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = (): void => {
      onFlushed = null
      resolve()
    }
    onFlushed = done
    setTimeout(done, 50)
    active.node.port.postMessage('flush')
  })
}

async function stop(): Promise<void> {
  const active = session
  // Zerujemy przed `await`: w tym oknie moze przyjsc cancel albo drugi stop.
  session = null
  if (!active) {
    window.recorder.sendError({ kind: 'not-recording' })
    return
  }
  await flush(active)
  teardown(active)

  const samples = active.chunks.reduce((n, c) => n + c.length, 0)
  const durationMs = (samples / SAMPLE_RATE) * 1000
  const wav = encodeWav(active.chunks)
  await window.recorder.sendAudio(wav, durationMs)
}

window.recorder.onStart(() => void start())
window.recorder.onStop(() => void stop())
window.recorder.onCancel(() => {
  const active = session
  session = null
  if (active) teardown(active)
})
