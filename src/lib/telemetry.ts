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
 * - emit() performs NO blocking async I/O — bounded local logging + buffering
 * - emit() NEVER logs PII — forbidden keys are stripped, string values are sanitized
 * - Only primitive fields (string, number, boolean, null) are accepted;
 *   objects/arrays are silently dropped to prevent cyclic-object blowups
 * - Rate-limited per (event_name + session_id) so one noisy session
 *   does not suppress other sessions' events
 * - Buffered events flushed to server via POST /api/telemetry/ingest
 *   every 30s + on page unload via sendBeacon
 */

const MAX_BUFFER_SIZE = 100
const FLUSH_INTERVAL_MS = 30_000

class ClientTelemetry {
  private _enabled: boolean
  private _sessionId: string
  private _userId: number | null = null
  private _roomId: number | null = null
  private _browser: string
  private _platform: string
  private _lastEmitTimes = new Map<string, number>()
  private _buffer: TelemetryEvent[] = []
  private _flushUrl: string
  private _flushTimer: ReturnType<typeof setInterval> | null = null

  constructor () {
    // Kill switch: set window.__TELEMETRY_ENABLED = false from server config to disable
    const win = typeof window !== 'undefined' ? window as unknown as Record<string, unknown> : null
    this._enabled = win?.__TELEMETRY_ENABLED !== false
    this._sessionId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'ses_' + Math.random().toString(36).slice(2)
    this._browser = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'unknown'
    this._platform = typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown'

    // Derive flush URL from document.baseURI (handles KES_URL_PATH)
    this._flushUrl = typeof document !== 'undefined'
      ? document.baseURI.replace(/\/?$/, '/') + 'api/telemetry/ingest'
      : ''

    // Auto-flush on interval
    if (typeof window !== 'undefined' && this._enabled && this._flushUrl) {
      this._flushTimer = setInterval(() => { this.flush() }, FLUSH_INTERVAL_MS)

      // Flush on page unload via sendBeacon (best-effort)
      window.addEventListener('beforeunload', () => { this._flushBeacon() })
    }
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

      // Bounded local logging — no network, no blocking async
      // eslint-disable-next-line no-console
      console.info('[TEL]', JSON.stringify(entry))

      // Buffer for server flush
      if (this._buffer.length >= MAX_BUFFER_SIZE) {
        this._buffer.shift() // drop oldest on overflow
      }
      this._buffer.push(entry)
    } catch {
      // Swallow all errors — telemetry must never disrupt the application
    }
  }

  /**
   * Flush buffered events to server via POST. Swallows all errors.
   * Returns promise for callers that want to await (e.g., tests).
   */
  async flush (): Promise<void> {
    try {
      if (!this._buffer.length || !this._flushUrl) return

      const events = this._buffer.splice(0)

      await fetch(this._flushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ events }),
      })
    } catch {
      // Swallow all transport errors — telemetry must never disrupt the application
    }
  }

  /** Best-effort flush via sendBeacon on page unload */
  private _flushBeacon (): void {
    try {
      if (!this._buffer.length || !this._flushUrl) return
      if (typeof navigator === 'undefined' || !navigator.sendBeacon) return

      const events = this._buffer.splice(0)
      const blob = new Blob(
        [JSON.stringify({ events })],
        { type: 'application/json' },
      )

      navigator.sendBeacon(this._flushUrl, blob)
    } catch {
      // Swallow all errors
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
