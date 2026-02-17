// Telemetry schema shared between client and server.
// All telemetry events conform to TelemetryEvent.
// INVARIANT: emit() must never throw, never block, never contain PII.

export const TELEMETRY_SCHEMA_VERSION = 1

// --- Event name constants ---

// Hydra synth pillar
export const HYDRA_PRESET_EVAL_START = 'hydra_preset_eval_start'
export const HYDRA_PRESET_EVAL_SUCCESS = 'hydra_preset_eval_success'
export const HYDRA_PRESET_EVAL_ERROR = 'hydra_preset_eval_error'
export const HYDRA_FALLBACK_APPLIED = 'hydra_fallback_applied'
export const HYDRA_GUARD_BLOCKED = 'hydra_guard_blocked'

// Queue & library pillar
export const QUEUE_CMD_ACK = 'queue_cmd_ack'
export const QUEUE_CMD_ERROR = 'queue_cmd_error'

// Auth & session pillar
export const AUTH_SESSION_CHECK = 'auth_session_check'
export const AUTH_LOGIN_SUCCESS = 'auth_login_success'
export const AUTH_GUEST_JOIN_START = 'auth_guest_join_start'
export const AUTH_GUEST_JOIN_SUCCESS = 'auth_guest_join_success'
export const AUTH_GUEST_JOIN_FAILURE = 'auth_guest_join_failure'

// Socket lifecycle
export const SOCKET_CONNECT = 'socket_connect'
export const SOCKET_DISCONNECT = 'socket_disconnect'
export const SOCKET_RECONNECT = 'socket_reconnect'

// --- Types ---

export interface TelemetryEvent {
  /** Schema version for forward compatibility */
  v: number
  /** Event name from constants above */
  event: string
  /** Origin of the event */
  source: 'client' | 'server'
  /** ISO 8601 timestamp */
  timestamp: string
  /** Per-boot (server) or per-page-load (client) UUID */
  session_id: string
  /** Room context, if available */
  room_id?: number
  /** Hashed or numeric user identifier — never raw username */
  user_id?: number
  /** Additional primitive-only fields */
  [key: string]: string | number | boolean | null | undefined
}

// --- PII protection ---

/**
 * Keys that MUST NOT appear in telemetry events.
 * emit() strips these before logging.
 */
export const FORBIDDEN_KEYS = new Set([
  'token',
  'password',
  'secret',
  'email',
  'username',
  'name',
  'ip',
  'address',
  'cookie',
  'authorization',
  // Compound key variants (RT-3)
  'access_token',
  'auth_token',
  'api_key',
  'apikey',
  'user_email',
  'session_token',
  'refresh_token',
  'private_key',
  'client_secret',
])

/**
 * Patterns matched against string VALUES to redact PII that leaks
 * through fields like error messages. Matches:
 * - URLs (http:// or https://)
 * - JWT-like tokens (three dot-separated base64 segments)
 * - Bearer tokens
 */
const URL_PATTERN = /https?:\/\/[^\s"')]+/gi
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.\-/+=]+/gi

/**
 * Sanitize a string value by redacting URLs, JWTs, and bearer tokens.
 * Returns the sanitized string (non-strings pass through unchanged).
 */
export function sanitizeValue (value: unknown): unknown {
  if (typeof value !== 'string') return value
  let sanitized = value
  sanitized = sanitized.replace(URL_PATTERN, '[REDACTED_URL]')
  sanitized = sanitized.replace(JWT_PATTERN, '[REDACTED_TOKEN]')
  sanitized = sanitized.replace(BEARER_PATTERN, '[REDACTED_BEARER]')
  return sanitized
}

// --- Rate limiting ---

/**
 * Per-event minimum interval in milliseconds.
 * Rate limits are keyed by (event_name + session_id) so one noisy
 * session does not suppress events from other sessions.
 */
export const RATE_LIMITS: Record<string, number> = {
  [HYDRA_PRESET_EVAL_START]: 2000,
  [HYDRA_PRESET_EVAL_SUCCESS]: 2000,
  [HYDRA_PRESET_EVAL_ERROR]: 2000,
  [HYDRA_FALLBACK_APPLIED]: 2000,
  [SOCKET_RECONNECT]: 5000,
}

/**
 * Check whether an event should be emitted based on rate limits.
 * Mutates lastEmitTimes in place. Returns true if allowed.
 */
export function isRateLimited (
  event: string,
  sessionId: string,
  lastEmitTimes: Map<string, number>,
): boolean {
  const limit = RATE_LIMITS[event]
  if (!limit) return false

  const key = `${event}:${sessionId}`
  const now = Date.now()
  const last = lastEmitTimes.get(key) ?? 0

  if (now - last < limit) return true

  lastEmitTimes.set(key, now)
  return false
}

/**
 * Reserved envelope fields that MUST NOT be overridden by caller-supplied data.
 * sanitizeEvent strips these so the emit() caller cannot spoof identity/timestamps.
 */
const RESERVED_FIELDS = new Set(['v', 'event', 'source', 'timestamp', 'session_id'])

/** Maximum length for any single string field value in a telemetry event. */
const MAX_FIELD_VALUE_LENGTH = 2048

/**
 * Strip forbidden keys, reserved envelope fields, and sanitize string values
 * in an event payload. Returns a new object (never mutates input).
 */
export function sanitizeEvent (
  fields: Record<string, unknown>,
): Record<string, string | number | boolean | null | undefined> {
  const result: Record<string, string | number | boolean | null | undefined> = {}

  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue
    if (RESERVED_FIELDS.has(key)) continue

    // Only allow primitives — reject objects/arrays to prevent cyclic blowups
    if (value !== null && typeof value === 'object') continue

    const sanitized = sanitizeValue(value) as string | number | boolean | null | undefined
    // Truncate oversized strings to prevent log amplification (N-2)
    if (typeof sanitized === 'string' && sanitized.length > MAX_FIELD_VALUE_LENGTH) {
      result[key] = sanitized.slice(0, MAX_FIELD_VALUE_LENGTH) + '…[truncated]'
      continue
    }
    result[key] = sanitized
  }

  return result
}
