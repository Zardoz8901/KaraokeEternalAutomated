import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Layer } from '@koa/router'

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>

interface MockContext {
  request: {
    body: Record<string, unknown>
    socket: { remoteAddress: string }
    header: Record<string, string>
    length?: number
  }
  ip: string
  body: unknown
  status: number
  user: {
    userId: number | null
    roomId: number | null
    username: string | null
    isAdmin: boolean
    isGuest: boolean
  }
  throw: (status: number, message?: string) => never
  get: (header: string) => string | undefined
}

function createMockCtx (overrides: Partial<MockContext> = {}): MockContext {
  return {
    request: {
      body: { events: [] },
      socket: { remoteAddress: '192.168.1.1' },
      header: { origin: 'https://karaoke.example.com' },
      length: 100,
    },
    ip: '192.168.1.1',
    body: undefined,
    status: 200,
    user: {
      userId: 42,
      roomId: 7,
      username: 'testuser',
      isAdmin: false,
      isGuest: false,
    },
    throw: (status: number, message?: string) => {
      const err = new Error(message) as Error & { status: number }
      err.status = status
      throw err
    },
    get: (header: string) => {
      if (header.toLowerCase() === 'origin') return 'https://karaoke.example.com'
      if (header.toLowerCase() === 'host') return 'karaoke.example.com'
      return undefined
    },
    ...overrides,
  }
}

const runHandler = async (handler: Handler, ctx: MockContext) => {
  await handler(ctx as unknown as Parameters<Handler>[0], async () => {})
}

// Mock Log to avoid "logger not initialized"
vi.mock('../lib/Log.js', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  }),
}))

vi.mock('../lib/Telemetry.js', () => ({
  getServerTelemetry: () => ({
    emit: vi.fn(),
  }),
}))

