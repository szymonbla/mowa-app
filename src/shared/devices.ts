/** Wejscie audio widziane z okna recordera. Etykieta jest pusta bez zgody na mikrofon. */
export interface AudioDevice {
  deviceId: string
  label: string
}

/** Wartosc ustawienia `inputDevice`, ktora znaczy "domyslne systemowe". */
export const DEFAULT_DEVICE = ''

/** Ladunek rozkazu `record:start`. Recorder dostaje wszystko, czego potrzebuje, w jednym IPC. */
export interface RecordStart {
  /** Mikrofon z ustawien; `''` = domyslne systemowe. Recorder sam nie zna ustawien. */
  inputDevice: string
}

/** Tyle z `MediaDeviceInfo`, ile potrzebuje filtr. Pelny typ jest tylko w DOM. */
interface DeviceInfoLike {
  readonly kind: string
  readonly deviceId: string
  readonly label: string
}

/**
 * Chrome dopisuje do `enumerateDevices()` wirtualny wpis `default` (na Windows tez
 * `communications`), ktory wskazuje to samo, co pierwsza opcja listy. Wycinamy go,
 * zeby uzytkownik nie widzial jednego mikrofonu dwa razy.
 */
const VIRTUAL_IDS = new Set(['default', 'communications'])

/** Same wejscia audio, sprowadzone do tego, co da sie wyslac przez IPC. */
export function audioInputs(infos: readonly DeviceInfoLike[]): AudioDevice[] {
  return infos
    .filter((d) => d.kind === 'audioinput' && !VIRTUAL_IDS.has(d.deviceId))
    .map(({ deviceId, label }) => ({ deviceId, label }))
}

/**
 * Ktore urzadzenie otworzyc. `null` = bez ograniczenia, czyli domyslne systemowe.
 * Wybrane, ale odlaczone urzadzenie tez daje `null`: nagranie ma sie zaczac zawsze,
 * a wybor zostaje w ustawieniach na wypadek, gdy mikrofon wroci.
 */
export function pickDevice(devices: readonly AudioDevice[], wanted: string): string | null {
  if (wanted === DEFAULT_DEVICE) return null
  return devices.some((d) => d.deviceId === wanted) ? wanted : null
}
