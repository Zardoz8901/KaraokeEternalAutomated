import {
  TELEMETRY_SCHEMA_VERSION,
  sanitizeEvent,
  isRateLimited,
} from 'shared/telemetry'
import type { TelemetryEvent } from 'shared/telemetry'

/**
 * Client-side telemetry singleton.
 *
 * GUARANTEES:
 * - emit() NEVER throws — all errors are swallowed internally
 * - emit() performs NO network or blocking async I/O — bounded local logging only
 *   (console.info is synchronous buffered local I/O)
 * - emit() NEVER logs PII — forbidden keys are stripped, string values are sanitized
 *   (URLs, JWTs, and bearer tokens in error messages are redacted)
 * - Only primitive fields (string, number, boolean, null) are accepted;
 *   objects/arrays are silently dropped to prevent cyclic-object blowups
 * - Rate-limited per (event_name + session_id) so one noisy session
 *   does not suppress other sessions' events
 */

class ClientTelemetry {
  private _enabled: boolean
  private _sessionId: string
  private _userId: number | null = null
  private _roomId: number | null = null
  private _browser: string
  private _platform: string
  private _lastEmitTimes = new Map<string, number>()

  constructor () {
    // Kill switch: set window.__TELEMETRY_ENABLED = false from server config to disable
    const win = typeof window !== 'undefined' ? window as unknown as Record<string, unknown> : null
    this._enabled = win?.__TELEMETRY_ENABLED !== false
    this._sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'ses_' + Math.random().toString(36).slice(2)
    this._browser = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'unknown'
    this._platform = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown'
  }

  get sessionId (): string {
    return this._sessionId
  }

  /** Update user context for all subsequent events */
  setUserContext (userId: number | null, roomId: number | null): void {
    this._userId = userId
    this._roomId = roomId
  }

  /**
   * Emit a telemetry event. Never throws, never blocks.
   * Only accepts primitive field values (string, number, boolean, null).
   */
  emit (
    event: string,
    fields: Record<string, string | number | boolean | null | undefined> = {},
  ): void {
    try {
      if (!this._enabled) return

      if (isRateLimited(event, this._sessionId, this._lastEmitTimes)) return

      const sanitized = sanitizeEvent({ ...fields, event })
      const entry: TelemetryEvent = {
        ...sanitized,
        v: TELEMETRY_SCHEMA_VERSION,
        event,
        source: 'client',
        timestamp: new Date().toISOString(),
        session_id: this._sessionId,
        user_id: this._userId !== null ? this._userId : undefined,
        room_id: this._roomId !== null ? this._roomId : undefined,
        browser: this._browser,
        platform: this._platform,
      }

      // Bounded local logging only — no network, no blocking async
      // eslint-disable-next-line no-console
      console.info('[TEL]', JSON.stringify(entry))
    } catch {
      // Swallow all errors — telemetry must never disrupt the application
    }
  }

  /** Disable telemetry at runtime (for testing) */
  disable (): void {
    this._enabled = false
  }

  /** Enable telemetry at runtime (for testing) */
  enable (): void {
    this._enabled = true
  }
}

const telemetry = new ClientTelemetry()
export default telemetry
