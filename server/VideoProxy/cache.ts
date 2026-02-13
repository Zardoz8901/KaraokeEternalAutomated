import { createHash } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { PassThrough, Readable } from 'stream'
import { pipeline } from 'stream/promises'
import getLogger from '../lib/Log.js'

const log = getLogger('VideoProxy:cache')

// ---------------------------------------------------------------------------
// Module-level config (set once at startup)
// ---------------------------------------------------------------------------
let _cacheDir = ''

export function setVideoCacheDir (dir: string): void {
  _cacheDir = dir
}

export function getVideoCacheDir (): string {
  return _cacheDir
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 hex of the URL — deterministic, filesystem-safe, no traversal. */
export function getCacheKey (url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

/** Full path to the cached media file. */
export function getCachePath (cacheDir: string, url: string): string {
  const ext = extractExt(url) || '.mp4'
  return path.join(cacheDir, getCacheKey(url) + ext)
}

/** Sidecar metadata file (stores upstream content-type). */
export function getCacheMetaPath (cachePath: string): string {
  return cachePath + '.meta'
}

/** Extract file extension from URL path (e.g. '.webm'). Returns '' for extensionless. */
function extractExt (url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname)
    // Only accept short, safe extensions
    if (ext && /^\.[a-zA-Z0-9]{1,10}$/.test(ext)) return ext
  } catch { /* fall through */ }
  return ''
}

// ---------------------------------------------------------------------------
// Cache lookup
// ---------------------------------------------------------------------------

export interface CacheHit {
  filePath: string
  contentType: string
}

/**
 * Returns cache hit info if the file is fully cached (non-empty + meta exists).
 * Returns null on miss.
 */
