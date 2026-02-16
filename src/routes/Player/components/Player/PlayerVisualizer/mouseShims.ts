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
}

export function clearMouseShims (): void {
  const w = window as unknown as Record<string, unknown>
  for (const [name] of SHIM_DEFS) {
    Reflect.deleteProperty(w, name)
  }
  shimCache.clear()
}
