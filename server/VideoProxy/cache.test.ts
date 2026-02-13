import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { Readable, PassThrough } from 'stream'

// Mock logger before importing cache module
vi.mock('../lib/Log.js', () => ({
  default: () => ({ verbose: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import {
  getCacheKey,
  getCachePath,
  getCacheMetaPath,
  isCached,
  teeToCache,
  serveCachedFile,
  startBackgroundDownload,
  getActiveDownloads,
} from './cache.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videocache-test-'))
})

afterEach(async () => {
  getActiveDownloads().clear()
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('getCacheKey', () => {
  it('returns deterministic SHA-256 hex', () => {
    const key1 = getCacheKey('https://example.com/video.mp4')
    const key2 = getCacheKey('https://example.com/video.mp4')
    expect(key1).toBe(key2)
    expect(key1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different URLs produce different keys', () => {
    const key1 = getCacheKey('https://example.com/a.mp4')
    const key2 = getCacheKey('https://example.com/b.mp4')
    expect(key1).not.toBe(key2)
  })
})

describe('getCachePath', () => {
  it('joins cacheDir + hash + extension from URL', () => {
    const result = getCachePath('/cache', 'https://example.com/video.mp4')
    const key = getCacheKey('https://example.com/video.mp4')
    expect(result).toBe(path.join('/cache', key + '.mp4'))
  })

  it('defaults to .mp4 for extensionless URLs', () => {
    const result = getCachePath('/cache', 'https://example.com/stream')
    const key = getCacheKey('https://example.com/stream')
    expect(result).toBe(path.join('/cache', key + '.mp4'))
  })

  it('extracts .webm extension', () => {
    const result = getCachePath('/cache', 'https://example.com/clip.webm')
    const key = getCacheKey('https://example.com/clip.webm')
    expect(result).toBe(path.join('/cache', key + '.webm'))
  })
})

describe('getCacheMetaPath', () => {
  it('appends .meta to cache path', () => {
    expect(getCacheMetaPath('/cache/abc.mp4')).toBe('/cache/abc.mp4.meta')
  })
})

describe('isCached', () => {
  it('returns null for missing file', async () => {
    const result = await isCached(tmpDir, 'https://example.com/nonexistent.mp4')
    expect(result).toBeNull()
  })

  it('returns null for empty file', async () => {
    const url = 'https://example.com/empty.mp4'
    const filePath = getCachePath(tmpDir, url)
    const metaPath = getCacheMetaPath(filePath)
    await fs.writeFile(filePath, '')
    await fs.writeFile(metaPath, 'video/mp4')
    expect(await isCached(tmpDir, url)).toBeNull()
  })

  it('returns null when meta file is missing', async () => {
    const url = 'https://example.com/nometa.mp4'
    const filePath = getCachePath(tmpDir, url)
    await fs.writeFile(filePath, 'data')
    expect(await isCached(tmpDir, url)).toBeNull()
  })

  it('returns {filePath, contentType} for valid cache', async () => {
    const url = 'https://example.com/valid.mp4'
    const filePath = getCachePath(tmpDir, url)
    const metaPath = getCacheMetaPath(filePath)
    await fs.writeFile(filePath, 'video-data')
    await fs.writeFile(metaPath, 'video/mp4')

    const result = await isCached(tmpDir, url)
    expect(result).toEqual({ filePath, contentType: 'video/mp4' })
  })
})

describe('teeToCache', () => {
  it('writes complete file and .meta with atomic rename', async () => {
    const url = 'https://example.com/tee.mp4'
    const data = 'test-video-data-for-tee'
    const contentType = 'video/webm'

    const webStream = new ReadableStream({
      start (controller) {
        controller.enqueue(new TextEncoder().encode(data))
        controller.close()
      },
    })

    const clientStream = teeToCache(tmpDir, url, webStream, contentType, 1024 * 1024)

    // Consume the client stream
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      clientStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      clientStream.on('end', resolve)
      clientStream.on('error', reject)
    })

    expect(Buffer.concat(chunks).toString()).toBe(data)

    // Wait a tick for the finalize to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    const filePath = getCachePath(tmpDir, url)
    const metaPath = getCacheMetaPath(filePath)

    const cached = await fs.readFile(filePath, 'utf-8')
    expect(cached).toBe(data)

    const meta = await fs.readFile(metaPath, 'utf-8')
    expect(meta).toBe(contentType)

    // .tmp should not exist
    await expect(fs.access(filePath + '.tmp')).rejects.toThrow()
  })

  it('aborts and cleans up .tmp when stream exceeds maxSize', async () => {
    const url = 'https://example.com/toobig.mp4'
    const maxSize = 10 // 10 bytes max
    const data = 'this-is-way-more-than-ten-bytes-of-data'

    const webStream = new ReadableStream({
      start (controller) {
        controller.enqueue(new TextEncoder().encode(data))
        controller.close()
      },
    })

    const clientStream = teeToCache(tmpDir, url, webStream, 'video/mp4', maxSize)

    // Client stream should error
    await new Promise<void>((resolve) => {
      clientStream.on('error', () => resolve())
      clientStream.on('end', () => resolve())
      clientStream.resume() // drain
    })

    await new Promise(resolve => setTimeout(resolve, 100))

    const filePath = getCachePath(tmpDir, url)
    // Neither final file nor .tmp should exist
    await expect(fs.access(filePath)).rejects.toThrow()
    await expect(fs.access(filePath + '.tmp')).rejects.toThrow()
  })

  it('cleans up .tmp when client disconnects mid-stream', async () => {
    const url = 'https://example.com/disconnect.mp4'

    let pushChunk: ((chunk: string) => void) | undefined
    const webStream = new ReadableStream({
      start (controller) {
        pushChunk = (chunk: string) => {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
      },
    })

    const clientStream = teeToCache(tmpDir, url, webStream, 'video/mp4', 1024 * 1024)

    // Read one chunk
    pushChunk!('first-chunk')
    await new Promise(resolve => setTimeout(resolve, 20))

    // Simulate client disconnect
    clientStream.destroy()

    await new Promise(resolve => setTimeout(resolve, 100))

    const filePath = getCachePath(tmpDir, url)
    // .tmp should be cleaned up (no partial file left behind)
    await expect(fs.access(filePath + '.tmp')).rejects.toThrow()
    // Final file should not exist either
    await expect(fs.access(filePath)).rejects.toThrow()
  })
})

describe('serveCachedFile', () => {
  let filePath: string
  const contentType = 'video/mp4'
  const fileContent = 'abcdefghijklmnopqrstuvwxyz' // 26 bytes

  beforeEach(async () => {
    filePath = path.join(tmpDir, 'test-serve.mp4')
    await fs.writeFile(filePath, fileContent)
  })

  function createCtx (headers: Record<string, string> = {}) {
    const responseHeaders: Record<string, string> = {}
    return {
      status: 200 as number,
      body: undefined as unknown,
      set (key: string, val: string) { responseHeaders[key.toLowerCase()] = val },
      get (key: string) { return headers[key.toLowerCase()] ?? '' },
      throw (status: number, msg?: string): never { throw Object.assign(new Error(msg ?? `HTTP ${status}`), { status }) },
      _responseHeaders: responseHeaders,
    }
  }

  it('serves full file without Range header', async () => {
    const ctx = createCtx()
    await serveCachedFile(ctx, filePath, contentType)

    expect(ctx.status).toBe(200)
    expect(ctx._responseHeaders['content-type']).toBe('video/mp4')
    expect(ctx._responseHeaders['accept-ranges']).toBe('bytes')
    expect(ctx._responseHeaders['content-length']).toBe('26')
    expect(ctx.body).toBeDefined()
  })

  it('serves 206 with valid Range header', async () => {
    const ctx = createCtx({ range: 'bytes=0-9' })
    await serveCachedFile(ctx, filePath, contentType)

    expect(ctx.status).toBe(206)
    expect(ctx._responseHeaders['content-range']).toBe('bytes 0-9/26')
    expect(ctx._responseHeaders['content-length']).toBe('10')
  })

  it('serves 206 with open-ended Range', async () => {
    const ctx = createCtx({ range: 'bytes=20-' })
    await serveCachedFile(ctx, filePath, contentType)

    expect(ctx.status).toBe(206)
    expect(ctx._responseHeaders['content-range']).toBe('bytes 20-25/26')
    expect(ctx._responseHeaders['content-length']).toBe('6')
  })

  it('throws 416 for out-of-range request', async () => {
    const ctx = createCtx({ range: 'bytes=30-40' })
    await expect(serveCachedFile(ctx, filePath, contentType)).rejects.toMatchObject({ status: 416 })
  })

  it('throws 416 for invalid range format', async () => {
    const ctx = createCtx({ range: 'bytes=abc' })
    await expect(serveCachedFile(ctx, filePath, contentType)).rejects.toMatchObject({ status: 416 })
  })

  it('serves 206 with suffix range bytes=-N (last N bytes)', async () => {
    const ctx = createCtx({ range: 'bytes=-6' })
    await serveCachedFile(ctx, filePath, contentType)

    expect(ctx.status).toBe(206)
    // Last 6 bytes of 26-byte file → bytes 20-25
    expect(ctx._responseHeaders['content-range']).toBe('bytes 20-25/26')
    expect(ctx._responseHeaders['content-length']).toBe('6')
  })

  it('clamps suffix range to file size when larger', async () => {
    const ctx = createCtx({ range: 'bytes=-100' })
    await serveCachedFile(ctx, filePath, contentType)

    expect(ctx.status).toBe(206)
    // Suffix exceeds file size → serve whole file as 206
    expect(ctx._responseHeaders['content-range']).toBe('bytes 0-25/26')
    expect(ctx._responseHeaders['content-length']).toBe('26')
  })
})

describe('startBackgroundDownload', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetch (body: string, headers: Record<string, string> = {}) {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4', ...headers }),
      body: new ReadableStream({
        start (controller) {
          controller.enqueue(new TextEncoder().encode(body))
          controller.close()
        },
      }),
    })) as unknown as typeof fetch
  }

  const allow = () => true
  const maxSize = 500 * 1024 * 1024

  it('downloads and caches a file', async () => {
    mockFetch('bg-video-data')
    const url = 'https://example.com/bg.mp4'

    await startBackgroundDownload(tmpDir, url, allow, maxSize)

    const hit = await isCached(tmpDir, url)
    expect(hit).not.toBeNull()
    expect(hit!.contentType).toBe('video/mp4')

    const content = await fs.readFile(hit!.filePath, 'utf-8')
    expect(content).toBe('bg-video-data')
  })

  it('deduplicates concurrent downloads of the same URL', async () => {
    let resolveBody: (() => void) | undefined
    const bodyPromise = new Promise<void>(r => { resolveBody = r })

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4' }),
      body: new ReadableStream({
        start (controller) {
          bodyPromise.then(() => {
            controller.enqueue(new TextEncoder().encode('data'))
            controller.close()
          })
        },
      }),
    })) as unknown as typeof fetch

    const url = 'https://example.com/dedup.mp4'

    // Start first download — registers synchronously in activeDownloads
    const p1 = startBackgroundDownload(tmpDir, url, allow, maxSize)

    // Second call returns the same tracked promise (synchronous dedup)
    const p2 = startBackgroundDownload(tmpDir, url, allow, maxSize)
    expect(p1).toBe(p2)

    // Release the body and let both complete
    resolveBody!()
    await Promise.all([p1, p2])

    // Only one fetch call should have happened
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects when max concurrent downloads reached', async () => {
    // Track how many fetches have started
    let fetchCount = 0
    const resolvers: (() => void)[] = []

    globalThis.fetch = vi.fn(async () => {
      fetchCount++
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'video/mp4' }),
        body: new ReadableStream({
          start (controller) {
            const p = new Promise<void>(r => { resolvers.push(r) })
            p.then(() => {
              controller.enqueue(new TextEncoder().encode('data'))
              controller.close()
            })
          },
        }),
      }
    }) as unknown as typeof fetch

    // Start 3 downloads (synchronous registration in activeDownloads)
    const p1 = startBackgroundDownload(tmpDir, 'https://example.com/1.mp4', allow, maxSize)
    const p2 = startBackgroundDownload(tmpDir, 'https://example.com/2.mp4', allow, maxSize)
    const p3 = startBackgroundDownload(tmpDir, 'https://example.com/3.mp4', allow, maxSize)

    // 4th should fail — activeDownloads.size is already 3 synchronously
    await expect(
      startBackgroundDownload(tmpDir, 'https://example.com/4.mp4', allow, maxSize),
    ).rejects.toThrow('Max concurrent downloads reached')

    // Wait for async bodies to call fetch before releasing
    while (fetchCount < 3) await new Promise(r => setTimeout(r, 10))
    resolvers.forEach(r => r())
    await Promise.all([p1, p2, p3])
  })

  it('rejects disallowed URLs', async () => {
    mockFetch('data')
    const deny = () => false
    await expect(
      startBackgroundDownload(tmpDir, 'https://example.com/nope.mp4', deny, maxSize),
    ).rejects.toThrow('URL not allowed')
  })

  it('skips download when already cached', async () => {
    const url = 'https://example.com/already.mp4'
    const filePath = getCachePath(tmpDir, url)
    const metaPath = getCacheMetaPath(filePath)
    await fs.writeFile(filePath, 'existing-data')
    await fs.writeFile(metaPath, 'video/mp4')

    mockFetch('should-not-fetch')
    await startBackgroundDownload(tmpDir, url, allow, maxSize)

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
