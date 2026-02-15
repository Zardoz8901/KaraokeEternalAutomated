/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { applyVideoProxyOverride, restoreVideoProxyOverride, HYDRA_VIDEO_READY_EVENT, protectVideoElement, isProtectedVideoElement, isCorsCapableHost } from './videoProxyOverride'

type MockSource = {
  initVideo: (url?: string, params?: Record<string, unknown>) => void
  src: unknown
  tex: unknown
  regl: { texture: Mock }
  dynamic: boolean
}

function makeSource (): MockSource {
  return {
    initVideo: vi.fn(),
    src: null,
    tex: null,
    regl: { texture: vi.fn((opts: Record<string, unknown>) => ({ ...opts })) },
    dynamic: false,
  }
}

/** Capture video elements created via document.createElement('video'). */
function spyOnCreateElement (): HTMLVideoElement[] {
  const created: HTMLVideoElement[] = []
  const origCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(
    ((tag: string, options?: ElementCreationOptions) => {
      const el = origCreate(tag, options)
      if (tag === 'video') {
        const vid = el as HTMLVideoElement
        Object.defineProperty(vid, 'videoWidth', { value: 640, writable: true, configurable: true })
        Object.defineProperty(vid, 'videoHeight', { value: 360, writable: true, configurable: true })
        created.push(vid)
      }
      return el
    }) as typeof document.createElement,
  )
  return created
}

function fireLoadedMetadata (vid: HTMLVideoElement): void {
  vid.dispatchEvent(new Event('loadedmetadata'))
}

function fireLoadedData (vid: HTMLVideoElement): void {
  // Under two-phase binding, readyState >= 2 is required for frame-ready signal.
  // Simulate the browser's state at loadeddata time.
  setReadyState(vid, 2)
  vid.dispatchEvent(new Event('loadeddata'))
}

function fireSeeked (vid: HTMLVideoElement): void {
  vid.dispatchEvent(new Event('seeked'))
}

function fireCanPlay (vid: HTMLVideoElement): void {
  // Under two-phase binding, readyState >= 2 is required for frame-ready signal.
  setReadyState(vid, 2)
  vid.dispatchEvent(new Event('canplay'))
}

function setReadyState (vid: HTMLVideoElement, state: number): void {
  Object.defineProperty(vid, 'readyState', { value: state, writable: true, configurable: true })
}

