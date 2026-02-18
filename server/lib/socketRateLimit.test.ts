import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createRateLimitState,
  checkRateLimit,
  SOCKET_RATE_LIMITS,
  type RateLimitState,
} from './socketRateLimit.js'
import {
  PLAYER_EMIT_FFT,
  PLAYER_EMIT_STATUS,
  VISUALIZER_HYDRA_CODE_REQ,
  CAMERA_OFFER_REQ,
  CAMERA_ICE_REQ,
} from '../../shared/actionTypes.js'

describe('socketRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('SOCKET_RATE_LIMITS config', () => {
    it('has rate limits for high-frequency actions', () => {
      expect(SOCKET_RATE_LIMITS[PLAYER_EMIT_FFT]).toBeDefined()
      expect(SOCKET_RATE_LIMITS[PLAYER_EMIT_FFT].rate).toBeGreaterThan(0)
      expect(SOCKET_RATE_LIMITS[PLAYER_EMIT_FFT].burst).toBeGreaterThan(0)
    })

    it('has rate limits for expensive actions', () => {
      expect(SOCKET_RATE_LIMITS[VISUALIZER_HYDRA_CODE_REQ]).toBeDefined()
      expect(SOCKET_RATE_LIMITS[VISUALIZER_HYDRA_CODE_REQ].rate).toBeLessThanOrEqual(5)
    })

    it('has rate limits for camera signaling actions', () => {
      expect(SOCKET_RATE_LIMITS[CAMERA_OFFER_REQ]).toBeDefined()
      expect(SOCKET_RATE_LIMITS[CAMERA_ICE_REQ]).toBeDefined()
      // ICE burst must be high enough for trickle candidates
      expect(SOCKET_RATE_LIMITS[CAMERA_ICE_REQ].burst).toBeGreaterThanOrEqual(30)
    })
  })

  describe('createRateLimitState', () => {
    it('returns an object with buckets map and dropCount/dropWindowStart', () => {
      const state = createRateLimitState()
      expect(state.buckets).toBeInstanceOf(Map)
      expect(state.dropCount).toBe(0)
      expect(state.dropWindowStart).toBe(0)
    })
  })

  describe('checkRateLimit', () => {
    let state: RateLimitState

    beforeEach(() => {
      state = createRateLimitState()
    })

    it('allows actions within burst capacity', () => {
      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Should allow up to burst count
      for (let i = 0; i < config.burst; i++) {
        const result = checkRateLimit(state, PLAYER_EMIT_STATUS)
        expect(result.allowed).toBe(true)
      }
    })

    it('rejects actions after burst capacity exhausted', () => {
      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Exhaust burst
      for (let i = 0; i < config.burst; i++) {
        checkRateLimit(state, PLAYER_EMIT_STATUS)
      }
      // Next should be rejected
      const result = checkRateLimit(state, PLAYER_EMIT_STATUS)
      expect(result.allowed).toBe(false)
    })

    it('refills tokens over time', () => {
      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Exhaust burst
      for (let i = 0; i < config.burst; i++) {
        checkRateLimit(state, PLAYER_EMIT_STATUS)
      }
      // Should be rejected
      expect(checkRateLimit(state, PLAYER_EMIT_STATUS).allowed).toBe(false)

      // Advance time by enough for 1 token refill (1/rate seconds)
      vi.advanceTimersByTime(Math.ceil(1000 / config.rate) + 1)

      // Should now allow at least one
      expect(checkRateLimit(state, PLAYER_EMIT_STATUS).allowed).toBe(true)
    })

    it('maintains independent buckets per action type', () => {
      const fftConfig = SOCKET_RATE_LIMITS[PLAYER_EMIT_FFT]
      const statusConfig = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]

      // Exhaust FFT burst
      for (let i = 0; i < fftConfig.burst; i++) {
        checkRateLimit(state, PLAYER_EMIT_FFT)
      }
      expect(checkRateLimit(state, PLAYER_EMIT_FFT).allowed).toBe(false)

      // Status should still be available (independent bucket)
      expect(checkRateLimit(state, PLAYER_EMIT_STATUS).allowed).toBe(true)
    })

    it('allows unlimited for unlisted action types', () => {
      // Action type not in SOCKET_RATE_LIMITS should always be allowed
      for (let i = 0; i < 1000; i++) {
        const result = checkRateLimit(state, 'some/UNLISTED_ACTION')
        expect(result.allowed).toBe(true)
      }
    })

    it('signals disconnect after sustained abuse threshold', () => {
      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Exhaust burst
      for (let i = 0; i < config.burst; i++) {
        checkRateLimit(state, PLAYER_EMIT_STATUS)
      }

      // Keep sending — accumulate drops
      let disconnectTriggered = false
      for (let i = 0; i < 60; i++) {
        const result = checkRateLimit(state, PLAYER_EMIT_STATUS)
        if (result.disconnect) {
          disconnectTriggered = true
          break
        }
      }
      expect(disconnectTriggered).toBe(true)
    })

    it('resets drop window after time passes', () => {
      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Exhaust burst
      for (let i = 0; i < config.burst; i++) {
        checkRateLimit(state, PLAYER_EMIT_STATUS)
      }

      // Accumulate some drops (but not enough to disconnect)
      for (let i = 0; i < 20; i++) {
        checkRateLimit(state, PLAYER_EMIT_STATUS)
      }
      expect(state.dropCount).toBeGreaterThan(0)

      // Advance past the drop window
      vi.advanceTimersByTime(11_000)

      // Refill should reset drop tracking on next allowed check
      const result = checkRateLimit(state, PLAYER_EMIT_STATUS)
      expect(result.allowed).toBe(true)
      expect(state.dropCount).toBe(0)
    })

    it('does not refill tokens beyond burst cap', () => {
      // Let a lot of time pass without any messages
      vi.advanceTimersByTime(60_000)

      const config = SOCKET_RATE_LIMITS[PLAYER_EMIT_STATUS]
      // Should allow exactly burst, not more
      for (let i = 0; i < config.burst; i++) {
        expect(checkRateLimit(state, PLAYER_EMIT_STATUS).allowed).toBe(true)
      }
      expect(checkRateLimit(state, PLAYER_EMIT_STATUS).allowed).toBe(false)
    })

    it('handles high-frequency FFT within legitimate range', () => {
      // Simulate 60Hz FFT over 3 seconds (180 messages)
      const messagesPerSecond = 60
      const durationSeconds = 3

      let blocked = 0
      for (let sec = 0; sec < durationSeconds; sec++) {
        for (let i = 0; i < messagesPerSecond; i++) {
          const result = checkRateLimit(state, PLAYER_EMIT_FFT)
          if (!result.allowed) blocked++
        }
        vi.advanceTimersByTime(1000)
      }

      // With rate=120 and burst=180, 60Hz should never be blocked
      expect(blocked).toBe(0)
    })
  })
})
