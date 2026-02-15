type HydraExternalSource = {
  initVideo?: (url?: string, params?: Record<string, unknown>) => void
  tick?: (time: number) => void
  src?: unknown
  tex?: unknown
  regl?: { texture: (opts: Record<string, unknown>) => unknown }
  dynamic?: boolean
}

export const HYDRA_VIDEO_READY_EVENT = 'hydra:video-ready'

/**
 * Protected video elements are relay (WebRTC) streams that must NOT have
 * their tracks stopped during soft-clear. Local camera streams from
 * getUserMedia() are NOT protected and will have tracks stopped to free
 * decoder resources.
 */
const protectedElements = new WeakSet<HTMLVideoElement>()

export function protectVideoElement (el: HTMLVideoElement): void {
  protectedElements.add(el)
}

export function isProtectedVideoElement (el: HTMLVideoElement): boolean {
  return protectedElements.has(el)
}

const PROXY_PATH = 'api/video-proxy'
const SEEK_TIMEOUT_MS = 300
const READY_POLL_INTERVAL_MS = 200
const READY_POLL_MAX_ATTEMPTS = 50 // 10 seconds max (Firefox can be slow)

function isVideoProxyDebugEnabled (): boolean {
  if (process.env.NODE_ENV === 'development') return true
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('hydraVideoDebug')) return true
    return window.localStorage?.getItem('hydraVideoDebug') === '1'
  } catch {
    return false
  }
}

function ensureVideoMountPoint (): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const id = '__hydraVideoMount'
  const existing = document.getElementById(id)
  if (existing) return existing as HTMLElement

  const el = document.createElement('div')
  el.id = id
  // Offscreen but not display:none (Firefox may not decode detached/hidden videos reliably).
  el.style.position = 'fixed'
  el.style.left = '-99999px'
  el.style.top = '0'
  el.style.width = '1px'
  el.style.height = '1px'
  el.style.opacity = '0'
  el.style.pointerEvents = 'none'
  el.style.overflow = 'hidden'
  ;(document.body || document.documentElement).appendChild(el)
  return el
}

interface SourceState {
  epoch: number
  pendingVideo: HTMLVideoElement | null
  seekTimer: ReturnType<typeof setTimeout> | null
  pollTimer: ReturnType<typeof setInterval> | null
}

/** Per-source-instance state, scoped to the hydra external source object. */
const stateBySource = new WeakMap<object, SourceState>()

function getState (ext: object): SourceState {
  let s = stateBySource.get(ext)
  if (!s) {
    s = { epoch: 0, pendingVideo: null, seekTimer: null, pollTimer: null }
    stateBySource.set(ext, s)
  }
  return s
}

