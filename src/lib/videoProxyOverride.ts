type HydraExternalSource = {
  initVideo?: (url?: string, params?: Record<string, unknown>) => void
  src?: unknown
  tex?: unknown
  regl?: { texture: (opts: Record<string, unknown>) => unknown }
  dynamic?: boolean
}

const PROXY_PATH = 'api/video-proxy'

interface SourceState {
  epoch: number
  pendingVideo: HTMLVideoElement | null
}

/** Per-source-instance state, scoped to the hydra external source object. */
const stateBySource = new WeakMap<object, SourceState>()

function getState (ext: object): SourceState {
  let s = stateBySource.get(ext)
  if (!s) {
    s = { epoch: 0, pendingVideo: null }
    stateBySource.set(ext, s)
  }
  return s
}

function cleanupVideo (vid: HTMLVideoElement): void {
  vid.pause()
  vid.removeAttribute('src')
  vid.load()
}

/**
 * Override sN.initVideo() to:
 * 1. Rewrite external URLs through the video proxy.
 * 2. Guard against stale async loadeddata callbacks when presets switch rapidly.
 *
 * Stores original initVideo in overrides map for restoration.
 */
export function applyVideoProxyOverride (
  sources: string[],
  globals: Record<string, unknown>,
  overrides: Map<string, unknown>,
): void {
  for (const src of sources) {
    const ext = globals[src] as HydraExternalSource | undefined
    if (!ext || typeof ext.initVideo !== 'function') continue

    if (!overrides.has(src)) {
      overrides.set(src, ext.initVideo)
    }

    ext.initVideo = function (this: HydraExternalSource, url: string = '', params?: Record<string, unknown>) {
      const state = getState(this)

      // Clean up previous in-flight video immediately
      if (state.pendingVideo) {
        cleanupVideo(state.pendingVideo)
      }

      // Bump epoch — any pending loadeddata from a previous call becomes stale
      const epoch = ++state.epoch

      // Rewrite external URLs through proxy
      const finalUrl = /^https?:\/\//i.test(url)
        ? `${PROXY_PATH}?url=` + encodeURIComponent(url)
        : url

      // Create video element (mirrors hydra-source.js initVideo)
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'
      vid.autoplay = true
      vid.loop = true
      vid.muted = true

      state.pendingVideo = vid

      vid.addEventListener('loadeddata', () => {
        // Stale guard: if another initVideo was called since, bail out
        if (state.epoch !== epoch) {
          cleanupVideo(vid)
          return
        }

        state.pendingVideo = null
        this.src = vid
        vid.play()?.catch(() => {}) // swallow autoplay rejection
        if (this.regl) {
          this.tex = this.regl.texture({ data: vid, ...params })
        }
        this.dynamic = true
      })

      vid.src = finalUrl
    }
  }
}

export function restoreVideoProxyOverride (
  globals: Record<string, unknown>,
  overrides: Map<string, unknown>,
): void {
  for (const [src, original] of overrides.entries()) {
    const ext = globals[src] as HydraExternalSource | undefined
    if (!ext) continue

    // Clean up any in-flight video before restoring
    const state = stateBySource.get(ext)
    if (state?.pendingVideo) {
      cleanupVideo(state.pendingVideo)
      state.pendingVideo = null
    }

    ext.initVideo = original as HydraExternalSource['initVideo']
  }
  overrides.clear()
}
