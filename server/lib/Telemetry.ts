import getLogger from './Log.js'
import {
  TELEMETRY_SCHEMA_VERSION,
  sanitizeEvent,
  isRateLimited,
} from '../../shared/telemetry.js'
import type { TelemetryEvent } from '../../shared/telemetry.js'

/**
 * Server-side telemetry singleton.
 *
 * GUARANTEES:
 * - emit() NEVER throws — all errors are swallowed internally
 * - emit() performs NO network or blocking async I/O — bounded local logging only
 *   (electron-log writes are buffered local file/console I/O)
 * - emit() NEVER logs PII — forbidden keys are stripped, string values are sanitized
 * - Only primitive fields (string, number, boolean, null) are accepted
 * - Rate-limited per (event_name + session_id) so one noisy session
 *   does not suppress other sessions' events
 */
class ServerTelemetry {
  #enabled: boolean
  #sessionId: string
  #lastEmitTimes = new Map<string, number>()

  constructor () {
    this.#enabled = process.env.TELEMETRY_ENABLED !== 'false'
    this.#sessionId = crypto.randomUUID()
  }

  get sessionId (): string {
    return this.#sessionId
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
      if (!this.#enabled) return

      if (isRateLimited(event, this.#sessionId, this.#lastEmitTimes)) return

      const sanitized = sanitizeEvent({ ...fields, event })
      const entry: TelemetryEvent = {
        ...sanitized,
        v: TELEMETRY_SCHEMA_VERSION,
        event,
        source: 'server',
        timestamp: new Date().toISOString(),
        session_id: this.#sessionId,
      }

      // Bounded local logging only — no network, no blocking async
      const log = getLogger('telemetry')
      log.info(JSON.stringify(entry))
    } catch {
      // Swallow all errors — telemetry must never disrupt the application
    }
  }

  /** Disable telemetry at runtime (for testing) */
  disable (): void {
    this.#enabled = false
  }

  /** Enable telemetry at runtime (for testing) */
  enable (): void {
    this.#enabled = true
  }
}

let instance: ServerTelemetry | null = null

/**
 * Lazy singleton — safe to call before Logger.init() as long as
 * emit() is only called after Logger is ready.
 */
export function getServerTelemetry (): ServerTelemetry {
  if (!instance) {
    instance = new ServerTelemetry()
  }
  return instance
}

export default getServerTelemetry
