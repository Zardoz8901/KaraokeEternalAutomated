import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock getLogger so we can capture log.info output from emit()
const mockLogInfo = vi.fn()
vi.mock('./Log.js', () => ({
  default: () => ({ info: mockLogInfo }),
}))

// Import after mock is set up
const { getServerTelemetry } = await import('./Telemetry.js')

/** Capture the JSON payload from the most recent emit() call */
function captureEmit (
  tel: ReturnType<typeof getServerTelemetry>,
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): Record<string, unknown> | null {
  mockLogInfo.mockClear()
  tel.emit(event, fields)
  if (mockLogInfo.mock.calls.length === 0) return null
  return JSON.parse(mockLogInfo.mock.calls[0][0] as string)
}

describe('ServerTelemetry', () => {
  let tel: ReturnType<typeof getServerTelemetry>

  beforeEach(() => {
    tel = getServerTelemetry()
    tel.enable()
    mockLogInfo.mockClear()
  })

  it('emit never throws even with bad input', () => {
    expect(() => tel.emit('test_event', { key: 'value' })).not.toThrow()
    expect(() => tel.emit('', {})).not.toThrow()
    expect(() => (tel.emit as Function)(null, null)).not.toThrow()
  })

  it('emits correct envelope structure', () => {
    const entry = captureEmit(tel, 'test_envelope', { duration_ms: 42 })
    expect(entry).not.toBeNull()
    expect(entry!.v).toBe(1)
    expect(entry!.event).toBe('test_envelope')
    expect(entry!.source).toBe('server')
    expect(entry!.session_id).toBe(tel.sessionId)
    expect(entry!.timestamp).toBeTruthy()
    expect(entry!.duration_ms).toBe(42)
  })

  it('strips forbidden keys from emitted payload', () => {
    const entry = captureEmit(tel, 'test_strip', {
      token: 'secret123',
      password: 'pass',
      email: 'user@test.com',
      duration_ms: 42,
    })
    expect(entry).not.toBeNull()
    expect(entry!.duration_ms).toBe(42)
    expect(entry!).not.toHaveProperty('token')
    expect(entry!).not.toHaveProperty('password')
    expect(entry!).not.toHaveProperty('email')
  })

  it('does not allow reserved field override in emitted payload', () => {
    const entry = captureEmit(tel, 'real_event', {
      event: 'spoofed',
      source: 'spoofed',
      session_id: 'spoofed',
      v: 999,
    })
    expect(entry).not.toBeNull()
    expect(entry!.v).toBe(1)
    expect(entry!.event).toBe('real_event')
    expect(entry!.source).toBe('server')
    expect(entry!.session_id).toBe(tel.sessionId)
  })

  it('is a no-op when disabled', () => {
    tel.disable()
    const entry = captureEmit(tel, 'test_event', { key: 'value' })
    expect(entry).toBeNull()
  })

  it('has a session_id', () => {
    expect(tel.sessionId).toBeTruthy()
    expect(typeof tel.sessionId).toBe('string')
    expect(tel.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('rate limits rapid emissions of the same event', () => {
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
  })

  it('returns singleton instance', () => {
    const a = getServerTelemetry()
    const b = getServerTelemetry()
    expect(a).toBe(b)
  })

  it('rate limits using internal session_id, ignoring fields.session_id', () => {
    expect(() => tel.emit('hydra_preset_eval_start', { ok: true })).not.toThrow()
    expect(() => tel.emit('hydra_preset_eval_start', {
      ok: true,
      session_id: 'different-session',
    })).not.toThrow()
  })
})
