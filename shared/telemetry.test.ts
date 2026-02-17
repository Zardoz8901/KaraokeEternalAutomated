import { describe, it, expect, beforeEach } from 'vitest'
import {
  TELEMETRY_SCHEMA_VERSION,
  FORBIDDEN_KEYS,
  sanitizeValue,
  sanitizeEvent,
  isRateLimited,
  RATE_LIMITS,
  HYDRA_PRESET_EVAL_START,
  SOCKET_RECONNECT,
} from './telemetry.js'

describe('telemetry schema', () => {
  it('exports schema version 1', () => {
    expect(TELEMETRY_SCHEMA_VERSION).toBe(1)
  })

  it('exports event name constants', () => {
    expect(HYDRA_PRESET_EVAL_START).toBe('hydra_preset_eval_start')
    expect(SOCKET_RECONNECT).toBe('socket_reconnect')
  })
})

describe('FORBIDDEN_KEYS', () => {
  it('contains all required PII keys', () => {
    const required = ['token', 'password', 'secret', 'email', 'username', 'name', 'ip', 'address', 'cookie', 'authorization']
    for (const key of required) {
      expect(FORBIDDEN_KEYS.has(key)).toBe(true)
    }
  })

  it('contains compound PII key variants', () => {
    const compound = [
      'access_token', 'auth_token', 'api_key', 'apikey',
      'user_email', 'session_token', 'refresh_token',
      'private_key', 'client_secret',
    ]
    for (const key of compound) {
      expect(FORBIDDEN_KEYS.has(key), `Expected FORBIDDEN_KEYS to contain "${key}"`).toBe(true)
    }
  })
})

describe('sanitizeValue', () => {
  it('passes through non-string values unchanged', () => {
    expect(sanitizeValue(42)).toBe(42)
    expect(sanitizeValue(true)).toBe(true)
    expect(sanitizeValue(null)).toBeNull()
  })

  it('redacts URLs in strings', () => {
    const input = 'Failed to load https://example.com/video.mp4'
    const result = sanitizeValue(input)
    expect(result).toBe('Failed to load [REDACTED_URL]')
    expect(result).not.toContain('https://')
  })

  it('redacts http URLs', () => {
    const input = 'Error at http://localhost:3000/api/secret'
    const result = sanitizeValue(input)
    expect(result).not.toContain('http://')
  })

  it('redacts JWT-like tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.dGVzdHNpZ25hdHVyZWhlcmU'
    const input = `Token was ${jwt} in the payload`
    const result = sanitizeValue(input)
    expect(result).not.toContain('eyJ')
    expect(result).toContain('[REDACTED_TOKEN]')
  })

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer abc123def456'
    const result = sanitizeValue(input)
    expect(result).not.toContain('abc123def456')
    expect(result).toContain('[REDACTED_BEARER]')
  })

  it('handles strings with no sensitive content', () => {
    expect(sanitizeValue('normal error message')).toBe('normal error message')
  })

  it('handles empty string', () => {
    expect(sanitizeValue('')).toBe('')
  })
})