function cleanupVideo (vid: HTMLVideoElement): void {
  vid.pause()
  vid.removeAttribute('src')
  try { vid.load() } catch {}
  if (typeof vid.remove === 'function') vid.remove()
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
      if (state.seekTimer !== null) {
        clearTimeout(state.seekTimer)
        state.seekTimer = null
      }
      if (state.pollTimer !== null) {
        clearInterval(state.pollTimer)
        state.pollTimer = null
      }

      // Soft-clear: blank the source immediately so stale camera/video frames
      // don't render during the async load gap.
      const prevSrc = this.src as HTMLVideoElement | null
      if (prevSrc instanceof HTMLVideoElement) {
        if (prevSrc.srcObject) {
          if (!protectedElements.has(prevSrc)) {
            // Local camera (getUserMedia) — stop tracks to free decoder resources
            try {
              const stream = prevSrc.srcObject as unknown
              if (stream && typeof (stream as { getTracks?: unknown }).getTracks === 'function') {
                (stream as MediaStream).getTracks().forEach(t => t.stop())
              }
            } catch {
              // Non-MediaStream srcObject or already stopped — safe to ignore
            }
            prevSrc.srcObject = null
            prevSrc.pause()
          }
          // Protected relay elements — don't touch
        } else {
          cleanupVideo(prevSrc)
        }
      }
      this.src = null
      if (this.regl) {
        this.tex = this.regl.texture({ shape: [1, 1] })
      }
      this.dynamic = false

      // Bump epoch — any pending callbacks from a previous call become stale
      const epoch = ++state.epoch

      // Extract custom params before spreading into regl.texture
      const startTime = params?.startTime as number | 'random' | undefined
      const reglParams = params
        ? Object.fromEntries(
            Object.entries(params).filter(([k]) => k !== 'startTime'),
          )
        : undefined

      // Rewrite cross-origin URLs through proxy.
      // Same-origin absolute URLs (e.g. "https://<this-host>/api/media/...") must
      // NOT be proxied because the server-side fetch will not include cookies and
      // authenticated endpoints will return 401.
      let finalUrl = url
      if (/^https?:\/\//i.test(url)) {
        try {
          const parsed = new URL(url)
          const pageOrigin = window.location.origin
          if (parsed.origin !== pageOrigin) {
            finalUrl = `${PROXY_PATH}?url=` + encodeURIComponent(url)
          }
        } catch {
          // If URL parsing fails, fall back to proxying (safer for CORS).
          finalUrl = `${PROXY_PATH}?url=` + encodeURIComponent(url)
        }
      }

      // Create video element (mirrors hydra-source.js initVideo)
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'
      vid.autoplay = true
      vid.loop = true
      vid.muted = true
      vid.preload = 'auto'
      vid.playsInline = true

      state.pendingVideo = vid
      const mount = ensureVideoMountPoint()
      if (mount) mount.appendChild(vid)

      // Bind source at most once — shared by seeked listener and timeout fallback
      let bound = false
      const bindSource = (): void => {
        if (bound) return
        if (state.epoch !== epoch) {
          cleanupVideo(vid)
          if (state.seekTimer !== null) {
            clearTimeout(state.seekTimer)
            state.seekTimer = null
          }
          return
        }
        // Avoid binding a 0x0 video (regl can create a permanently broken texture).
        if (vid.videoWidth <= 0 || vid.videoHeight <= 0) return
        bound = true
        state.pendingVideo = null
        if (state.seekTimer !== null) {
          clearTimeout(state.seekTimer)
          state.seekTimer = null
        }
        if (state.pollTimer !== null) {
          clearInterval(state.pollTimer)
          state.pollTimer = null
        }

        if (isVideoProxyDebugEnabled()) {
          console.debug('[VideoProxy] bindSource', {
            readyState: vid.readyState,
            videoWidth: vid.videoWidth,
            videoHeight: vid.videoHeight,
            duration: vid.duration,
          })
        }

        this.src = vid
        vid.play()?.catch(() => {}) // swallow autoplay rejection
        if (this.regl) {
          this.tex = this.regl.texture({ data: vid, ...reglParams })
        }
        this.dynamic = true

        // Signal that a video source is ready — HydraVisualizer listens to
        // fire a single tick so the new frame renders even when paused.
        const target = globals as unknown as EventTarget
        if (typeof target.dispatchEvent === 'function') {
          target.dispatchEvent(new Event(HYDRA_VIDEO_READY_EVENT))
        }
      }

      if (startTime !== undefined) {
        // startTime path: seek first, bind after seek completes (or timeout).
        // Uses readyHandled flag so only the first event (loadeddata, canplay,
        // or readyState poll) triggers the seek setup.
        let readyHandled = false
        const onReady = (): void => {
          if (readyHandled) return
          if (state.epoch !== epoch) {
            cleanupVideo(vid)
            return
          }
          readyHandled = true

          if (startTime === 'random' && vid.duration > 0) {
            vid.currentTime = Math.random() * vid.duration
          } else if (typeof startTime === 'number') {
            vid.currentTime = startTime
          }

          vid.addEventListener('seeked', () => bindSource(), { once: true })
          state.seekTimer = setTimeout(() => bindSource(), SEEK_TIMEOUT_MS)
        }
        vid.addEventListener('loadeddata', onReady)
        vid.addEventListener('canplay', onReady)
      } else {
        // No startTime: bind immediately when media is ready.
        // Both loadeddata and canplay call bindSource(); the `bound` flag
        // makes it idempotent — whichever fires first wins.
        const onReady = (): void => {
          if (state.epoch !== epoch) {
            cleanupVideo(vid)
            return
          }
          bindSource()
        }
        vid.addEventListener('loadeddata', onReady)
        vid.addEventListener('canplay', onReady)
      }

      // readyState poll: fallback when neither loadeddata nor canplay fire
      // (observed in Firefox with detached proxy-loaded videos).
      let pollAttempts = 0
      state.pollTimer = setInterval(() => {
        pollAttempts++
        if (isVideoProxyDebugEnabled()) {
          console.debug('[VideoProxy] readyState poll', {
            attempt: pollAttempts,
            readyState: vid.readyState,
            networkState: vid.networkState,
            error: vid.error,
          })
        }
        if (bound || state.epoch !== epoch || pollAttempts >= READY_POLL_MAX_ATTEMPTS) {
          if (state.pollTimer !== null) {
            clearInterval(state.pollTimer)
            state.pollTimer = null
          }
          if (isVideoProxyDebugEnabled() && !bound && pollAttempts >= READY_POLL_MAX_ATTEMPTS) {
            console.warn('[VideoProxy] poll exhausted', {
              readyState: vid.readyState,
              networkState: vid.networkState,
              error: vid.error,
            })
          }
          return
        }
        if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
          if (state.pollTimer !== null) {
            clearInterval(state.pollTimer)
            state.pollTimer = null
          }
          bindSource()
        }
      }, READY_POLL_INTERVAL_MS)

      vid.src = finalUrl
      try { vid.load() } catch {}
      vid.play()?.catch(() => {}) // trigger load immediately (helps Firefox)
    }
  }
}

