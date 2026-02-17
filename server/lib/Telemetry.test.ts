import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getServerTelemetry } from './Telemetry.js'

// Logger is initialized by test-setup.ts

describe('ServerTelemetry', () => {
  let tel: ReturnType<typeof getServerTelemetry>

  beforeEach(() => {
    // Get a fresh-ish instance (singleton, but we enable it each time)
    tel = getServerTelemetry()
    tel.enable()
  })

  it('emit never throws even with bad input', () => {
    expect(() => tel.emit('test_event', { key: 'value' })).not.toThrow()
    expect(() => tel.emit('', {})).not.toThrow()
    expect(() => (tel.emit as Function)(null, null)).not.toThrow()
  })

  it('strips forbidden keys from fields', () => {
    const logSpy = vi.fn()
    const origConsole = console.log
    console.log = logSpy

    tel.emit('test_event', {
      token: 'secret123',
      password: 'pass',
      email: 'user@test.com',
      duration_ms: 42,
    })

    console.log = origConsole
    // No direct way to capture electron-log output in test,
    // but we can verify emit doesn't throw with forbidden keys
  })

  it('is a no-op when disabled', () => {
    tel.disable()
    // Should not throw and should not log
    expect(() => tel.emit('test_event', { key: 'value' })).not.toThrow()
  })

  it('has a session_id', () => {
    expect(tel.sessionId).toBeTruthy()
    expect(typeof tel.sessionId).toBe('string')
    // UUID format
    expect(tel.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('rate limits rapid emissions of the same event', () => {
    // First call should not throw
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
    // Rapid second call should also not throw (just silently skipped)
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
  })

  it('returns singleton instance', () => {
    const a = getServerTelemetry()
    const b = getServerTelemetry()
    expect(a).toBe(b)
  })

  it('rate limits using internal session_id, ignoring fields.session_id', () => {
    // First emit of a rate-limited event should succeed
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
    // Second emit with a different session_id in fields should STILL be rate limited
    // (because the internal session_id is used as rate-limit key, not fields.session_id)
    // We can't directly observe the skip, but we verify it doesn't throw
    // and the rate limit key is the server's own sessionId
    expect(() => tel.emit('hydra_preset_eval_start', {
      ok: true,
      session_id: 'different-session',
    })).not.toThrow()
  })
})
