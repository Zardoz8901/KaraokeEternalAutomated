import { Readable } from 'stream'
import KoaRouter from '@koa/router'
import getLogger from '../lib/Log.js'
import { getVideoCacheDir, isCached, teeToCache, serveCachedFile, startBackgroundDownload } from './cache.js'

const log = getLogger('VideoProxy')
const router = new KoaRouter({ prefix: '/api/video-proxy' })

// Proxy cap: prevents the server from proxying arbitrarily large upstream media.
// Raised from 500MB to reduce false 413s for large MP4s.
export const MAX_SIZE_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB
// Cache cap: keep disk usage bounded even if proxying larger media is allowed.
export const MAX_CACHE_BYTES = 500 * 1024 * 1024 // 500 MB
const CONNECT_TIMEOUT_MS = 15_000 // timeout for initial connection + headers
const IDLE_TIMEOUT_MS = 30_000 // abort if no bytes arrive for this long
const MAX_REDIRECTS = 5

const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^0\.0\.0\.0$/, // 0.0.0.0
]

/**
 * Check if a hostname is a private/loopback IP or localhost (SSRF prevention).
 */
function isPrivateHost (hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  // Strip brackets for IPv6
  const bare = hostname.replace(/^\[|\]$/g, '')
  if (bare === '::1') return true

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(bare)) return true
  }

  // 172.16.0.0 – 172.31.255.255
  const m172 = /^172\.(\d+)\./.exec(bare)
  if (m172) {
    const second = parseInt(m172[1], 10)
    if (second >= 16 && second <= 31) return true
  }

  return false
}

/**
 * Validate that a URL is allowed to be proxied.
 * Exported for unit testing.
 */
export function isUrlAllowed (raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  if (!parsed.hostname) return false
  if (isPrivateHost(parsed.hostname)) return false

  return true
}

/**
 * Validate that a Content-Type header value is an allowed media type.
 * Exported for unit testing.
 */
export function isContentTypeAllowed (ct: string | null): boolean {
  if (!ct) return false
  // Extract MIME type before any parameters (e.g. "; charset=utf-8")
  const mime = ct.split(';')[0].trim().toLowerCase()
  return mime.startsWith('video/') || mime.startsWith('audio/')
}

/**
 * Wraps a Web ReadableStream with an idle timeout — aborts if no bytes
 * arrive for `idleMs`. Returns a Node.js Readable.
 */
function idleTimeoutStream (webStream: ReadableStream, idleMs: number): Readable {
  const reader = (webStream as import('stream/web').ReadableStream).getReader()
  let timer: ReturnType<typeof setTimeout> | null = null

  const resetTimer = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      reader.cancel('idle timeout').catch(() => {})
      controller.error(new Error('Upstream idle timeout'))
    }, idleMs)
  }

  const wrapped = new ReadableStream<Uint8Array>({
    start (controller) {
      resetTimer(controller)
    },
    async pull (controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          if (timer) clearTimeout(timer)
          controller.close()
        } else {
          controller.enqueue(value)
          resetTimer(controller)
        }
      } catch (err) {
        if (timer) clearTimeout(timer)
        controller.error(err)
      }
    },
    cancel () {
      if (timer) clearTimeout(timer)
      reader.cancel().catch(() => {})
    },
  })

  return Readable.fromWeb(wrapped as import('stream/web').ReadableStream)
}