/**
 * Patch HydraSource.prototype.tick to skip `tex.subimage(src)` when the
 * video element is not ready (readyState < 2 or 0×0 dimensions).  This
 * prevents WebGL warnings in Firefox caused by decoder stalls, tab
 * backgrounding, or video loop boundaries.  Skipping a frame just retains
 * the previous texture content — no visible flicker.
 *
 * Uses a WeakSet so each prototype is patched at most once, even across
 * multiple Hydra init cycles.
 */
const patchedPrototypes = new WeakSet<object>()

export function patchHydraSourceTick (
  sources: string[],
  globals: Record<string, unknown>,
): void {
  for (const src of sources) {
    const ext = globals[src] as HydraExternalSource | undefined
    if (!ext || typeof ext.tick !== 'function') continue

    const proto = Object.getPrototypeOf(ext) as Record<string, unknown> | null
    if (!proto || typeof proto.tick !== 'function' || patchedPrototypes.has(proto)) continue
    patchedPrototypes.add(proto)

    const origTick = proto.tick as (time: number) => void
    proto.tick = function (this: HydraExternalSource, time: number) {
      if (
        this.src instanceof HTMLVideoElement &&
        (this.src.readyState < 2 || this.src.videoWidth <= 0 || this.src.videoHeight <= 0)
      ) {
        return
      }
      origTick.call(this, time)
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
    if (state) {
      if (state.pendingVideo) {
        cleanupVideo(state.pendingVideo)
        state.pendingVideo = null
      }
      if (state.seekTimer !== null) {
        clearTimeout(state.seekTimer)
        state.seekTimer = null
      }
      if (state.pollTimer !== null) {
        clearInterval(state.pollTimer)
        state.pollTimer = null
      }
    }

    ext.initVideo = original as HydraExternalSource['initVideo']
  }
  overrides.clear()
}
