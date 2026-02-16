type TimerId = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>

export type HydraTimerOwner = symbol

const TIMER_ERROR_THRESHOLD = 5

type TimerTrackingState = {
  patched: boolean
  owners: Set<HydraTimerOwner>
  currentOwner: HydraTimerOwner | null
  timersByOwner: Map<HydraTimerOwner, Set<TimerId>>
  ownerByTimerId: Map<TimerId, HydraTimerOwner>
  errorCountByOwner: Map<HydraTimerOwner, number>
  onTimerErrorThresholdByOwner: Map<HydraTimerOwner, (owner: HydraTimerOwner) => void>

  nativeSetTimeout: typeof window.setTimeout
  nativeSetInterval: typeof window.setInterval
  nativeClearTimeout: typeof window.clearTimeout
  nativeClearInterval: typeof window.clearInterval

  patchedSetTimeout?: typeof window.setTimeout
  patchedSetInterval?: typeof window.setInterval
  patchedClearTimeout?: typeof window.clearTimeout
  patchedClearInterval?: typeof window.clearInterval
}

function getState (): TimerTrackingState | null {
  if (typeof window === 'undefined') return null

  const g = globalThis as unknown as Record<string, unknown>
  const existing = g.__hydraTimerTrackingState as TimerTrackingState | undefined
  if (existing) return existing

  const state: TimerTrackingState = {
    patched: false,
    owners: new Set(),
    currentOwner: null,
    timersByOwner: new Map(),
    ownerByTimerId: new Map(),
    errorCountByOwner: new Map(),
    onTimerErrorThresholdByOwner: new Map(),
    nativeSetTimeout: window.setTimeout.bind(window),
    nativeSetInterval: window.setInterval.bind(window),
    nativeClearTimeout: window.clearTimeout.bind(window),
    nativeClearInterval: window.clearInterval.bind(window),
  }
  g.__hydraTimerTrackingState = state
  return state
}

export function withHydraTimerOwner<T> (owner: HydraTimerOwner, fn: () => T): T {
  const state = getState()
  if (!state || !state.patched) return fn()

  const prev = state.currentOwner
  state.currentOwner = owner
  try {
    return fn()
  } finally {
    state.currentOwner = prev
  }
}

function trackTimer (state: TimerTrackingState, owner: HydraTimerOwner, id: TimerId) {
  let set = state.timersByOwner.get(owner)
  if (!set) {
    set = new Set()
    state.timersByOwner.set(owner, set)
  }
  set.add(id)
  state.ownerByTimerId.set(id, owner)
}

function untrackTimer (state: TimerTrackingState, id: TimerId) {
  const owner = state.ownerByTimerId.get(id)
  if (owner) {
    const set = state.timersByOwner.get(owner)
    set?.delete(id)
  } else {
    // Fallback: scan (rare; handles IDs created before ownerByTimerId existed).
    for (const set of state.timersByOwner.values()) {
      set.delete(id)
    }
  }
  state.ownerByTimerId.delete(id)
}

function handleTimerError (state: TimerTrackingState, activeOwner: HydraTimerOwner, err: unknown) {
  const count = (state.errorCountByOwner.get(activeOwner) ?? 0) + 1
  state.errorCountByOwner.set(activeOwner, count)
  if (count <= 3) {
    console.warn('[HydraTimers] Timer callback error:', err)
  }
  if (count === TIMER_ERROR_THRESHOLD) {
    console.warn('[HydraTimers] Error threshold reached, clearing owner timers')
    clearHydraTimers(activeOwner)
    const cb = state.onTimerErrorThresholdByOwner.get(activeOwner)
    cb?.(activeOwner)
  }
}

export function clearHydraTimers (owner: HydraTimerOwner): void {
  const state = getState()
  if (!state) return

  const ids = state.timersByOwner.get(owner)
  if (!ids || ids.size === 0) {
    state.errorCountByOwner.delete(owner)
    return
  }

  for (const id of ids) {
    state.nativeClearTimeout(id as unknown as Parameters<typeof clearTimeout>[0])
    state.nativeClearInterval(id as unknown as Parameters<typeof clearInterval>[0])
    state.ownerByTimerId.delete(id)
  }
  ids.clear()
  state.errorCountByOwner.delete(owner)
}