describe('Telemetry Ingest Router - POST /api/telemetry/ingest', () => {
  let getHandler: () => Promise<Handler>

  beforeEach(() => {
    vi.clearAllMocks()

    getHandler = async () => {
      const routerModule = await import('./router.js')
      const router = routerModule.default
      const layer = router.stack.find(
        (l: Layer) => String(l.path) === '/api/telemetry/ingest' && l.methods.includes('POST'),
      )
      expect(layer).toBeDefined()
      return layer!.stack[layer!.stack.length - 1] as Handler
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts a valid batch and returns accepted count', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: 'abc-123', duration_ms: 100 },
            { event: 'session_error', session_id: 'abc-123', error_type: 'uncaught' },
          ],
        },
        socket: { remoteAddress: '10.0.0.1' },
        header: { origin: 'https://karaoke.example.com' },
        length: 200,
      },
      ip: '10.0.0.1',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 2 })
  })

  it('returns accepted: 0 for empty events array', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: { events: [] },
        socket: { remoteAddress: '10.0.0.2' },
        header: { origin: 'https://karaoke.example.com' },
        length: 50,
      },
      ip: '10.0.0.2',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 0 })
  })

  it('rejects non-array events with 400', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: { events: 'not-an-array' },
        socket: { remoteAddress: '10.0.0.3' },
        header: { origin: 'https://karaoke.example.com' },
        length: 50,
      },
      ip: '10.0.0.3',
    })

    await expect(runHandler(handler, ctx)).rejects.toMatchObject({ status: 400 })
  })

  it('rejects batch with more than 50 events with 400', async () => {
    const handler = await getHandler()
    const events = Array.from({ length: 51 }, (_, i) => ({
      event: 'session_start',
      session_id: `ses-${i}`,
    }))
    const ctx = createMockCtx({
      request: {
        body: { events },
        socket: { remoteAddress: '10.0.0.4' },
        header: { origin: 'https://karaoke.example.com' },
        length: 5000,
      },
      ip: '10.0.0.4',
    })

    await expect(runHandler(handler, ctx)).rejects.toMatchObject({ status: 400 })
  })

  it('overwrites source to client-relay', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: 'abc-123', source: 'spoofed' },
          ],
        },
        socket: { remoteAddress: '10.0.0.5' },
        header: { origin: 'https://karaoke.example.com' },
        length: 100,
      },
      ip: '10.0.0.5',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 1 })
  })

  it('overwrites user_id and room_id from JWT context', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: 'abc-123', user_id: 999, room_id: 888 },
          ],
        },
        socket: { remoteAddress: '10.0.0.6' },
        header: { origin: 'https://karaoke.example.com' },
        length: 100,
      },
      ip: '10.0.0.6',
      user: { userId: 42, roomId: 7, username: 'real_user', isAdmin: false, isGuest: false },
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 1 })
  })

  it('re-sanitizes events (strips forbidden keys)', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: 'abc-123', token: 'secret', password: 'leak', duration_ms: 50 },
          ],
        },
        socket: { remoteAddress: '10.0.0.7' },
        header: { origin: 'https://karaoke.example.com' },
        length: 150,
      },
      ip: '10.0.0.7',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 1 })
  })

  it('skips malformed events in batch (non-object items)', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: 'abc-123' },
            'not-an-object',
            42,
            null,
            { event: 'session_error', session_id: 'abc-123' },
          ],
        },
        socket: { remoteAddress: '10.0.0.8' },
        header: { origin: 'https://karaoke.example.com' },
        length: 200,
      },
      ip: '10.0.0.8',
    })

    await runHandler(handler, ctx)
    // Only the 2 valid events should be accepted
    expect(ctx.body).toEqual({ accepted: 2 })
  })

  it('rejects oversized payload with 413', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [{ event: 'session_start', session_id: 'abc-123' }],
        },
        socket: { remoteAddress: '10.0.0.9' },
        header: { origin: 'https://karaoke.example.com' },
        length: 70_000, // exceeds 64KB
      },
      ip: '10.0.0.9',
    })

    await expect(runHandler(handler, ctx)).rejects.toMatchObject({ status: 413 })
  })

  it('rate limits by user+session+IP returning 429', async () => {
    const handler = await getHandler()
    const rateLimitIP = '192.168.50.50'
    let rateLimited = false

    for (let i = 0; i < 40; i++) {
      const ctx = createMockCtx({
        request: {
          body: {
            events: [{ event: 'session_start', session_id: `ses-${i}` }],
          },
          socket: { remoteAddress: rateLimitIP },
          header: { origin: 'https://karaoke.example.com' },
          length: 100,
        },
        ip: rateLimitIP,
        user: { userId: 42, roomId: 7, username: 'spammer', isAdmin: false, isGuest: false },
      })

      try {
        await runHandler(handler, ctx)
      } catch (err) {
        if ((err as Error & { status: number }).status === 429) {
          rateLimited = true
          break
        }
      }
    }

    expect(rateLimited).toBe(true)
  })

  it('rejects request when kill switch env var is set', async () => {
    const original = process.env.KES_TELEMETRY_INGEST_DISABLED
    process.env.KES_TELEMETRY_INGEST_DISABLED = 'true'

    try {
      const handler = await getHandler()
      const ctx = createMockCtx({
        request: {
          body: {
            events: [{ event: 'session_start', session_id: 'abc-123' }],
          },
          socket: { remoteAddress: '10.0.0.10' },
          header: { origin: 'https://karaoke.example.com' },
          length: 100,
        },
        ip: '10.0.0.10',
      })

      await expect(runHandler(handler, ctx)).rejects.toMatchObject({ status: 503 })
    } finally {
      if (original === undefined) {
        delete process.env.KES_TELEMETRY_INGEST_DISABLED
      } else {
        process.env.KES_TELEMETRY_INGEST_DISABLED = original
      }
    }
  })

  it('skips events missing required event field', async () => {
    const handler = await getHandler()
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { session_id: 'abc-123', duration_ms: 50 }, // missing event field
            { event: 'session_start', session_id: 'abc-123' },
          ],
        },
        socket: { remoteAddress: '10.0.0.11' },
        header: { origin: 'https://karaoke.example.com' },
        length: 150,
      },
      ip: '10.0.0.11',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 1 })
  })

  it('truncates session_id to 128 characters', async () => {
    const handler = await getHandler()
    const longSessionId = 'x'.repeat(200)
    const ctx = createMockCtx({
      request: {
        body: {
          events: [
            { event: 'session_start', session_id: longSessionId },
          ],
        },
        socket: { remoteAddress: '10.0.0.12' },
        header: { origin: 'https://karaoke.example.com' },
        length: 300,
      },
      ip: '10.0.0.12',
    })

    await runHandler(handler, ctx)
    expect(ctx.body).toEqual({ accepted: 1 })
  })
})