export async function isCached (cacheDir: string, url: string): Promise<CacheHit | null> {
  const filePath = getCachePath(cacheDir, url)
  const metaPath = getCacheMetaPath(filePath)

  try {
    const [stat, meta] = await Promise.all([
      fs.stat(filePath),
      fs.readFile(metaPath, 'utf-8'),
    ])
    if (stat.size === 0) return null
    const contentType = meta.trim()
    if (!contentType) return null
    return { filePath, contentType }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Tee-to-cache (streaming write during proxy response)
// ---------------------------------------------------------------------------

/**
 * Tees an upstream response body to both the returned PassThrough (for the
 * client) AND a temporary file on disk. On complete: writes .meta, does
 * atomic rename. On error/abort/client disconnect: cleans up the .tmp file.
 *
 * Enforces maxSize during streaming — aborts if the byte count exceeds the
 * limit (handles chunked transfers without content-length).
 *
 * Enforces idle timeout — aborts if no bytes arrive for `idleMs` (default 30s).
 *
 * @param upstreamBody - Web ReadableStream from fetch()
 * @param maxSize - maximum bytes to accept before aborting
 * @param idleMs - abort if no bytes arrive for this many ms (0 = no idle timeout)
 * @returns PassThrough stream suitable for ctx.body
 */
export function teeToCache (
  cacheDir: string,
  url: string,
  upstreamBody: ReadableStream,
  contentType: string,
  maxSize: number,
  idleMs = 30_000,
): PassThrough {
  const filePath = getCachePath(cacheDir, url)
  const tmpPath = filePath + '.tmp'
  const metaPath = getCacheMetaPath(filePath)
  const client = new PassThrough()
  const fileStream = createWriteStream(tmpPath)
  let bytesWritten = 0
  let aborted = false
  let upstreamDone = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const cleanupTmp = () => {
    fs.unlink(tmpPath).catch(() => {})
  }

  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const resetIdleTimer = () => {
    if (!idleMs || aborted) return
    clearIdleTimer()
    idleTimer = setTimeout(() => {
      abort('Upstream idle timeout')
    }, idleMs)
  }

  const abort = (reason: string) => {
    if (aborted) return
    aborted = true
    clearIdleTimer()
    log.error('cache tee aborted: %s', reason)
    nodeStream.destroy()
    fileStream.destroy()
    client.destroy(new Error(reason))
    cleanupTmp()
  }

  const nodeStream = Readable.fromWeb(upstreamBody as import('stream/web').ReadableStream)

  // Start the idle timer
  resetIdleTimer()

  // Count bytes, enforce max size, and reset idle timer on each chunk
  nodeStream.on('data', (chunk: Buffer) => {
    bytesWritten += chunk.length
    if (bytesWritten > maxSize) {
      abort('Upstream resource too large')
      return
    }
    resetIdleTimer()
  })

  // Pipe upstream → client (returned to Koa)
  nodeStream.pipe(client)

  // Also pipe upstream → disk
  nodeStream.pipe(fileStream)

  nodeStream.on('end', () => {
    clearIdleTimer()
    upstreamDone = true
  })

  // On successful write, finalize with atomic rename
  fileStream.on('finish', () => {
    if (aborted) return
    fs.writeFile(metaPath, contentType, 'utf-8')
      .then(() => fs.rename(tmpPath, filePath))
      .then(() => log.verbose('cached: %s', filePath))
      .catch((err) => {
        log.error('cache finalize error: %s', err.message)
        cleanupTmp()
      })
  })

  // On file write error, clean up .tmp
  fileStream.on('error', () => {
    if (aborted) return
    cleanupTmp()
  })

  // On upstream error, clean up .tmp
  nodeStream.on('error', () => {
    if (aborted) return
    clearIdleTimer()
    cleanupTmp()
  })

  // On client disconnect before upstream finishes, clean up partial .tmp
  client.on('close', () => {
    if (aborted || upstreamDone) return
    clearIdleTimer()
    fileStream.destroy()
    cleanupTmp()
  })

  return client
}

// ---------------------------------------------------------------------------
// Serve cached file (with range support)
// ---------------------------------------------------------------------------

export async function serveCachedFile (
  ctx: {
    status: number
    body: unknown
    set: (key: string, val: string) => void
    get: (key: string) => string
    throw: (status: number, msg?: string) => never
  },
  filePath: string,
  contentType: string,
): Promise<void> {
  const stat = await fs.stat(filePath)
  const totalSize = stat.size

  ctx.set('Content-Type', contentType)
  ctx.set('Accept-Ranges', 'bytes')

  const rangeHeader = ctx.get('Range')
  if (rangeHeader) {
    let start: number
    let end: number

    // bytes=-suffix (last N bytes)
    const suffixMatch = /^bytes=-(\d+)$/.exec(rangeHeader)
    if (suffixMatch) {
      const suffix = parseInt(suffixMatch[1], 10)
      start = Math.max(0, totalSize - suffix)
      end = totalSize - 1
    } else {
      // bytes=start-end or bytes=start-
      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader)
      if (!match) {
        ctx.set('Content-Range', `bytes */${totalSize}`)
        ctx.throw(416, 'Invalid range')
      }

      start = parseInt(match[1], 10)
      end = match[2] ? parseInt(match[2], 10) : totalSize - 1
    }

    if (start >= totalSize || end >= totalSize || start > end) {
      ctx.set('Content-Range', `bytes */${totalSize}`)
      ctx.throw(416, 'Range not satisfiable')
    }

    ctx.status = 206
    ctx.set('Content-Range', `bytes ${start}-${end}/${totalSize}`)
    ctx.set('Content-Length', String(end - start + 1))
    ctx.body = createReadStream(filePath, { start, end })
  } else {
    ctx.set('Content-Length', String(totalSize))
    ctx.body = createReadStream(filePath)
  }
}

// ---------------------------------------------------------------------------
// Background download (prewarm)
// ---------------------------------------------------------------------------

const MAX_CONCURRENT_DOWNLOADS = 3
const DOWNLOAD_TIMEOUT_MS = 120_000
const MAX_DOWNLOAD_REDIRECTS = 5

/** Tracks in-flight background downloads by URL to deduplicate. */
const activeDownloads = new Map<string, Promise<void>>()

/** Exposed for testing only. */
export function getActiveDownloads (): Map<string, Promise<void>> {
  return activeDownloads
}

/**
 * Start a background download of a URL to cache. Deduplicates by URL.
 * Bounded by MAX_CONCURRENT_DOWNLOADS and DOWNLOAD_TIMEOUT_MS.
 *
 * Guard checks (dedup, capacity, URL validation) are synchronous to avoid
 * race conditions between concurrent callers.
 *
 * @param isUrlAllowed - SSRF validation function (reused from router)
 * @param maxSize - maximum file size in bytes
 */
export function startBackgroundDownload (
  cacheDir: string,
  url: string,
  isUrlAllowed: (url: string) => boolean,
  maxSize: number,
): Promise<void> {
  // Synchronous guard checks — no await before these
  if (activeDownloads.has(url)) return activeDownloads.get(url)!

  if (activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
    return Promise.reject(new Error('Max concurrent downloads reached'))
  }

  if (!isUrlAllowed(url)) {
    return Promise.reject(new Error('URL not allowed'))
  }

  const task = (async () => {
    // Check cache inside async body (after we've registered in activeDownloads)
    const hit = await isCached(cacheDir, url)
    if (hit) return

    const filePath = getCachePath(cacheDir, url)
    const tmpPath = filePath + '.tmp'
    const metaPath = getCacheMetaPath(filePath)

    let currentUrl = url
    let redirects = 0
    let res: Response | null = null

    // Follow redirects manually to validate each hop
    while (true) {
      res = await fetch(currentUrl, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        redirect: 'manual',
      })

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        await res.body?.cancel()

        if (!location || redirects >= MAX_DOWNLOAD_REDIRECTS) {
          throw new Error('Redirect limit exceeded or missing location')
        }

        const nextUrl = new URL(location, currentUrl).toString()
        if (!isUrlAllowed(nextUrl)) {
          throw new Error('Redirect URL not allowed')
        }

        currentUrl = nextUrl
        redirects++
        continue
      }

      break
    }

    if (!res || (!res.ok && res.status !== 206)) {
      throw new Error(`Upstream returned ${res?.status}`)
    }

    const contentType = res.headers.get('content-type') || 'video/mp4'
    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      await res.body?.cancel()
      throw new Error('Resource too large')
    }

    if (!res.body) throw new Error('No response body')

    const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)
    const fileStream = createWriteStream(tmpPath)

    await pipeline(nodeStream, fileStream)

    // Check size after download
    const stat = await fs.stat(tmpPath)
    if (stat.size > maxSize) {
      await fs.unlink(tmpPath)
      throw new Error('Downloaded file exceeds max size')
    }

    await fs.writeFile(metaPath, contentType, 'utf-8')
    await fs.rename(tmpPath, filePath)
    log.info('background download complete: %s', filePath)
  })()

  const cleanup = () => {
    activeDownloads.delete(url)
  }
  const tracked = task.then(cleanup, (err) => {
    cleanup()
    log.error('background download failed (%s): %s', url, err.message)
  })

  activeDownloads.set(url, tracked)
  return tracked
}