export function installHydraTimerTracking (
  owner: HydraTimerOwner,
  onErrorThreshold?: (owner: HydraTimerOwner) => void,
): void {
  const state = getState()
  if (!state) return

  state.owners.add(owner)
  if (!state.timersByOwner.has(owner)) state.timersByOwner.set(owner, new Set())
  if (onErrorThreshold) {
    state.onTimerErrorThresholdByOwner.set(owner, onErrorThreshold)
  }

  if (state.patched) return

  const patchedSetTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const activeOwner = state.currentOwner
    if (!activeOwner) {
      return state.nativeSetTimeout(handler, timeout, ...(args as [])) as unknown as TimerId
    }

    const wrappedHandler: TimerHandler = (typeof handler === 'function')
      ? ((...cbArgs: unknown[]) => {
          try {
            withHydraTimerOwner(activeOwner, () => (handler as (...a: unknown[]) => void)(...cbArgs))
          } catch (err) {
            handleTimerError(state, activeOwner, err)
          }
        })
      : handler

    const id = state.nativeSetTimeout(wrappedHandler, timeout, ...(args as [])) as unknown as TimerId
    trackTimer(state, activeOwner, id)
    return id
  }) as unknown as typeof window.setTimeout

  const patchedSetInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const activeOwner = state.currentOwner
    if (!activeOwner) {
      return state.nativeSetInterval(handler, timeout, ...(args as [])) as unknown as TimerId
    }

    const wrappedHandler: TimerHandler = (typeof handler === 'function')
      ? ((...cbArgs: unknown[]) => {
          try {
            withHydraTimerOwner(activeOwner, () => (handler as (...a: unknown[]) => void)(...cbArgs))
          } catch (err) {
            handleTimerError(state, activeOwner, err)
          }
        })
      : handler

    const id = state.nativeSetInterval(wrappedHandler, timeout, ...(args as [])) as unknown as TimerId
    trackTimer(state, activeOwner, id)
    return id
  }) as unknown as typeof window.setInterval

  const patchedClearTimeout = ((id?: TimerId) => {
    state.nativeClearTimeout(id as unknown as Parameters<typeof clearTimeout>[0])
    if (id !== undefined && id !== null) untrackTimer(state, id)
  }) as unknown as typeof window.clearTimeout

  const patchedClearInterval = ((id?: TimerId) => {
    state.nativeClearInterval(id as unknown as Parameters<typeof clearInterval>[0])
    if (id !== undefined && id !== null) untrackTimer(state, id)
  }) as unknown as typeof window.clearInterval

  state.patchedSetTimeout = patchedSetTimeout
  state.patchedSetInterval = patchedSetInterval
  state.patchedClearTimeout = patchedClearTimeout
  state.patchedClearInterval = patchedClearInterval

  window.setTimeout = patchedSetTimeout
  window.setInterval = patchedSetInterval
  window.clearTimeout = patchedClearTimeout
  window.clearInterval = patchedClearInterval

  state.patched = true
}

export function uninstallHydraTimerTracking (owner: HydraTimerOwner): void {
  const state = getState()
  if (!state) return

  clearHydraTimers(owner)
  state.timersByOwner.delete(owner)
  state.owners.delete(owner)
  state.onTimerErrorThresholdByOwner.delete(owner)

  if (state.owners.size > 0) return
  if (!state.patched) return

  // Only restore if we're still the active patch.
  if (state.patchedSetTimeout && window.setTimeout === state.patchedSetTimeout) {
    window.setTimeout = state.nativeSetTimeout
  }
  if (state.patchedSetInterval && window.setInterval === state.patchedSetInterval) {
    window.setInterval = state.nativeSetInterval
  }
  if (state.patchedClearTimeout && window.clearTimeout === state.patchedClearTimeout) {
    window.clearTimeout = state.nativeClearTimeout
  }
  if (state.patchedClearInterval && window.clearInterval === state.patchedClearInterval) {
    window.clearInterval = state.nativeClearInterval
  }

  state.patched = false
  state.currentOwner = null
  state.timersByOwner.clear()
  state.ownerByTimerId.clear()
  state.errorCountByOwner.clear()
  state.onTimerErrorThresholdByOwner.clear()
  state.patchedSetTimeout = undefined
  state.patchedSetInterval = undefined
  state.patchedClearTimeout = undefined
  state.patchedClearInterval = undefined
}
