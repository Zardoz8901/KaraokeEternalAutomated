/**
 * Per-socket token bucket rate limiter for socket action handlers.
 * Each socket gets its own RateLimitState (attached to the socket object).
 * State auto-GCs when the socket disconnects — no cleanup needed.
 *
 * Security: KI-4 (no server-side rate limiting on socket actions)
 */

import {
  PLAYER_EMIT_FFT,
  PLAYER_EMIT_STATUS,
  VISUALIZER_HYDRA_CODE_REQ,
  VISUALIZER_STATE_SYNC_REQ,
  CAMERA_OFFER_REQ,
  CAMERA_ANSWER_REQ,
  CAMERA_ICE_REQ,
  CAMERA_STOP_REQ,
  QUEUE_ADD,
  QUEUE_MOVE,
  QUEUE_REMOVE,
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  STAR_SONG,
  UNSTAR_SONG,
} from '../../shared/actionTypes.js'

// --- Types ---

interface BucketConfig {
  /** Tokens refilled per second */
  rate: number
  /** Maximum tokens (initial + max accumulation) */
  burst: number
}

interface Bucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitState {
  buckets: Map<string, Bucket>
  dropCount: number
  dropWindowStart: number
}

export interface RateLimitResult {
  allowed: boolean
  disconnect: boolean
}

// --- Config ---

/** Disconnect threshold: max drops within the drop window before forced disconnect */
const DROP_DISCONNECT_THRESHOLD = 50
/** Drop window duration in ms (drops older than this are forgiven) */
const DROP_WINDOW_MS = 10_000

/**
 * Per-action rate limit config. Keys are action type string values
 * (imported from shared/actionTypes.ts so they match runtime action.type).
 * Actions not listed here are unlimited.
 */
export const SOCKET_RATE_LIMITS: Record<string, BucketConfig> = {
  // High-frequency: player FFT at 30-60Hz
  [PLAYER_EMIT_FFT]: { rate: 120, burst: 180 },
  // Player status: ~1/sec normal
  [PLAYER_EMIT_STATUS]: { rate: 5, burst: 10 },
  // Expensive broadcasts
  [VISUALIZER_HYDRA_CODE_REQ]: { rate: 2, burst: 5 },
  [VISUALIZER_STATE_SYNC_REQ]: { rate: 2, burst: 5 },
  // Camera signaling
  [CAMERA_OFFER_REQ]: { rate: 5, burst: 10 },
  [CAMERA_ANSWER_REQ]: { rate: 5, burst: 10 },
  [CAMERA_ICE_REQ]: { rate: 30, burst: 50 },
  [CAMERA_STOP_REQ]: { rate: 5, burst: 10 },
  // Queue operations
  [QUEUE_ADD]: { rate: 5, burst: 10 },
  [QUEUE_MOVE]: { rate: 5, burst: 10 },
  [QUEUE_REMOVE]: { rate: 5, burst: 10 },
  // Player commands
  [PLAYER_REQ_NEXT]: { rate: 3, burst: 5 },
  [PLAYER_REQ_OPTIONS]: { rate: 3, burst: 5 },
  [PLAYER_REQ_PAUSE]: { rate: 3, burst: 5 },
  [PLAYER_REQ_PLAY]: { rate: 3, burst: 5 },
  [PLAYER_REQ_REPLAY]: { rate: 3, burst: 5 },
  [PLAYER_REQ_VOLUME]: { rate: 3, burst: 5 },
  // Star actions
  [STAR_SONG]: { rate: 5, burst: 10 },
  [UNSTAR_SONG]: { rate: 5, burst: 10 },
}

// --- Functions ---

export function createRateLimitState (): RateLimitState {
  return {
    buckets: new Map(),
    dropCount: 0,
    dropWindowStart: 0,
  }
}

/**
 * Check whether an action should be allowed based on the socket's rate limit state.
 * Mutates state in place. Pure synchronous — no I/O.
 *
 * Returns { allowed, disconnect }:
 * - allowed=true: action proceeds normally
 * - allowed=false, disconnect=false: action silently dropped
 * - allowed=false, disconnect=true: caller should disconnect the socket
 */
export function checkRateLimit (state: RateLimitState, actionType: string): RateLimitResult {
  const config = SOCKET_RATE_LIMITS[actionType]
  if (!config) {
    return { allowed: true, disconnect: false }
  }

  const now = Date.now()

  // Get or create bucket for this action type
  let bucket = state.buckets.get(actionType)
  if (!bucket) {
    bucket = { tokens: config.burst, lastRefill: now }
    state.buckets.set(actionType, bucket)
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill
  if (elapsed > 0) {
    const refill = (elapsed / 1000) * config.rate
    bucket.tokens = Math.min(config.burst, bucket.tokens + refill)
    bucket.lastRefill = now
  }

  // Try to consume a token
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1

    // Successful action: if we're past the drop window, reset drop tracking
    if (state.dropCount > 0 && now - state.dropWindowStart > DROP_WINDOW_MS) {
      state.dropCount = 0
      state.dropWindowStart = 0
    }

    return { allowed: true, disconnect: false }
  }

  // Token not available — action dropped
  if (state.dropCount === 0) {
    state.dropWindowStart = now
  }
  state.dropCount++

  // Check disconnect threshold
  const inWindow = now - state.dropWindowStart <= DROP_WINDOW_MS
  if (inWindow && state.dropCount >= DROP_DISCONNECT_THRESHOLD) {
    return { allowed: false, disconnect: true }
  }

  // Reset window if we've drifted past it
  if (!inWindow) {
    state.dropCount = 1
    state.dropWindowStart = now
  }

  return { allowed: false, disconnect: false }
}
