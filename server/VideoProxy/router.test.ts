import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Readable } from 'stream'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Mock the logger before importing router (logger not initialized in test env)
vi.mock('../lib/Log.js', () => ({
  default: () => ({ verbose: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { isUrlAllowed, isContentTypeAllowed, MAX_CACHE_BYTES, MAX_SIZE_BYTES } from './router.js'
import { setVideoCacheDir, getCachePath, getCacheMetaPath } from './cache.js'

/**
 * Helper to get the GET / handler from the router's internal stack.
 */
async function getHandler () {
  const routerModule = await import('./router.js')
  const router = routerModule.default
  const layer = (router as unknown as {
    stack: Array<{
      path: string
      methods: string[]
      stack: Array<(ctx: unknown, next: () => Promise<void>) => Promise<void>>
    }>
  }).stack.find(l => l.path === '/api/video-proxy' && l.methods.includes('GET'))

  if (!layer) throw new Error('GET /api/video-proxy handler not found')
  return layer.stack[layer.stack.length - 1]
}

/**
 * Create a minimal Koa-like ctx for testing.
 */
function createCtx (query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const responseHeaders: Record<string, string> = {}
  return {
    user: { userId: 1 },
    query,
    headers,
    status: 200 as number,
    body: undefined as unknown,
    set (key: string, val: string) { responseHeaders[key.toLowerCase()] = val },
    get (key: string) { return headers[key.toLowerCase()] ?? '' },
    throw (status: number, msg?: string) { throw Object.assign(new Error(msg ?? `HTTP ${status}`), { status }) },
    _responseHeaders: responseHeaders,
  }
}

/**
 * Create a minimal Web Response mock for upstream fetch.
 */
function createUpstreamResponse (opts: {
  status?: number
  ok?: boolean
  headers?: Record<string, string>
  body?: string
}) {
  const { status = 200, ok = true, headers = {}, body = '' } = opts
  const stream = new ReadableStream({
    start (controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return {
    ok,
    status,
    headers: new Headers(headers),
    body: stream,
  } as unknown as Response
}

describe('VideoProxy', () => {
  describe('isUrlAllowed', () => {
    it('allows https URLs with public hostnames', () => {
      expect(isUrlAllowed('https://archive.org/download/item/file.mp4')).toBe(true)
      expect(isUrlAllowed('https://ia600206.us.archive.org/29/items/file.mp4')).toBe(true)
      expect(isUrlAllowed('https://example.com/video.webm')).toBe(true)
    })

    it('rejects non-https protocols', () => {
      expect(isUrlAllowed('http://example.com/video.mp4')).toBe(false)
      expect(isUrlAllowed('ftp://example.com/video.mp4')).toBe(false)
      expect(isUrlAllowed('file:///etc/passwd')).toBe(false)
      expect(isUrlAllowed('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('rejects private/loopback IPs (SSRF prevention)', () => {
      expect(isUrlAllowed('https://127.0.0.1/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://127.0.0.42/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://10.0.0.1/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://10.255.255.255/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://172.16.0.1/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://172.31.255.255/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://192.168.0.1/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://192.168.255.255/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://0.0.0.0/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://[::1]/video.mp4')).toBe(false)
    })

    it('allows non-private 172.x addresses', () => {
      expect(isUrlAllowed('https://172.15.0.1/video.mp4')).toBe(true)
      expect(isUrlAllowed('https://172.32.0.1/video.mp4')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(isUrlAllowed('')).toBe(false)
      expect(isUrlAllowed('not-a-url')).toBe(false)
      expect(isUrlAllowed('https://')).toBe(false)
    })

    it('rejects localhost', () => {
      expect(isUrlAllowed('https://localhost/video.mp4')).toBe(false)
      expect(isUrlAllowed('https://localhost:3000/video.mp4')).toBe(false)
    })
  })

  describe('isContentTypeAllowed', () => {
    it('allows video/* MIME types', () => {
      expect(isContentTypeAllowed('video/mp4')).toBe(true)
      expect(isContentTypeAllowed('video/webm')).toBe(true)
      expect(isContentTypeAllowed('video/ogg')).toBe(true)
      expect(isContentTypeAllowed('video/mp4; charset=utf-8')).toBe(true)
    })

    it('allows audio/* MIME types', () => {
      expect(isContentTypeAllowed('audio/mpeg')).toBe(true)
      expect(isContentTypeAllowed('audio/ogg')).toBe(true)
    })

    it('rejects non-media MIME types', () => {
      expect(isContentTypeAllowed('text/html')).toBe(false)
      expect(isContentTypeAllowed('application/json')).toBe(false)
      expect(isContentTypeAllowed('application/javascript')).toBe(false)
      expect(isContentTypeAllowed('image/png')).toBe(false)
    })

    it('rejects null/empty content type', () => {
      expect(isContentTypeAllowed(null)).toBe(false)
      expect(isContentTypeAllowed('')).toBe(false)
    })
  })

  describe('MAX_SIZE_BYTES', () => {
    it('is 5GB', () => {
      expect(MAX_SIZE_BYTES).toBe(5 * 1024 * 1024 * 1024)
    })
  })

  describe('MAX_CACHE_BYTES', () => {
    it('is 500MB', () => {
      expect(MAX_CACHE_BYTES).toBe(500 * 1024 * 1024)
    })
  })

  describe('redirect safety', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('rejects redirect to disallowed private URL', async () => {
      const fetchMock = vi.fn(async () => createUpstreamResponse({
        status: 302,
        ok: false,
        headers: {
          location: 'https://127.0.0.1/private.mp4',
        },
      })) as typeof fetch
      globalThis.fetch = fetchMock

      const handler = await getHandler()
      const ctx = createCtx({ url: 'https://example.com/video.mp4' })

      await expect(handler(ctx, async () => {})).rejects.toMatchObject({ status: 400 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('follows safe redirect and streams final content', async () => {
      const fetchMock = vi.fn()
      fetchMock
        .mockImplementationOnce(async () => createUpstreamResponse({
          status: 302,
          ok: false,
          headers: {
            location: 'https://cdn.example.com/video.mp4',
          },
        }))
        .mockImplementationOnce(async () => createUpstreamResponse({
          status: 200,
          ok: true,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '1234',
          },
          body: 'video-data',
        }))
      globalThis.fetch = fetchMock as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url: 'https://example.com/video.mp4' })

      await handler(ctx, async () => {})

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.com/video.mp4')
      expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example.com/video.mp4')
      expect(ctx.body).toBeInstanceOf(Readable)
    })
  })

  describe('Range request handling', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('forwards the client Range header to upstream', async () => {
      let capturedInit: RequestInit | undefined
      globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedInit = init
        return createUpstreamResponse({
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-999/5000',
            'accept-ranges': 'bytes',
          },
        })
      }) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx(
        { url: 'https://example.com/video.mp4' },
        { range: 'bytes=0-999' },
      )
      await handler(ctx, async () => {})

      const fetchHeaders = capturedInit?.headers as Record<string, string> | undefined
      expect(fetchHeaders).toBeDefined()
      expect(fetchHeaders!.Range).toBe('bytes=0-999')
    })

    it('passes through 206 status and Content-Range header', async () => {
      globalThis.fetch = vi.fn(async () =>
        createUpstreamResponse({
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-999/5000',
            'accept-ranges': 'bytes',
            'content-length': '1000',
          },
        }),
      ) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx(
        { url: 'https://example.com/video.mp4' },
        { range: 'bytes=0-999' },
      )
      await handler(ctx, async () => {})

      expect(ctx.status).toBe(206)
      expect(ctx._responseHeaders['content-range']).toBe('bytes 0-999/5000')
      expect(ctx._responseHeaders['accept-ranges']).toBe('bytes')
    })

    it('computes Content-Length from Content-Range when upstream 206 omits Content-Length', async () => {
      globalThis.fetch = vi.fn(async () =>
        createUpstreamResponse({
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-999/5000',
            // No content-length header
          },
        }),
      ) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx(
        { url: 'https://example.com/video.mp4' },
        { range: 'bytes=0-999' },
      )
      await handler(ctx, async () => {})

      expect(ctx.status).toBe(206)
      expect(ctx._responseHeaders['content-range']).toBe('bytes 0-999/5000')
      // Content-Length must be computed as end - start + 1 = 1000
      expect(ctx._responseHeaders['content-length']).toBe('1000')
    })

    it('throws 502 when upstream returns 206 without Content-Range', async () => {
      globalThis.fetch = vi.fn(async () =>
        createUpstreamResponse({
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            // No content-range header — malformed 206
          },
        }),
      ) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx(
        { url: 'https://example.com/video.mp4' },
        { range: 'bytes=0-999' },
      )

      await expect(handler(ctx, async () => {})).rejects.toMatchObject({ status: 502 })
    })

    it('streams full body for non-Range requests', async () => {
      globalThis.fetch = vi.fn(async () =>
        createUpstreamResponse({
          status: 200,
          ok: true,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '5000',
          },
          body: 'full-video-data',
        }),
      ) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url: 'https://example.com/video.mp4' })
      await handler(ctx, async () => {})

      // Should remain 200 (no Range header sent)
      expect(ctx.status).toBe(200)
      // Should include Accept-Ranges so browser knows ranges are available
      expect(ctx._responseHeaders['accept-ranges']).toBe('bytes')
      // Body should be a Node.js Readable stream
      expect(ctx.body).toBeInstanceOf(Readable)
    })
  })

  describe('Cache integration', () => {
    let originalFetch: typeof globalThis.fetch
    let tmpDir: string

    beforeEach(async () => {
      originalFetch = globalThis.fetch
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videoproxy-router-test-'))
      setVideoCacheDir(tmpDir)
    })

    afterEach(async () => {
      globalThis.fetch = originalFetch
      setVideoCacheDir('')
      // Small delay to let tee-to-cache file operations complete before cleanup
      await new Promise(resolve => setTimeout(resolve, 50))
      await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
    })

    it('serves from cache on hit with correct content-type', async () => {
      const url = 'https://example.com/cached-video.mp4'
      const fileContent = 'cached-video-bytes'

      // Pre-populate cache
      const filePath = getCachePath(tmpDir, url)
      await fs.writeFile(filePath, fileContent)
      await fs.writeFile(getCacheMetaPath(filePath), 'video/webm')

      // fetch should NOT be called
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Should not reach upstream')
      }) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url })
      await handler(ctx, async () => {})

      expect(ctx.status).toBe(200)
      expect(ctx._responseHeaders['content-type']).toBe('video/webm')
      expect(ctx._responseHeaders['accept-ranges']).toBe('bytes')
      expect(ctx._responseHeaders['content-length']).toBe(String(fileContent.length))
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('falls through to upstream on cache miss', async () => {
      globalThis.fetch = vi.fn(async () =>
        createUpstreamResponse({
          status: 200,
          ok: true,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '100',
          },
          body: 'upstream-data',
        }),
      ) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url: 'https://example.com/uncached.mp4' })
      await handler(ctx, async () => {})

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(ctx.body).toBeDefined()
    })

    it('handles Range requests on cached file with 206', async () => {
      const url = 'https://example.com/ranged.mp4'
      const fileContent = 'abcdefghijklmnopqrstuvwxyz' // 26 bytes

      const filePath = getCachePath(tmpDir, url)
      await fs.writeFile(filePath, fileContent)
      await fs.writeFile(getCacheMetaPath(filePath), 'video/mp4')

      globalThis.fetch = vi.fn(async () => {
        throw new Error('Should not reach upstream')
      }) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url }, { range: 'bytes=5-14' })
      await handler(ctx, async () => {})

      expect(ctx.status).toBe(206)
      expect(ctx._responseHeaders['content-range']).toBe('bytes 5-14/26')
      expect(ctx._responseHeaders['content-length']).toBe('10')
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('returns 416 for out-of-range on cached file', async () => {
      const url = 'https://example.com/small.mp4'
      const filePath = getCachePath(tmpDir, url)
      await fs.writeFile(filePath, 'short')
      await fs.writeFile(getCacheMetaPath(filePath), 'video/mp4')

      globalThis.fetch = vi.fn(async () => {
        throw new Error('Should not reach upstream')
      }) as typeof fetch

      const handler = await getHandler()
      const ctx = createCtx({ url }, { range: 'bytes=100-200' })

      await expect(handler(ctx, async () => {})).rejects.toMatchObject({ status: 416 })
    })
  })
})
