import { lookup } from 'node:dns/promises'
import { request, type RequestOptions } from 'node:https'
import type { ClientRequest, IncomingMessage } from 'node:http'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchResolvedUrl, isResolvedUrlAllowed, isUrlAllowed } from './resolvedFetch.js'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}))

vi.mock('node:https', () => ({
  request: vi.fn(),
}))

interface LookupMockAddress {
  address: string
  family: 4 | 6
}

interface LookupMock {
  mockResolvedValue: (value: LookupMockAddress[]) => LookupMock
}

const lookupMock = lookup as unknown as LookupMock
const requestMock = request as unknown as {
  mockImplementation: (
    impl: (options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest,
  ) => void
}

function mockHttpsResponse (opts: {
  status?: number
  headers?: Record<string, string | string[]>
  body?: string
} = {}) {
  const { status = 200, headers = {}, body = '' } = opts
  let capturedOptions: Record<string, unknown> | undefined

  requestMock.mockImplementation((options, callback) => {
    capturedOptions = options as unknown as Record<string, unknown>
    const req = new EventEmitter() as EventEmitter & {
      end: ReturnType<typeof vi.fn>
      destroy: ReturnType<typeof vi.fn>
    }

    req.end = vi.fn(() => {
      const res = new PassThrough() as PassThrough & {
        statusCode: number
        headers: Record<string, string | string[]>
      }
      res.statusCode = status
      res.headers = headers
      callback(res as unknown as IncomingMessage)
      res.end(body)
    })
    req.destroy = vi.fn((err?: Error) => {
      if (err) req.emit('error', err)
    })

    return req as unknown as ClientRequest
  })

  return {
    get options () {
      return capturedOptions
    },
  }
}

async function readBody (body: ReadableStream<Uint8Array> | null) {
  if (!body) return ''

  const reader = body.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  return Buffer.concat(chunks).toString('utf-8')
}

describe('resolved video proxy fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  })

  it('pins the outbound HTTPS connection to the validated DNS address', async () => {
    const mocked = mockHttpsResponse({
      headers: { 'content-type': 'video/mp4' },
      body: 'video-data',
    })

    const res = await fetchResolvedUrl('https://example.com/media/video.mp4?sig=abc', {
      headers: { Range: 'bytes=0-99' },
      redirect: 'manual',
    })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.headers.get('content-type')).toBe('video/mp4')
    await expect(readBody(res.body)).resolves.toBe('video-data')

    expect(request).toHaveBeenCalledTimes(1)
    expect(mocked.options).toMatchObject({
      protocol: 'https:',
      hostname: 'example.com',
      port: 443,
      path: '/media/video.mp4?sig=abc',
      method: 'GET',
      servername: 'example.com',
      agent: false,
    })
    expect(mocked.options?.headers).toMatchObject({
      Host: 'example.com',
      Range: 'bytes=0-99',
    })

    const pinnedLookup = mocked.options?.lookup as (
      hostname: string,
      options: Record<string, unknown>,
      callback: (err: Error | null, address: string, family: number) => void,
    ) => void
    const result = await new Promise<{ address: string, family: number }>((resolve, reject) => {
      pinnedLookup('example.com', {}, (err, address, family) => {
        if (err) reject(err)
        else resolve({ address, family })
      })
    })

    expect(result).toEqual({ address: '93.184.216.34', family: 4 })
  })

  it('does not open a socket when DNS resolves to a private address', async () => {
    lookupMock.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])

    await expect(fetchResolvedUrl('https://evil.example.com/video.mp4'))
      .rejects.toThrow('URL not allowed')

    expect(request).not.toHaveBeenCalled()
  })

  it('rejects IPv4-mapped private IPv6 DNS answers', async () => {
    lookupMock.mockResolvedValue([{ address: '::ffff:10.0.0.5', family: 6 }])

    await expect(isResolvedUrlAllowed('https://evil.example.com/video.mp4')).resolves.toBe(false)
  })

  it('rejects unspecified IPv6 literals', () => {
    expect(isUrlAllowed('https://[::]/video.mp4')).toBe(false)
  })
})
