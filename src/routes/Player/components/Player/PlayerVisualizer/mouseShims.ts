/**
 * Legacy mouse globals used by gallery sketches (vMouseX, mouseX, etc.).
 * Hydra's built-in mouse.x/y returns pageX/pageY pixel coordinates.
 *
 * Creates callable function objects with valueOf() + [Symbol.toPrimitive]()
 * so both patterns work:
 *   vMouseX()      → calls the function, returns number
 *   vMouseX + 0.1  → JS coerces via [Symbol.toPrimitive]('number'), returns number
 *
 * The getter returns a cached function per shim name. The no-op setter
 * silently ignores assignments (prevents strict-mode throws).
 */

type MouseShimFn = {
  (): number
  valueOf: () => number
  [Symbol.toPrimitive]: (hint: string) => number | string
}

const shimCache = new Map<string, MouseShimFn>()

// EMA smoothing state for vMouseXSmooth / vMouseYSmooth
const smoothState = { x: 0, y: 0 }

function createMouseShim (axis: 'x' | 'y'): MouseShimFn {
  const getValue = (): number => {
    const m = (window as unknown as Record<string, unknown>).mouse as
      { x?: number, y?: number } | undefined
    return m?.[axis] ?? 0
  }

  const shim = function mouseShim () { return getValue() } as MouseShimFn
  shim.valueOf = getValue
  shim[Symbol.toPrimitive] = (hint: string) => {
    const v = getValue()
    return hint === 'string' ? String(v) : v
  }
  return shim
}

const SHIM_DEFS: Array<[string, 'x' | 'y']> = [
  ['vMouseX', 'x'], ['mouseX', 'x'],
  ['vMouseY', 'y'], ['mouseY', 'y'],
]

interface HydraProps {
  resolution?: [number, number]
}

function getMouseVal (axis: 'x' | 'y'): number {
  const m = (window as unknown as Record<string, unknown>).mouse as
    { x?: number, y?: number } | undefined
  return m?.[axis] ?? 0
}

function createNormalizedShim (axis: 'x' | 'y'): (arg?: unknown) => number {
  return function normalizedShim (arg?: unknown): number {
    const raw = getMouseVal(axis)
    if (raw === 0) return 0

    // If called with Hydra props containing resolution, use that
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      const props = arg as HydraProps
      if (props.resolution) {
        const divisor = axis === 'x' ? props.resolution[0] : props.resolution[1]
        return divisor ? raw / divisor : 0
      }
    }

    // Fall back to window dimensions
    const divisor = axis === 'x' ? window.innerWidth : window.innerHeight
    return divisor ? raw / divisor : 0
  }
}

function createSmoothedShim (axis: 'x' | 'y'): (factor?: unknown) => number {
  return function smoothedShim (factor?: unknown): number {
    const raw = getMouseVal(axis)
    const divisor = axis === 'x' ? window.innerWidth : window.innerHeight
    const normalized = divisor ? raw / divisor : 0

    const f = typeof factor === 'number' && factor >= 0 && factor < 1 ? factor : 0.9
    smoothState[axis] += (normalized - smoothState[axis]) * (1 - f)
    return smoothState[axis]
  }
}

const HELPER_DEFS: Array<[string, () => (arg?: unknown) => number]> = [
  ['vMouseX01', () => createNormalizedShim('x')],
  ['vMouseY01', () => createNormalizedShim('y')],
  ['vMouseXSmooth', () => createSmoothedShim('x')],
  ['vMouseYSmooth', () => createSmoothedShim('y')],
]

const helperCache = new Map<string, (arg?: unknown) => number>()

export function setMouseShims (): void {
  for (const [name, axis] of SHIM_DEFS) {
    if (!shimCache.has(name)) {
      shimCache.set(name, createMouseShim(axis))
    }

    try {
      Object.defineProperty(window, name, {
        get () { return shimCache.get(name) },
        set () { /* no-op — prevents strict-mode throws on assignment */ },
        configurable: true,
        enumerable: false,
      })
    } catch {
      // Already non-configurable from a previous HMR cycle — skip
    }
  }

  for (const [name, factory] of HELPER_DEFS) {
    if (!helperCache.has(name)) {
      helperCache.set(name, factory())
    }

    try {
      Object.defineProperty(window, name, {
        get () { return helperCache.get(name) },
        set () { /* no-op */ },
        configurable: true,
        enumerable: false,
      })
    } catch {
      // Already non-configurable from a previous HMR cycle — skip
    }
  }
}

export function clearMouseShims (): void {
  const w = window as unknown as Record<string, unknown>
  for (const [name] of SHIM_DEFS) {
    Reflect.deleteProperty(w, name)
  }
  for (const [name] of HELPER_DEFS) {
    Reflect.deleteProperty(w, name)
  }
  shimCache.clear()
  helperCache.clear()
  resetMouseSmoothing()
}

export function resetMouseSmoothing (): void {
  smoothState.x = 0
  smoothState.y = 0
}
