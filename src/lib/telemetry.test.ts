import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import telemetry from './telemetry'

describe('ClientTelemetry', () => {
  beforeEach(() => {
    telemetry.enable()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emit never throws even with bad input', () => {
    expect(() => telemetry.emit('test_event', { key: 'value' })).not.toThrow()
    expect(() => telemetry.emit('', {})).not.toThrow()
    expect(() => (telemetry.emit as Function)(null, null)).not.toThrow()
  })

  it('outputs [TEL] prefixed JSON to console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    telemetry.emit('test_event', { duration_ms: 42 })

    expect(spy).toHaveBeenCalledTimes(1)
    const [prefix, json] = spy.mock.calls[0]
    expect(prefix).toBe('[TEL]')

    const parsed = JSON.parse(json)
    expect(parsed.v).toBe(1)
    expect(parsed.event).toBe('test_event')
    expect(parsed.source).toBe('client')
    expect(parsed.session_id).toBeTruthy()
    expect(parsed.duration_ms).toBe(42)
  })

  it('strips forbidden keys from emitted events', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    telemetry.emit('test_event', {
      token: 'secret123',
      password: 'pass',
      email: 'user@test.com',
      username: 'john',
      name: 'John Doe',
      duration_ms: 100,
    })

    const parsed = JSON.parse(spy.mock.calls[0][1])
    expect(parsed.duration_ms).toBe(100)
    expect(parsed).not.toHaveProperty('token')
    expect(parsed).not.toHaveProperty('password')
    expect(parsed).not.toHaveProperty('email')
    expect(parsed).not.toHaveProperty('username')
    expect(parsed).not.toHaveProperty('name')
  })

  it('sanitizes URLs and tokens in string values', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    telemetry.emit('test_event', {
      error: 'Failed to load https://evil.com/video.mp4 with token eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.dGVzdHNpZ25hdHVyZWhlcmU',
    })

    const parsed = JSON.parse(spy.mock.calls[0][1])
    expect(parsed.error).not.toContain('https://')
    expect(parsed.error).not.toContain('eyJ')
    expect(parsed.error).toContain('[REDACTED_URL]')
    expect(parsed.error).toContain('[REDACTED_TOKEN]')
  })

  it('is a no-op when disabled', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    telemetry.disable()
    telemetry.emit('test_event', { key: 'value' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('includes user context when set', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    telemetry.setUserContext(42, 7)
    telemetry.emit('test_event', {})

    const parsed = JSON.parse(spy.mock.calls[0][1])
    expect(parsed.user_id).toBe(42)
    expect(parsed.room_id).toBe(7)

    // Clean up
    telemetry.setUserContext(null, null)
  })

  it('has a session_id', () => {
    expect(telemetry.sessionId).toBeTruthy()
    expect(typeof telemetry.sessionId).toBe('string')
  })

  it('does not allow callers to override reserved fields via spread', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    telemetry.emit('real_event', {
      session_id: 'spoofed-session',
      event: 'spoofed_event',
      source: 'spoofed',
      timestamp: '1999-01-01T00:00:00Z',
      v: 999,
    })

    const parsed = JSON.parse(spy.mock.calls[0][1])
    expect(parsed.v).toBe(1)
    expect(parsed.event).toBe('real_event')
    expect(parsed.source).toBe('client')
    expect(parsed.session_id).toBe(telemetry.sessionId)
    expect(parsed.timestamp).not.toBe('1999-01-01T00:00:00Z')
  })
})

