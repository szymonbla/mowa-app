import type { Api, OverlayApi, RecorderApi } from './index.js'

declare global {
  interface Window {
    api: Api
    overlay: OverlayApi
    recorder: RecorderApi
  }
}
