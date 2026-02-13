/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { applyVideoProxyOverride, restoreVideoProxyOverride } from './videoProxyOverride'

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
      if (tag === 'video') created.push(el as HTMLVideoElement)
      return el
    }) as typeof document.createElement,
  )
  return created
}

function fireLoadedData (vid: HTMLVideoElement): void {
  vid.dispatchEvent(new Event('loadeddata'))
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
      fireLoadedData(videos[0])

      expect(source.regl.texture).toHaveBeenCalledWith({
        data: videos[0],
        wrap: 'repeat',
      })
    })
  })

  describe('startTime param', () => {
    it('seeks to numeric startTime on loadeddata', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4', { startTime: 42 })

      const vid = videos[0]
      Object.defineProperty(vid, 'duration', { value: 120, writable: true })
      fireLoadedData(vid)

      expect(vid.currentTime).toBe(42)
    })

    it('seeks to random position when startTime is "random"', () => {
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
    })

    it('does not seek when no startTime provided', () => {
      const videos = spyOnCreateElement()
      const source = makeSource()
      const globals: Record<string, unknown> = { s0: source }
      const overrides = new Map<string, unknown>()

      applyVideoProxyOverride(['s0'], globals, overrides)
      source.initVideo('https://example.com/video.mp4')

      const vid = videos[0]
      fireLoadedData(vid)

      expect(vid.currentTime).toBe(0)
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
})
