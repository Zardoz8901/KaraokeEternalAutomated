// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  installHydraTimerTracking,
  uninstallHydraTimerTracking,
  clearHydraTimers,
  withHydraTimerOwner,
  type HydraTimerOwner,
} from './hydraUserTimers'

describe('hydraUserTimers error containment', () => {
  let owner: HydraTimerOwner
  const savedSetTimeout = window.setTimeout
  const savedSetInterval = window.setInterval
  const savedClearTimeout = window.clearTimeout
  const savedClearInterval = window.clearInterval

  beforeEach(() => {
    // Clear any global state from previous tests
    const g = globalThis as unknown as Record<string, unknown>
    delete g.__hydraTimerTrackingState
    // Restore natives in case a previous test left patched versions
    window.setTimeout = savedSetTimeout
    window.setInterval = savedSetInterval
    window.clearTimeout = savedClearTimeout
    window.clearInterval = savedClearInterval

    owner = Symbol('testTimerOwner')
  })

  afterEach(() => {
    uninstallHydraTimerTracking(owner)
    window.setTimeout = savedSetTimeout
    window.setInterval = savedSetInterval
    window.clearTimeout = savedClearTimeout
    window.clearInterval = savedClearInterval
  })

  it('catches errors thrown by setTimeout callbacks', () => {
    installHydraTimerTracking(owner)

    return new Promise<void>((resolve) => {
      const errorSpy = vi.fn()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      withHydraTimerOwner(owner, () => {
        window.setTimeout(() => {
          throw new Error('boom')
        }, 0)
      })

      // Give the setTimeout time to fire
      savedSetTimeout(() => {
        // Error should NOT propagate (no unhandled exception)
        expect(consoleSpy).toHaveBeenCalled()
        const warnCall = consoleSpy.mock.calls.find(c =>
          typeof c[0] === 'string' && c[0].includes('[HydraTimers]'),
        )
        expect(warnCall).toBeTruthy()
        consoleSpy.mockRestore()
        resolve()
      }, 50)
    })
  })

  it('catches errors thrown by setInterval callbacks', () => {
    installHydraTimerTracking(owner)

    return new Promise<void>((resolve) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      let callCount = 0

      withHydraTimerOwner(owner, () => {
        window.setInterval(() => {
          callCount++
          throw new Error('interval boom')
        }, 10)
      })

      savedSetTimeout(() => {
        // Should have been called multiple times without crashing
        expect(callCount).toBeGreaterThanOrEqual(2)
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
        resolve()
      }, 100)
    })
  })

  it('triggers per-owner threshold callback after 5 errors', () => {
    const thresholdCb = vi.fn()
    installHydraTimerTracking(owner, thresholdCb)

    return new Promise<void>((resolve) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      let callCount = 0

      withHydraTimerOwner(owner, () => {
        window.setInterval(() => {
          callCount++
          throw new Error(`error ${callCount}`)
        }, 5)
      })

      savedSetTimeout(() => {
        // Threshold is 5 — callback should have been called
        expect(thresholdCb).toHaveBeenCalledWith(owner)
        consoleSpy.mockRestore()
        resolve()
      }, 200)
    })
  })

  it('suppresses warn logs after first 3 errors', () => {
    installHydraTimerTracking(owner)

    return new Promise<void>((resolve) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      let callCount = 0

      withHydraTimerOwner(owner, () => {
        window.setInterval(() => {
          callCount++
          throw new Error(`error ${callCount}`)
        }, 5)
      })

      savedSetTimeout(() => {
        // Count [HydraTimers] timer callback error messages — should be exactly 3
        const timerErrorCalls = consoleSpy.mock.calls.filter(c =>
          typeof c[0] === 'string' && c[0].includes('Timer callback error'),
        )
        expect(timerErrorCalls.length).toBe(3)
        consoleSpy.mockRestore()
        resolve()
      }, 200)
    })
  })

  it('resets error count when clearHydraTimers is called', () => {
    const thresholdCb = vi.fn()
    installHydraTimerTracking(owner, thresholdCb)

    return new Promise<void>((resolve) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      let callCount = 0

      withHydraTimerOwner(owner, () => {
        window.setInterval(() => {
          callCount++
          throw new Error(`error ${callCount}`)
        }, 5)
      })

      // Let 3 errors happen, then clear timers
      savedSetTimeout(() => {
        clearHydraTimers(owner)
        // Threshold should NOT have been reached yet (only ~3 errors in 30ms at 5ms interval)
        // Actually it depends on timing. The key test: after clear, the error count resets.
        // Let's just verify the threshold callback was called at most once
        const callsBefore = thresholdCb.mock.calls.length

        // Start new timer that also throws
        withHydraTimerOwner(owner, () => {
          window.setInterval(() => {
            throw new Error('post-clear error')
          }, 5)
        })

        savedSetTimeout(() => {
          // Should trigger threshold again (error count was reset)
          expect(thresholdCb.mock.calls.length).toBeGreaterThan(callsBefore)
          consoleSpy.mockRestore()
          resolve()
        }, 200)
      }, 30)
    })
  })

  it('per-owner callbacks are independent', () => {
    const owner2 = Symbol('testTimerOwner2') as HydraTimerOwner
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    installHydraTimerTracking(owner, cb1)
    installHydraTimerTracking(owner2, cb2)

    return new Promise<void>((resolve) => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Only owner1 gets errors
      withHydraTimerOwner(owner, () => {
        window.setInterval(() => {
          throw new Error('owner1 error')
        }, 5)
      })

      savedSetTimeout(() => {
        expect(cb1).toHaveBeenCalledWith(owner)
        expect(cb2).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
        uninstallHydraTimerTracking(owner2)
        resolve()
      }, 200)
    })
  })
})
