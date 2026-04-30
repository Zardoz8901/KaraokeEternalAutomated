import { lookup } from 'node:dns/promises'
import { request, type RequestOptions } from 'node:https'
import { Readable } from 'node:stream'

type HeadersRecord = Record<string, string>
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | Array<{ address: string, family: 4 | 6 }>,
  family?: number,
) => void

interface ResolvedUrl {
  parsed: URL
  address: string
  family: 4 | 6
}

export interface ResolvedFetchInit {
  signal?: AbortSignal
  redirect?: 'manual'
  headers?: HeadersInit
}

export interface ResolvedFetchResponse {
  ok: boolean
  status: number
  headers: Headers
  body: ReadableStream<Uint8Array> | null
}

export type ResolvedFetch = (url: string, init?: ResolvedFetchInit) => Promise<ResolvedFetchResponse>

export class DisallowedProxyUrlError extends Error {
  constructor () {
    super('URL not allowed')
  }
}

const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8
  /^10\./, // 10.0.0.0/8
  /^192\.168\./, // 192.168.0.0/16
  /^0\.0\.0\.0$/, // 0.0.0.0
  /^169\.254\./, // 169.254.0.0/16 (link-local, cloud metadata)
]

/**
 * Check if a hostname is a private/loopback IP or localhost (SSRF prevention).
 */
export function isPrivateHost (hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  // Strip brackets for IPv6 literals.
  const bare = hostname.replace(/^\[|\]$/g, '')
  const lower = bare.toLowerCase()
  if (lower === '::' || lower === '::1') return true

  const mappedV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mappedV4) return isPrivateHost(mappedV4[1])

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(lower)) return true
  }

  // 172.16.0.0 - 172.31.255.255
  const m172 = /^172\.(\d+)\./.exec(lower)
  if (m172) {
    const second = parseInt(m172[1], 10)
    if (second >= 16 && second <= 31) return true
  }

  // 100.64.0.0 - 100.127.255.255 (CGNAT / Tailscale)
  const m100 = /^100\.(\d+)\./.exec(lower)
  if (m100) {
    const second = parseInt(m100[1], 10)
    if (second >= 64 && second <= 127) return true
  }

  // IPv6 ULA fc00::/7 (fc00:: - fdff::)
  if (/^f[cd]/i.test(lower)) return true
  // IPv6 link-local fe80::/10 (fe80:: - febf::)
  if (/^fe[89ab]/i.test(lower)) return true

  return false
}

/**
 * Validate that a URL is allowed to be proxied.
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
 * Resolve and validate a URL, then return the exact public IP address to use
 * for the outbound connection.
 */
export async function resolveAllowedUrl (raw: string): Promise<ResolvedUrl | null> {
  if (!isUrlAllowed(raw)) return null

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }

  try {
    const addresses = await lookup(parsed.hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: false })
    const allowed = addresses.filter(({ address }) => !isPrivateHost(address))

    if (addresses.length === 0 || allowed.length !== addresses.length) {
      return null
    }

    return {
      parsed,
      address: allowed[0].address,
      family: allowed[0].family as 4 | 6,
    }
  } catch {
    return null
  }
}

/**
 * Validate the URL syntax/hostname and confirm DNS does not resolve to a
 * private or link-local address before making an outbound proxy request.
 */
export async function isResolvedUrlAllowed (raw: string): Promise<boolean> {
  return (await resolveAllowedUrl(raw)) !== null
}

function normalizeHeaders (headers: HeadersInit | undefined, host: string): HeadersRecord {
  const normalized: HeadersRecord = {}

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value
    })
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      normalized[key] = value
    }
  } else if (headers) {
    Object.assign(normalized, headers)
  }

  normalized.Host = host
  return normalized
}

function toResponseHeaders (headers: Record<string, string | string[] | number | undefined>) {
  const out = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'undefined') continue
    if (Array.isArray(value)) {
      for (const item of value) out.append(key, item)
    } else {
      out.set(key, String(value))
    }
  }

  return out
}

/**
 * Fetch an HTTPS URL after resolving and validating its DNS answer. The request
 * keeps the original hostname for Host/SNI but pins socket DNS lookup to the
 * already validated IP, closing DNS-rebinding between validation and connect.
 */
export async function fetchResolvedUrl (raw: string, init: ResolvedFetchInit = {}): Promise<ResolvedFetchResponse> {
  const resolved = await resolveAllowedUrl(raw)
  if (!resolved) throw new DisallowedProxyUrlError()

  const { parsed, address, family } = resolved
  const port = parsed.port ? parseInt(parsed.port, 10) : 443
  const headers = normalizeHeaders(init.headers, parsed.host)
  const pinnedLookup = ((_hostname: string, lookupOptions: unknown, callback?: unknown) => {
    const cb = (typeof lookupOptions === 'function' ? lookupOptions : callback) as LookupCallback | undefined

    if (!cb) return

    if (
      typeof lookupOptions === 'object'
      && lookupOptions !== null
      && 'all' in lookupOptions
      && (lookupOptions as { all?: boolean }).all
    ) {
      cb(null, [{ address, family }])
      return
    }

    cb(null, address, family)
  }) as NonNullable<RequestOptions['lookup']>

  const options: RequestOptions = {
    protocol: 'https:',
    hostname: parsed.hostname,
    port,
    path: `${parsed.pathname}${parsed.search}`,
    method: 'GET',
    headers,
    signal: init.signal,
    servername: parsed.hostname,
    agent: false,
    lookup: pinnedLookup,
  }

  return await new Promise<ResolvedFetchResponse>((resolve, reject) => {
    const req = request(options, (res) => {
      const status = res.statusCode ?? 0
      resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: toResponseHeaders(res.headers),
        body: Readable.toWeb(res) as ReadableStream<Uint8Array>,
      })
    })

    req.once('error', reject)
    req.end()
  })
}