describe('videoProxyOverride', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('proxy rewrite', () => {
    it('rewrites external HTTPS URL through proxy', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      expect(videos[0].getAttribute('src')).toBe(
        'api/video-proxy?url=' + encodeURIComponent('https://example.com/video.mp4'),
      )
    })

    it('does not proxy same-origin absolute URLs', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)

      const url = window.location.origin + '/api/media/123?type=video'
      source.initVideo(url)

      expect(videos[0].getAttribute('src')).toBe(url)
    })

    it('uses base-relative proxy path (no leading slash)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      expect(videos[0].getAttribute('src')!.startsWith('/')).toBe(false)
    })

    it('passes relative URL through unchanged', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('/local/path.mp4')

      expect(videos[0].getAttribute('src')).toBe('/local/path.mp4')
    })

    it('creates video with empty src when called with no args', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo()

      expect(videos[0].getAttribute('src')).toBe('')
    })
  })

  describe('video element setup', () => {
    it('creates video with correct attributes', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      expect(vid.crossOrigin).toBe('anonymous')
      expect(vid.autoplay).toBe(true)
      expect(vid.loop).toBe(true)
      expect(vid.muted).toBe(true)
      expect(vid.preload).toBe('auto')
      expect(vid.playsInline).toBe(true)
    })
  })

  describe('loadeddata callback', () => {
    it('sets src, tex, and dynamic on source', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')
      fireLoadedData(videos[0])

      expect(source.src).toBe(videos[0])
      expect(source.regl.texture).toHaveBeenCalledWith({ data: videos[0] })
      expect(source.dynamic).toBe(true)
    })

    it('passes params to regl.texture', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { wrap: 'repeat' })
      fireLoadedData(videos[0])

      expect(source.regl.texture).toHaveBeenCalledWith({
        data: videos[0],
        wrap: 'repeat',
      })
    })

    it('does not pass startTime to regl.texture', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 30, wrap: 'repeat' })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)
      fireSeeked(vid)

      expect(source.regl.texture).toHaveBeenCalledWith({
        data: vid,
        wrap: 'repeat',
      })
    })
  })

  describe('startTime param', () => {
    it('seeks on loadeddata, binds on seeked', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      // After loadeddata: currentTime set but source not yet bound
      expect(vid.currentTime).toBe(42)
      expect(source.src).toBeNull()

      // After seeked: source is bound
      fireSeeked(vid)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
    })

    it('seeks to random position on loadeddata, binds on seeked', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 'random' })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 100, writable: true })
      fireLoadedData(vid)

      expect(vid.currentTime).toBeGreaterThanOrEqual(0)
      expect(vid.currentTime).toBeLessThan(100)
      expect(source.src).toBeNull()

      fireSeeked(vid)
      expect(source.src).toBe(vid)
    })

    it('timeout fallback binds if seeked never fires', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      expect(source.src).toBeNull()

      vi.advanceTimersByTime(300)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
      vi.useRealTimers()
    })

    it('seeked after timeout is no-op (no double bind)', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      // Timeout fires first
      vi.advanceTimersByTime(300)
      expect(source.src).toBe(vid)
      // 2 calls: soft-clear placeholder + bind texture
      expect(source.regl.texture).toHaveBeenCalledTimes(2)

      // Late seeked should not rebind
      fireSeeked(vid)
      expect(source.regl.texture).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('stale between loadeddata and seeked does not bind', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4', { startTime: 10 })

      const vid1 = videos[0]
      Object.defineProperty(vid1, 'duration', { value: 60, writable: true })
      fireLoadedData(vid1)

      // Second call before seeked fires on vid1
      source.initVideo('https://example.com/video2.mp4', { startTime: 20 })

      // Late seeked on vid1 should not bind
      fireSeeked(vid1)
      expect(source.src).not.toBe(vid1)
    })

    it('does not seek when no startTime provided (binds on loadeddata)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      fireLoadedData(vid)

      expect(vid.currentTime).toBe(0)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
    })
  })

  describe('epoch guard (stale race prevention)', () => {
    it('ignores stale loadeddata callback', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Fire loadeddata on the first (stale) video
      fireLoadedData(videos[0])

      // src must NOT be the stale video
      expect(source.src).not.toBe(videos[0])
    })

    it('accepts loadeddata from current video after stale was dropped', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Fire loadeddata on the second (current) video
      fireLoadedData(videos[1])

      expect(source.src).toBe(videos[1])
      expect(source.dynamic).toBe(true)
    })

    it('cleans up previous in-flight video immediately on next call', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')

      const firstVid = videos[0]
      const pauseSpy = vi.spyOn(firstVid, 'pause')
      const loadSpy = vi.spyOn(firstVid, 'load')

      // Second call should clean up the first video immediately
      source.initVideo('https://example.com/video2.mp4')

      expect(pauseSpy).toHaveBeenCalled()
      expect(firstVid.hasAttribute('src')).toBe(false)
      expect(loadSpy).toHaveBeenCalled()
    })

    it('cleans up stale video element when its loadeddata fires late', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Stale loadeddata fires — should clean up
      const pauseSpy = vi.spyOn(videos[0], 'pause')
      fireLoadedData(videos[0])

      expect(pauseSpy).toHaveBeenCalled()
    })
  })

  describe('soft-clear on initVideo (camera→video bleed prevention)', () => {
    it('clears source tex/src immediately on initVideo call before video loads', () => {
      spyOnCreateElement()
      const source = makeSource()
      // Simulate a previously bound camera source
      const prevVideo = document.createElement('video')
      source.src = prevVideo
      source.tex = { fake: 'texture' }
      source.dynamic = true
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Before loadeddata fires, source should be cleared
      expect(source.src).toBeNull()
      expect(source.dynamic).toBe(false)
      // A 1x1 placeholder texture should have been created
      expect(source.regl.texture).toHaveBeenCalledWith({ shape: [1, 1] })
    })

    it('stops tracks and clears srcObject when prevSrc is an unprotected MediaStream video', () => {
      spyOnCreateElement()
      const source = makeSource()
      // Simulate a source with a local camera MediaStream (getUserMedia)
      const streamVideo = document.createElement('video')
      const stopSpy = vi.fn()
      const mockStream = { getTracks: () => [{ stop: stopSpy }, { stop: stopSpy }] }
      Object.defineProperty(streamVideo, 'srcObject', {
        value: mockStream,
        writable: true,
        configurable: true,
      })
      source.src = streamVideo
      const pauseSpy = vi.spyOn(streamVideo, 'pause')

      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Unprotected MediaStream video MUST have tracks stopped
      expect(stopSpy).toHaveBeenCalledTimes(2)
      expect(streamVideo.srcObject).toBeNull()
      expect(pauseSpy).toHaveBeenCalled()
    })

    it('does NOT stop tracks when prevSrc is a protected relay element', () => {
      spyOnCreateElement()
      const source = makeSource()
      // Simulate a source with a relay (WebRTC) MediaStream
      const streamVideo = document.createElement('video')
      const stopSpy = vi.fn()
      const mockStream = { getTracks: () => [{ stop: stopSpy }] }
      Object.defineProperty(streamVideo, 'srcObject', {
        value: mockStream,
        writable: true,
        configurable: true,
      })
      // Mark as protected relay element
      protectVideoElement(streamVideo)
      source.src = streamVideo
      const pauseSpy = vi.spyOn(streamVideo, 'pause')

      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Protected relay element MUST NOT have tracks stopped
      expect(stopSpy).not.toHaveBeenCalled()
      expect(pauseSpy).not.toHaveBeenCalled()
    })
  })

  describe('hydra:video-ready event', () => {
    it('dispatches on globals when video binds (loadeddata path)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let fired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { fired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')
      fireLoadedData(videos[0])

      expect(fired).toBe(true)
    })

    it('dispatches on globals when video binds (seeked path with startTime)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let fired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { fired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      // Not yet — waiting for seeked
      expect(fired).toBe(false)

      fireSeeked(vid)
      expect(fired).toBe(true)
    })

    it('does not dispatch on stale bind (epoch guard)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let fireCount = 0
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { fireCount++ })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Fire loadeddata on first (stale) video
      fireLoadedData(videos[0])
      expect(fireCount).toBe(0)

      // Fire loadeddata on second (current) video
      fireLoadedData(videos[1])
      expect(fireCount).toBe(1)
    })
  })

  describe('protectVideoElement / isProtectedVideoElement helpers', () => {
    it('marks an element as protected', () => {
      const el = document.createElement('video')
      expect(isProtectedVideoElement(el)).toBe(false)
      protectVideoElement(el)
      expect(isProtectedVideoElement(el)).toBe(true)
    })

    it('is idempotent (protect twice does not throw)', () => {
      const el = document.createElement('video')
      protectVideoElement(el)
      protectVideoElement(el)
      expect(isProtectedVideoElement(el)).toBe(true)
    })
  })

  describe('canplay fallback', () => {
    it('binds source on canplay if loadeddata never fires', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Only fire canplay (no loadeddata)
      fireCanPlay(videos[0])

      expect(source.src).toBe(videos[0])
      expect(source.dynamic).toBe(true)
    })

    it('binds only once when both loadeddata and canplay fire', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      fireLoadedData(videos[0])
      fireCanPlay(videos[0])

      // 2 calls: soft-clear placeholder + bind texture (NOT 3)
      expect(source.regl.texture).toHaveBeenCalledTimes(2)
    })

    it('epoch guard works on canplay path', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Stale canplay on first video should not bind
      fireCanPlay(videos[0])
      expect(source.src).not.toBe(videos[0])

      // Current canplay on second video should bind
      fireCanPlay(videos[1])
      expect(source.src).toBe(videos[1])
    })

    it('startTime path: onReady fires via canplay if loadeddata never fires', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })

      // Only canplay fires (no loadeddata)
      fireCanPlay(vid)

      // Should have seeked
      expect(vid.currentTime).toBe(42)
      expect(source.src).toBeNull() // waiting for seeked

      fireSeeked(vid)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
    })

    it('startTime path: onReady fires only once when both events fire', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 10 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 60, writable: true })

      // Both fire — only first should trigger seek setup
      fireCanPlay(vid)
      expect(vid.currentTime).toBe(10)

      // Reset to detect if loadeddata re-triggers seek
      vid.currentTime = 0
      fireLoadedData(vid)
      // currentTime should NOT have been set again by loadeddata
      expect(vid.currentTime).toBe(0)
    })
  })

  describe('readyState poll fallback', () => {
    it('binds via readyState poll when no events fire', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      expect(source.src).toBeNull()

      // readyState >= 1 with valid dimensions — poll binds (Phase 1: placeholder)
      setReadyState(vid, 1)
      vi.advanceTimersByTime(200)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)

      // readyState >= 2 — poll signals frame-ready (Phase 2)
      setReadyState(vid, 2)
      vi.advanceTimersByTime(200)
      vi.useRealTimers()
    })

    it('poll stops after max attempts', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // readyState stays at 0 — poll should give up after 50 * 200ms = 10s
      vi.advanceTimersByTime(10200)
      expect(source.src).toBeNull()
      vi.useRealTimers()
    })

    it('poll self-clears when loadeddata fires first', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      fireLoadedData(vid)
      expect(source.src).toBe(vid)

      // Advancing time should not cause issues (poll should have cleared)
      source.regl.texture.mockClear()
      Object.defineProperty(vid, 'readyState', { value: 4, writable: true, configurable: true })
      vi.advanceTimersByTime(1000)
      // No extra texture calls from the poll
      expect(source.regl.texture).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('restore', () => {
    it('restores original initVideo', () => {
      const original = vi.fn()
      const globals: Record<string, unknown> = {
        s0: { initVideo: original },
      }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      restoreVideoProxyOverride(globals, overrides)

      const ext = globals.s0 as { initVideo: typeof original }
      expect(ext.initVideo).toBe(original)
      expect(overrides.size).toBe(0)
    })

    it('cleans up pending video on restore', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const pauseSpy = vi.spyOn(videos[0], 'pause')

      restoreVideoProxyOverride(globals, overrides)

      expect(pauseSpy).toHaveBeenCalled()
    })
  })

  describe('loadedmetadata two-phase binding', () => {
    it('binds with placeholder texture at readyState 1, no event dispatch', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let eventFired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { eventFired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      setReadyState(vid, 1)
      fireLoadedMetadata(vid)

      // Phase 1: bind happened (placeholder texture, src set, dynamic true)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
      // Placeholder texture: width/height, NOT { data: vid }
      expect(source.regl.texture).toHaveBeenLastCalledWith({ width: 640, height: 360 })
      // Phase 2 NOT yet: event must NOT fire at readyState < 2
      expect(eventFired).toBe(false)
    })

    it('dispatches event on subsequent loadeddata (frame-ready)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let eventFired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { eventFired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      // Phase 1: loadedmetadata at readyState 1
      setReadyState(vid, 1)
      fireLoadedMetadata(vid)
      expect(source.src).toBe(vid)
      expect(eventFired).toBe(false)

      // Phase 2: loadeddata at readyState 2 → event dispatched
      setReadyState(vid, 2)
      fireLoadedData(vid)
      expect(eventFired).toBe(true)
    })

    it('binds with { data: vid } at readyState >= 2 and dispatches event immediately', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let eventFired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { eventFired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      setReadyState(vid, 2)
      fireLoadedMetadata(vid)

      // Both phases at once: data texture + event
      expect(source.src).toBe(vid)
      expect(source.regl.texture).toHaveBeenLastCalledWith({ data: vid })
      expect(eventFired).toBe(true)
    })

    it('loadedmetadata binds, loadeddata signals frame-ready (no double texture)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      setReadyState(vid, 1)
      fireLoadedMetadata(vid) // Phase 1 bind → placeholder texture

      setReadyState(vid, 2)
      fireLoadedData(vid) // Phase 2 frame-ready → event only, no rebind

      // 2 texture calls: soft-clear placeholder (1x1) + bind placeholder (WxH)
      // NOT 3 — loadeddata must not create another texture
      expect(source.regl.texture).toHaveBeenCalledTimes(2)
    })

    it('regl.texture({ data: vid }) try/catch falls back to placeholder', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()

      // Make regl.texture throw when called with { data: ... }
      let callCount = 0
      source.regl.texture = vi.fn((opts: Record<string, unknown>) => {
        callCount++
        if ('data' in opts) throw new Error('texImage2D failed')
        return { ...opts }
      })

      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      setReadyState(vid, 2)
      // Should not throw — falls back to placeholder
      fireLoadedMetadata(vid)

      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
      // Last successful call should be the placeholder (width/height), not data
      const lastCall = source.regl.texture.mock.calls[source.regl.texture.mock.calls.length - 1]
      expect(lastCall[0]).toEqual({ width: 640, height: 360 })
    })

    it('stale callback only cleans vid, not state timers', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Fire loadedmetadata on stale (first) video — should cleanup vid but NOT timers
      const vid1 = videos[0]
      setReadyState(vid1, 1)
      const pauseSpy = vi.spyOn(vid1, 'pause')
      fireLoadedMetadata(vid1)
      expect(pauseSpy).toHaveBeenCalled()

      // Second video's poll should still be running
      const vid2 = videos[1]
      setReadyState(vid2, 2)
      vi.advanceTimersByTime(200)
      // Poll should have bound the second video
      expect(source.src).toBe(vid2)

      vi.useRealTimers()
    })
  })

  describe('readyState poll two-phase', () => {
    it('poll binds at readyState 1, signals frame-ready at readyState 2', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let eventFired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { eventFired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      // Phase 1: readyState 1 with valid dimensions → bind, no event
      setReadyState(vid, 1)
      vi.advanceTimersByTime(200)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
      expect(eventFired).toBe(false)

      // Phase 2: readyState 2 → event dispatched
      setReadyState(vid, 2)
      vi.advanceTimersByTime(200)
      expect(eventFired).toBe(true)

      vi.useRealTimers()
    })

    it('poll skips Phase 1 for startTime videos', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      setReadyState(vid, 1)

      // Poll should NOT bind startTime videos at readyState 1
      vi.advanceTimersByTime(200)
      expect(source.src).toBeNull()

      // Event-driven path: loadedmetadata triggers seek, then seeked binds
      fireLoadedMetadata(vid)
      expect(vid.currentTime).toBe(42)
      expect(source.src).toBeNull() // waiting for seeked

      fireSeeked(vid)
      expect(source.src).toBe(vid)

      vi.useRealTimers()
    })

    it('poll stops on vid.error', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      // Simulate a MediaError
      Object.defineProperty(vid, 'error', {
        value: { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' },
        writable: true,
        configurable: true,
      })

      // Poll should stop after seeing the error
      vi.advanceTimersByTime(200)
      // Even after many more intervals, source stays unbound
      vi.advanceTimersByTime(2000)
      expect(source.src).toBeNull()

      vi.useRealTimers()
    })

    it('poll exhaustion warning gated behind debug flag', () => {
      vi.useFakeTimers()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // readyState stays 0 — poll exhausts after 10s
      vi.advanceTimersByTime(10200)

      // In production (debug disabled), no console.warn about poll exhaustion
      const pollWarnings = warnSpy.mock.calls.filter(
        args => typeof args[0] === 'string' && args[0].includes('poll exhausted'),
      )
      expect(pollWarnings.length).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('startTime + loadedmetadata', () => {
    it('loadedmetadata triggers seek, bind on seeked with placeholder, event on loadeddata', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const target = new EventTarget()
      const globals = Object.assign(target, { s0: source }) as unknown as Record<string, unknown>
      const overrides = new Map<string, unknown>()

      let eventFired = false
      target.addEventListener(HYDRA_VIDEO_READY_EVENT, () => { eventFired = true })

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })

      // loadedmetadata at readyState 1 → triggers seek
      setReadyState(vid, 1)
      fireLoadedMetadata(vid)
      expect(vid.currentTime).toBe(42)
      expect(source.src).toBeNull() // waiting for seeked

      // seeked → bind with placeholder (readyState still 1)
      fireSeeked(vid)
      expect(source.src).toBe(vid)
      expect(source.dynamic).toBe(true)
      expect(source.regl.texture).toHaveBeenLastCalledWith({ width: 640, height: 360 })
      expect(eventFired).toBe(false) // still readyState < 2

      // loadeddata at readyState 2 → frame-ready, event dispatched
      setReadyState(vid, 2)
      fireLoadedData(vid)
      expect(eventFired).toBe(true)
    })
  })

  describe('isCorsCapableHost', () => {
    it('does not match archive.org (removed from allowlist)', () => {
      expect(isCorsCapableHost('archive.org')).toBe(false)
    })

    it('does not match subdomain of archive.org (removed from allowlist)', () => {
      expect(isCorsCapableHost('ia600206.us.archive.org')).toBe(false)
    })

    it('does not match non-allowlisted host', () => {
      expect(isCorsCapableHost('example.com')).toBe(false)
    })

    it('does not match partial suffix (fakearchive.org)', () => {
      expect(isCorsCapableHost('fakearchive.org')).toBe(false)
    })
  })

  describe('CORS-capable host bypass', () => {
    it('archive.org URL is proxied (not CORS-capable)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://archive.org/download/item/file.mp4')

      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )
    })

    it('*.archive.org subdomain is proxied (not CORS-capable)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://ia600206.us.archive.org/35/items/video/file.mp4')

      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )
    })

    it('non-allowlisted host is proxied', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )
    })

    it('same-origin URL still not proxied', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      const url = window.location.origin + '/api/media/123?type=video'
      source.initVideo(url)

      expect(videos[0].getAttribute('src')).toBe(url)
    })
  })

  describe('error retry fallback', () => {
    function fireVideoError (vid: HTMLVideoElement, code = 4, message = 'MEDIA_ERR_SRC_NOT_SUPPORTED'): void {
      Object.defineProperty(vid, 'error', {
        value: { code, message },
        writable: true,
        configurable: true,
      })
      vid.dispatchEvent(new Event('error'))
    }

    it('proxied video error is terminal for non-CORS host (no direct retry)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // First video should be proxied
      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )

      // Fire error on proxied video → should NOT retry direct (non-CORS host)
      fireVideoError(videos[0])

      // No second video created — error is terminal
      expect(videos.length).toBe(1)
    })

    it('proxied archive.org error is terminal (archive.org not CORS-capable)', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://ia600206.us.archive.org/35/items/video/file.mp4')

      // Should be proxied (no longer CORS-capable)
      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )

      // Fire error → terminal, no direct retry
      fireVideoError(videos[0])
      expect(videos.length).toBe(1)
    })

    it('forced proxy retry (via __retryProxy) does not loop on second error', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)

      // Simulate a forced proxy retry (as if a direct attempt failed)
      overrides.set('__retryProxy:https://example.com/video.mp4', true)
      source.initVideo('https://example.com/video.mp4')

      // Should be proxied (forced retry)
      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )

      // Error on the retry → no further retry (isRetry flag is true)
      fireVideoError(videos[0])
      expect(videos.length).toBe(1)
    })

    it('stale epoch prevents retry', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video1.mp4')
      source.initVideo('https://example.com/video2.mp4')

      // Error on first (stale) video → no retry
      fireVideoError(videos[0])
      expect(videos.length).toBe(2) // only 2 videos, not 3
    })

    it('frameReady prevents retry', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Successful bind + frame-ready
      fireLoadedData(videos[0])
      expect(source.src).toBe(videos[0])

      // Error after frame-ready → no retry
      fireVideoError(videos[0])
      expect(videos.length).toBe(1)
    })

    it('startTime preserved on direct→proxy retry', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)

      // Force a direct URL by using same-origin-like path that's still HTTP
      // Use __retryProxy to simulate a direct→proxy retry preserving startTime
      overrides.set('__retryProxy:https://example.com/video.mp4', true)
      source.initVideo('https://example.com/video.mp4', { startTime: 42, wrap: 'repeat' })

      // Should be proxied (forced retry)
      expect(videos[0].getAttribute('src')).toEqual(
        expect.stringContaining('api/video-proxy?url='),
      )

      // The retried video should still honor startTime (seeked path)
      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      // startTime path: should have set currentTime
      expect(vid.currentTime).toBe(42)
    })

    it('poll-detected error is terminal for non-CORS proxied host', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      // Set vid.error without dispatching the error event (Firefox flaky event timing)
      Object.defineProperty(videos[0], 'error', {
        value: { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' },
        writable: true,
        configurable: true,
      })

      // Poll should detect error but NOT retry (non-CORS host → terminal)
      vi.advanceTimersByTime(200)

      expect(videos.length).toBe(1)

      vi.useRealTimers()
    })

    it('poll does not retry on error when already a retry', () => {
      vi.useFakeTimers()
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)

      // Force a proxy retry to get isRetry=true
      overrides.set('__retryProxy:https://example.com/video.mp4', true)
      source.initVideo('https://example.com/video.mp4')

      // Retry video gets error via poll (no event)
      Object.defineProperty(videos[0], 'error', {
        value: { code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED' },
        writable: true,
        configurable: true,
      })
      vi.advanceTimersByTime(200)

      // Should NOT have created a second video (isRetry prevents it)
      expect(videos.length).toBe(1)

      vi.useRealTimers()
    })

    it('non-HTTP URL does not trigger retry', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('/local/path.mp4')

      fireVideoError(videos[0])
      // No retry for local paths
      expect(videos.length).toBe(1)
    })
  })
})