describe('sanitizeEvent', () => {
  it('strips forbidden keys (case-insensitive)', () => {
    const input = {
      token: 'secret123',
      password: 'pass',
      email: 'user@example.com',
      username: 'john',
      name: 'John Doe',
      duration_ms: 100,
    }
    const result = sanitizeEvent(input)
    expect(result.duration_ms).toBe(100)
    expect(result).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('password')
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('username')
    expect(result).not.toHaveProperty('name')
  })

  it('rejects object/array values to prevent cyclic blowups', () => {
    const input = {
      event: 'test',
      nested: { foo: 'bar' },
      list: [1, 2, 3],
      ok: 'string',
    }
    const result = sanitizeEvent(input)
    expect(result).not.toHaveProperty('nested')
    expect(result).not.toHaveProperty('list')
    expect(result.ok).toBe('string')
  })

  it('sanitizes string values for URLs/tokens', () => {
    const input = {
      error: 'Failed at https://evil.com/steal?token=abc',
      code: 42,
    }
    const result = sanitizeEvent(input)
    expect(result.error).not.toContain('https://')
    expect(result.code).toBe(42)
  })

  it('truncates string values exceeding 2048 characters', () => {
    const longValue = 'x'.repeat(10_000)
    const result = sanitizeEvent({ long_field: longValue })
    const truncated = result.long_field as string
    expect(truncated.length).toBeLessThanOrEqual(2048 + 12) // 2048 + '…[truncated]'
    expect(truncated).toContain('…[truncated]')
    expect(truncated.startsWith('x'.repeat(100))).toBe(true)
  })

  it('does not truncate strings at or below 2048 characters', () => {
    const exactValue = 'y'.repeat(2048)
    const result = sanitizeEvent({ exact_field: exactValue })
    expect(result.exact_field).toBe(exactValue)
  })

  it('preserves null and undefined values', () => {
    const input: Record<string, unknown> = {
      a: null,
      b: undefined,
      c: 'ok',
    }
    const result = sanitizeEvent(input)
    expect(result.a).toBeNull()
    expect(result.b).toBeUndefined()
    expect(result.c).toBe('ok')
  })

  it('does not mutate input', () => {
    const input = { token: 'secret', safe: 'yes' }
    const copy = { ...input }
    sanitizeEvent(input)
    expect(input).toEqual(copy)
  })

  it('strips compound PII key variants', () => {
    const input = {
      access_token: 'tok123',
      auth_token: 'atok',
      api_key: 'key123',
      apikey: 'key456',
      user_email: 'a@b.com',
      session_token: 'stok',
      refresh_token: 'rtok',
      private_key: 'pk',
      client_secret: 'cs',
      duration_ms: 42,
    }
    const result = sanitizeEvent(input)
    expect(result.duration_ms).toBe(42)
    expect(result).not.toHaveProperty('access_token')
    expect(result).not.toHaveProperty('auth_token')
    expect(result).not.toHaveProperty('api_key')
    expect(result).not.toHaveProperty('apikey')
    expect(result).not.toHaveProperty('user_email')
    expect(result).not.toHaveProperty('session_token')
    expect(result).not.toHaveProperty('refresh_token')
    expect(result).not.toHaveProperty('private_key')
    expect(result).not.toHaveProperty('client_secret')
  })

  it('strips reserved telemetry fields that could override envelope', () => {
    const input = {
      v: 999,
      event: 'spoofed_event',
      source: 'spoofed',
      timestamp: '1999-01-01T00:00:00Z',
      session_id: 'spoofed-session',
      duration_ms: 42,
    }
    const result = sanitizeEvent(input)
    expect(result).not.toHaveProperty('v')
    expect(result).not.toHaveProperty('event')
    expect(result).not.toHaveProperty('source')
    expect(result).not.toHaveProperty('timestamp')
    expect(result).not.toHaveProperty('session_id')
    expect(result.duration_ms).toBe(42)
  })
})

describe('isRateLimited', () => {
  let lastEmitTimes: Map<string, number>

  beforeEach(() => {
    lastEmitTimes = new Map()
  })

  it('allows first emit of any event', () => {
    expect(isRateLimited(HYDRA_PRESET_EVAL_START, 'session-1', lastEmitTimes)).toBe(false)
  })

  it('blocks rapid re-emit of rate-limited event for same session', () => {
    // First call records the timestamp
    isRateLimited(HYDRA_PRESET_EVAL_START, 'session-1', lastEmitTimes)
    // Immediate second call should be rate-limited
    expect(isRateLimited(HYDRA_PRESET_EVAL_START, 'session-1', lastEmitTimes)).toBe(true)
  })

  it('does not rate limit events without a configured limit', () => {
    expect(isRateLimited('some_unlisted_event', 'session-1', lastEmitTimes)).toBe(false)
    expect(isRateLimited('some_unlisted_event', 'session-1', lastEmitTimes)).toBe(false)
  })

  it('rate limits are per-session — different sessions are independent', () => {
    isRateLimited(HYDRA_PRESET_EVAL_START, 'session-1', lastEmitTimes)
    // Different session should NOT be rate limited
    expect(isRateLimited(HYDRA_PRESET_EVAL_START, 'session-2', lastEmitTimes)).toBe(false)
  })

  it('uses correct rate limit thresholds from config', () => {
    expect(RATE_LIMITS[HYDRA_PRESET_EVAL_START]).toBe(2000)
    expect(RATE_LIMITS[SOCKET_RECONNECT]).toBe(5000)
  })
})
