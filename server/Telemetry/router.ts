import KoaRouter from '@koa/router'
import getLogger from '../lib/Log.js'
import {
  TELEMETRY_SCHEMA_VERSION,
  sanitizeEvent,
} from '../../shared/telemetry.js'

const log = getLogger('telemetry')
const router = new KoaRouter({ prefix: '/api/telemetry' })

// --- Constants ---
const MAX_BATCH_SIZE = 50
const MAX_PAYLOAD_BYTES = 65_536 // 64 KB
const MAX_SESSION_ID_LENGTH = 128

// --- Rate limiter (per user+IP composite key) ---
const RATE_LIMIT_MAX = 30 // max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const ingestAttempts = new Map<string, number[]>()

function rateLimit (key: string): boolean {
  const now = Date.now()
  const attempts = (ingestAttempts.get(key) || []).filter(t => t > now - RATE_LIMIT_WINDOW_MS)

  if (attempts.length >= RATE_LIMIT_MAX) {
    return false // Rate limited
  }

  attempts.push(now)
  ingestAttempts.set(key, attempts)
  return true // Allowed
}

// Cleanup old rate limit entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, attempts] of ingestAttempts.entries()) {
    const recent = attempts.filter(t => t > now - RATE_LIMIT_WINDOW_MS)
    if (recent.length === 0) {
      ingestAttempts.delete(key)
    } else {
      ingestAttempts.set(key, recent)
    }
  }
}, 5 * 60 * 1000)

// POST /api/telemetry/ingest
router.post('/ingest', async (ctx) => {
  // Kill switch — checked at runtime so it can be toggled without restart
  if (process.env.KES_TELEMETRY_INGEST_DISABLED === 'true') {
    ctx.throw(503, 'Telemetry ingest is disabled')
  }

  // Payload size check
  if (ctx.request.length && ctx.request.length > MAX_PAYLOAD_BYTES) {
    ctx.throw(413, 'Payload too large')
  }

  // Rate limit by composite key: userId + IP
  const clientIP = ctx.request.socket?.remoteAddress || ctx.ip
  const userId = ctx.user?.userId ?? 'anon'
  const rateLimitKey = `${userId}:${clientIP}`

  if (!rateLimit(rateLimitKey)) {
    log.warn('Rate limited telemetry ingest from user %s IP %s', userId, clientIP)
    ctx.throw(429, 'Too many requests. Please try again later.')
  }

  const body = (ctx.request as unknown as { body: Record<string, unknown> }).body
  const rawEvents = body?.events

  // Validate events is an array
  if (!Array.isArray(rawEvents)) {
    ctx.throw(400, 'events must be an array')
    return // unreachable — ctx.throw always throws, but satisfies TS control flow
  }

  const events: unknown[] = rawEvents

  // Batch size cap
  if (events.length > MAX_BATCH_SIZE) {
    ctx.throw(400, `Batch too large (max ${MAX_BATCH_SIZE} events)`)
  }

  const serverTimestamp = new Date().toISOString()
  const ctxUserId = ctx.user?.userId ?? undefined
  const ctxRoomId = ctx.user?.roomId ?? undefined
  let accepted = 0

  for (const raw of events) {
    // Skip non-object entries
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue

    const rawEvent = raw as Record<string, unknown>

    // Require event field
    if (typeof rawEvent.event !== 'string' || !rawEvent.event) continue

    // Re-sanitize through shared sanitizeEvent (strips forbidden keys, reserved fields, PII in values)
    const sanitized = sanitizeEvent(rawEvent)

    // Truncate session_id from client
    let sessionId = typeof rawEvent.session_id === 'string' ? rawEvent.session_id : ''
    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
      sessionId = sessionId.slice(0, MAX_SESSION_ID_LENGTH)
    }

    const entry = {
      ...sanitized,
      v: TELEMETRY_SCHEMA_VERSION,
      event: rawEvent.event as string,
      source: 'client-relay' as const,
      timestamp: serverTimestamp,
      session_id: sessionId,
      // Trust boundary: overwrite from JWT context
      user_id: ctxUserId,
      room_id: ctxRoomId,
    }

    log.info(JSON.stringify(entry))
    accepted++
  }

  ctx.body = { accepted }
})

export default router