// GET /api/video-proxy?url=<encoded-url>
router.get('/', async (ctx) => {
  if (!ctx.user?.userId) {
    ctx.throw(401)
  }

  const requestedUrl = typeof ctx.query.url === 'string' ? ctx.query.url : ''
  if (!isUrlAllowed(requestedUrl)) {
    ctx.throw(400, 'Invalid or disallowed URL')
  }

  // Cache hit — serve from disk with range support
  const cacheDir = getVideoCacheDir()
  if (cacheDir) {
    const cached = await isCached(cacheDir, requestedUrl)
    if (cached) {
      log.verbose('cache hit: %s', cached.filePath)
      return serveCachedFile(ctx, cached.filePath, cached.contentType)
    }
  }

  const fetchHeaders: Record<string, string> = {}
  const clientRange = ctx.get('Range')
  if (clientRange) {
    fetchHeaders.Range = clientRange
  }

  // Use a connect-only timeout: abort if headers haven't arrived within
  // CONNECT_TIMEOUT_MS. Cleared after headers arrive so body streaming
  // isn't killed by a hard timeout (large files can take minutes).
  const ac = new AbortController()
  let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => ac.abort(new Error('Connect timeout')),
    CONNECT_TIMEOUT_MS,
  )

  let currentUrl = requestedUrl
  let redirects = 0
  let res: Response | null = null

  while (true) {
    try {
      res = await fetch(currentUrl, {
        signal: ac.signal,
        redirect: 'manual',
        headers: fetchHeaders,
      })
    } catch (err) {
      if (connectTimer) clearTimeout(connectTimer)
      ctx.throw(502, `Upstream fetch failed: ${(err as Error).message}`)
      return // unreachable but satisfies TS
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      await res.body?.cancel()

      if (!location) {
        ctx.throw(502, 'Upstream redirect missing location')
      }
      if (redirects >= MAX_REDIRECTS) {
        ctx.throw(502, 'Upstream redirect limit exceeded')
      }

      let nextUrl: string
      try {
        nextUrl = new URL(location, currentUrl).toString()
      } catch {
        ctx.throw(400, 'Invalid upstream redirect URL')
      }

      if (!isUrlAllowed(nextUrl)) {
        ctx.throw(400, 'Upstream redirect URL disallowed')
      }

      currentUrl = nextUrl
      redirects += 1
      continue
    }

    break
  }

  // Headers received — clear connect timeout so body streaming isn't killed
  if (connectTimer) {
    clearTimeout(connectTimer)
    connectTimer = null
  }

  if (!res) {
    ctx.throw(502, 'Upstream response missing')
    return
  }

  if (!res.ok && res.status !== 206) {
    ctx.throw(502, `Upstream returned ${res.status}`)
    return
  }

  const contentType = res.headers.get('content-type')
  if (!isContentTypeAllowed(contentType)) {
    // Consume body to avoid dangling connection
    await res.body?.cancel()
    ctx.throw(403, 'Upstream content type not allowed')
    return
  }

  const contentLength = res.headers.get('content-length')
  let totalSizeBytes: number | null = null
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_SIZE_BYTES) {
      await res.body?.cancel()
      ctx.throw(413, 'Upstream resource too large')
      return
    }
    if (Number.isFinite(size) && size > 0) {
      totalSizeBytes = size
    }
    ctx.set('Content-Length', contentLength)
  }

  ctx.set('Content-Type', contentType!)
  ctx.set('Accept-Ranges', 'bytes')

  let contentRange: string | null = null
  if (res.status === 206) {
    contentRange = res.headers.get('content-range')
    if (!contentRange) {
      await res.body?.cancel()
      ctx.throw(502, 'Upstream 206 missing Content-Range')
      return
    }

    ctx.status = 206
    ctx.set('Content-Range', contentRange)

    const totalMatch = /^bytes \d+-\d+\/(\d+)$/.exec(contentRange)
    if (totalMatch) {
      const total = parseInt(totalMatch[1], 10)
      if (Number.isFinite(total) && total > 0) {
        totalSizeBytes = total
      }
    }

    // If upstream omitted Content-Length, compute it from Content-Range
    if (!contentLength) {
      const rangeMatch = /^bytes (\d+)-(\d+)\//.exec(contentRange)
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10)
        const end = parseInt(rangeMatch[2], 10)
        ctx.set('Content-Length', String(end - start + 1))
      }
    }
  }

  log.verbose('proxy %s %s → %d %s (%sMB) [client-range=%s] %s',
    ctx.method,
    requestedUrl.slice(0, 120),
    res.status,
    contentType,
    contentLength ? (parseInt(contentLength, 10) / 1_000_000).toFixed(1) : '?',
    clientRange || 'none',
    currentUrl !== requestedUrl ? `(redirected → ${currentUrl.slice(0, 80)})` : '',
  )

  // Tee to cache on full 200 responses only (not Range/206 — those are partial)
  const canTeeToCache =
    !!cacheDir &&
    res.status === 200 &&
    !clientRange &&
    !!res.body &&
    totalSizeBytes !== null &&
    totalSizeBytes <= MAX_CACHE_BYTES

  if (canTeeToCache) {
    ctx.body = teeToCache(cacheDir, requestedUrl, res.body!, contentType!, MAX_CACHE_BYTES)
  } else if (cacheDir && clientRange) {
    // Browser video elements always use Range requests — kick off a background
    // download so the next request is a cache hit served from disk.
    // Only do this for reasonably sized media so we don't fill disk on giant videos.
    if (totalSizeBytes !== null && totalSizeBytes <= MAX_CACHE_BYTES) {
      startBackgroundDownload(cacheDir, requestedUrl, isUrlAllowed, MAX_CACHE_BYTES)
        .catch(() => {}) // fire-and-forget; errors logged inside
    }
    ctx.body = idleTimeoutStream(res.body!, IDLE_TIMEOUT_MS)
  } else {
    ctx.body = idleTimeoutStream(res.body!, IDLE_TIMEOUT_MS)
  }
})

export default router
