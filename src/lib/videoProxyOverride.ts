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

/**
 * Hosts known to serve Access-Control-Allow-Origin on media files.
 * For these hosts, skip the proxy and use direct URLs — avoids 413,
 * stream corruption, and codec re-encoding issues with the proxy.
 */
const CORS_CAPABLE_HOSTS = [
  'archive.org', // *.archive.org (ia600206.us.archive.org, etc.)
]

export function isCorsCapableHost (hostname: string): boolean {
  return CORS_CAPABLE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))
}
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

      // Check for retry override from a previous failed attempt
      const retryDirect = overrides.get(`__retryDirect:${url}`)
      const retryProxy = overrides.get(`__retryProxy:${url}`)
      if (retryDirect) overrides.delete(`__retryDirect:${url}`)
      if (retryProxy) overrides.delete(`__retryProxy:${url}`)
      const isRetry = !!(retryDirect || retryProxy)

      // Rewrite cross-origin URLs through proxy.
      // Same-origin absolute URLs (e.g. "https://<this-host>/api/media/...") must
      // NOT be proxied because the server-side fetch will not include cookies and
      // authenticated endpoints will return 401.
      // CORS-capable hosts bypass the proxy entirely (avoids 413 / stream corruption).
      let finalUrl = url
      let isProxied = false
      if (retryDirect) {
        // Retry forced direct — skip proxy
        finalUrl = url
      } else if (retryProxy) {
        // Retry forced proxy
        finalUrl = `${PROXY_PATH}?url=` + encodeURIComponent(url)
        isProxied = true
      } else if (/^https?:\/\//i.test(url)) {
        try {
          const parsed = new URL(url)
          const pageOrigin = window.location.origin
          if (parsed.origin !== pageOrigin && !isCorsCapableHost(parsed.hostname)) {
            finalUrl = `${PROXY_PATH}?url=` + encodeURIComponent(url)
            isProxied = true
          }
        } catch {
          // If URL parsing fails, fall back to proxying (safer for CORS).
          finalUrl = `${PROXY_PATH}?url=` + encodeURIComponent(url)
          isProxied = true
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

      // Two-phase binding:
      // Phase 1 (bind): metadata available + dimensions known → create texture, set src/dynamic
      // Phase 2 (frame-ready): readyState >= 2 → dispatch HYDRA_VIDEO_READY_EVENT for paused tick
      let bound = false
      let frameReady = false
      const hasStartTime = startTime !== undefined

      // Phase 2 signal — dispatches the event that HydraVisualizer listens to
      // for triggering a tick when paused. Centralized timer cleanup point.
      const signalFrameReady = (): void => {
        if (frameReady) return
        if (state.epoch !== epoch) return
        frameReady = true

        if (state.seekTimer !== null) { clearTimeout(state.seekTimer); state.seekTimer = null }
        if (state.pollTimer !== null) { clearInterval(state.pollTimer); state.pollTimer = null }

        const target = globals as unknown as EventTarget
        if (typeof target.dispatchEvent === 'function') {
          target.dispatchEvent(new Event(HYDRA_VIDEO_READY_EVENT))
        }
      }

      // Phase 1 — bind source at most once.
      // Creates texture (placeholder at readyState<2, data at readyState>=2).
      // Does NOT dispatch the event — signalFrameReady() handles that.
      const bindSource = (): void => {
        if (bound) return
        if (state.epoch !== epoch) {
          // Stale callback — only clean up the stale vid, NOT state timers
          // (they may belong to a newer init call)
          cleanupVideo(vid)
          return
        }
        // Avoid binding a 0x0 video (regl can create a permanently broken texture).
        if (vid.videoWidth <= 0 || vid.videoHeight <= 0) return
        bound = true
        state.pendingVideo = null
        // Note: do NOT clear seekTimer or pollTimer here — signalFrameReady() handles that

        if (isVideoProxyDebugEnabled()) {
          console.debug('[VideoProxy] bindSource', {
            readyState: vid.readyState,
            metadataOnly: vid.readyState < 2,
            videoWidth: vid.videoWidth,
            videoHeight: vid.videoHeight,
            duration: vid.duration,
          })
        }

        this.src = vid
        vid.play()?.catch(() => {}) // swallow autoplay rejection
        if (this.regl) {
          if (vid.readyState >= 2) {
            try {
              this.tex = this.regl.texture({ data: vid, ...reglParams })
            } catch {
              // Firefox edge case: texImage2D may still fail at readyState 2
              this.tex = this.regl.texture({ width: vid.videoWidth, height: vid.videoHeight, ...reglParams })
            }
          } else {
            // Metadata-only: sized placeholder; tick fills in data when readyState >= 2
            this.tex = this.regl.texture({ width: vid.videoWidth, height: vid.videoHeight, ...reglParams })
          }
        }
        this.dynamic = true

        // If already frame-ready, dispatch event immediately
        if (vid.readyState >= 2) {
          signalFrameReady()
        }
        // Otherwise: signalFrameReady() called later by loadeddata/canplay/poll
      }

      if (hasStartTime) {
        // startTime path: seek first, bind after seek completes (or timeout).
        // Uses readyHandled flag so only the first event (loadedmetadata, loadeddata,
        // canplay, or readyState poll) triggers the seek setup.
        let readyHandled = false
        const onReady = (): void => {
          if (readyHandled) return
          if (state.epoch !== epoch) {
            cleanupVideo(vid) // stale — only clean vid, NOT timers
            return
          }
          readyHandled = true

          if (startTime === 'random' && vid.duration > 0) {
            vid.currentTime = Math.random() * vid.duration
          } else if (typeof startTime === 'number') {
            vid.currentTime = startTime
          }

          vid.addEventListener('seeked', () => {
            if (state.epoch !== epoch) return // stale — no timer cleanup
            bindSource()
            if (bound && vid.readyState >= 2) signalFrameReady()
          }, { once: true })
          state.seekTimer = setTimeout(() => {
            bindSource()
            if (bound && vid.readyState >= 2) signalFrameReady()
          }, SEEK_TIMEOUT_MS)
        }
        vid.addEventListener('loadedmetadata', onReady)
        vid.addEventListener('loadeddata', onReady)
        vid.addEventListener('canplay', onReady)

        // Separate frame-ready listeners: onReady is gated by readyHandled
        // (only fires once for seek setup), so loadeddata/canplay after seek
        // won't re-enter onReady. These listeners handle Phase 2 dispatch.
        const onFrameReady = (): void => {
          if (state.epoch !== epoch) return
          if (bound && vid.readyState >= 2) signalFrameReady()
        }
        vid.addEventListener('loadeddata', onFrameReady)
        vid.addEventListener('canplay', onFrameReady)
      } else {
        // No startTime: bind immediately when media is ready.
        // loadedmetadata/loadeddata/canplay all call bindSource(); the `bound` flag
        // makes it idempotent — whichever fires first wins.
        const onReady = (): void => {
          if (state.epoch !== epoch) {
            cleanupVideo(vid) // stale — only clean vid, NOT timers
            return
          }
          bindSource()
          // After bind, check if we can signal frame-ready
          if (bound && vid.readyState >= 2) signalFrameReady()
        }
        vid.addEventListener('loadedmetadata', onReady)
        vid.addEventListener('loadeddata', onReady)
        vid.addEventListener('canplay', onReady)
      }

      // Diagnostic logging: track all video lifecycle events when debug enabled
      if (isVideoProxyDebugEnabled()) {
        const diagEvents = [
          'loadstart', 'loadedmetadata', 'loadeddata', 'canplay',
          'canplaythrough', 'playing', 'stalled', 'waiting', 'suspend', 'error',
        ] as const
        for (const evt of diagEvents) {
          vid.addEventListener(evt, () => {
            console.debug('[VideoProxy] event:%s', evt, {
              readyState: vid.readyState,
              networkState: vid.networkState,
              videoWidth: vid.videoWidth,
              videoHeight: vid.videoHeight,
              duration: vid.duration,
              error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
              currentSrc: vid.currentSrc,
              bound,
              frameReady,
            })
          })
        }
      }

      // Error-triggered retry: try the opposite URL strategy once.
      // Re-invokes initVideo which increments epoch and cleans up this video.
      if (!isRetry && /^https?:\/\//i.test(url)) {
        vid.addEventListener('error', () => {
          if (state.epoch !== epoch) return // stale
          if (frameReady) return // already working

          if (isVideoProxyDebugEnabled()) {
            console.debug('[VideoProxy] video error — attempting retry', {
              url: finalUrl,
              wasProxied: isProxied,
              error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
            })
          }

          if (isProxied) {
            overrides.set(`__retryDirect:${url}`, true)
          } else {
            overrides.set(`__retryProxy:${url}`, true)
          }
          this.initVideo(url, params)
        }, { once: true })
      }

      // readyState poll: fallback when events don't fire (observed in Firefox).
      // Two-phase: bind at readyState >= 1, signal frame-ready at readyState >= 2.
      let pollAttempts = 0
      state.pollTimer = setInterval(() => {
        pollAttempts++
        if (isVideoProxyDebugEnabled()) {
          console.debug('[VideoProxy] readyState poll', {
            attempt: pollAttempts,
            readyState: vid.readyState,
            networkState: vid.networkState,
            videoWidth: vid.videoWidth,
            videoHeight: vid.videoHeight,
            bound,
            frameReady,
            error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
          })
        }

        // Early exit: vid.error means decode/network failure — stop polling.
        // If not already a retry, trigger the flip-strategy retry once.
        if (vid.error) {
          if (state.pollTimer !== null) { clearInterval(state.pollTimer); state.pollTimer = null }
          if (!isRetry && /^https?:\/\//i.test(url) && !frameReady && state.epoch === epoch) {
            if (isVideoProxyDebugEnabled()) {
              console.debug('[VideoProxy] poll detected video error — attempting retry', {
                url: finalUrl,
                wasProxied: isProxied,
                error: { code: vid.error.code, message: vid.error.message },
              })
            }
            if (isProxied) {
              overrides.set(`__retryDirect:${url}`, true)
            } else {
              overrides.set(`__retryProxy:${url}`, true)
            }
            this.initVideo(url, params)
          } else if (isVideoProxyDebugEnabled()) {
            console.warn('[VideoProxy] video error — stopping poll', {
              url: finalUrl,
              error: { code: vid.error.code, message: vid.error.message },
              readyState: vid.readyState,
              networkState: vid.networkState,
            })
          }
          return
        }

        if (frameReady || state.epoch !== epoch || pollAttempts >= READY_POLL_MAX_ATTEMPTS) {
          if (state.pollTimer !== null) { clearInterval(state.pollTimer); state.pollTimer = null }
          if (!bound && pollAttempts >= READY_POLL_MAX_ATTEMPTS && isVideoProxyDebugEnabled()) {
            console.warn('[VideoProxy] video init failed — poll exhausted', {
              url: finalUrl,
              readyState: vid.readyState,
              networkState: vid.networkState,
              videoWidth: vid.videoWidth,
              videoHeight: vid.videoHeight,
              duration: vid.duration,
              error: vid.error ? { code: vid.error.code, message: vid.error.message } : null,
            })
          }
          return
        }

        // Phase 1: bind at readyState >= 1 with valid dimensions
        // For startTime videos: skip — the event-driven onReady→seeked path handles binding.
        if (!bound && !hasStartTime && vid.readyState >= 1 && vid.videoWidth > 0 && vid.videoHeight > 0) {
          bindSource()
        }

        // Phase 2: frame-ready at readyState >= 2
        if (bound && !frameReady && vid.readyState >= 2) {
          signalFrameReady()
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
