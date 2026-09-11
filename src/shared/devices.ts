/** Wejscie audio widziane z okna recordera. Etykieta jest pusta bez zgody na mikrofon. */
export interface AudioDevice {
  deviceId: string
  label: string
}

/** Wartosc ustawienia `inputDevice`, ktora znaczy "domyslne systemowe". */
export const DEFAULT_DEVICE = ''

/**
 * Ktore urzadzenie otworzyc. `null` = bez ograniczenia, czyli domyslne systemowe.
 * Wybrane, ale odlaczone urzadzenie tez daje `null`: nagranie ma sie zaczac zawsze,
 * a wybor zostaje w ustawieniach na wypadek, gdy mikrofon wroci.
 */
export function pickDevice(devices: readonly AudioDevice[], wanted: string): string | null {
  if (wanted === DEFAULT_DEVICE) return null
  return devices.some((d) => d.deviceId === wanted) ? wanted : null
}
