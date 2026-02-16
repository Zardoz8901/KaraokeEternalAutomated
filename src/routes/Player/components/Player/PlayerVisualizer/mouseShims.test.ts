// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { setMouseShims, clearMouseShims, resetMouseSmoothing } from './mouseShims'

const w = window as unknown as Record<string, unknown>

afterEach(() => {
  clearMouseShims()
  delete w.mouse
})

describe('setMouseShims', () => {
  it('defines vMouseX, vMouseY, mouseX, mouseY on window', () => {
    setMouseShims()
    expect('vMouseX' in window).toBe(true)
    expect('vMouseY' in window).toBe(true)
    expect('mouseX' in window).toBe(true)
    expect('mouseY' in window).toBe(true)
  })

  it('shims are callable as functions (vMouseX())', () => {
    setMouseShims()
    w.mouse = { x: 0.42, y: 0.73 }
    const vMouseX = w.vMouseX as (() => number)
    const vMouseY = w.vMouseY as (() => number)
    expect(typeof vMouseX).toBe('function')
    expect(vMouseX()).toBe(0.42)
    expect(vMouseY()).toBe(0.73)
  })

  it('shims coerce to number in arithmetic (vMouseX + 0.1)', () => {
    setMouseShims()
    w.mouse = { x: 0.5, y: 0.8 }
    const vMouseX = w.vMouseX
    const vMouseY = w.vMouseY
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(+(vMouseX as number)).toBe(0.5)
    expect((vMouseX as number) + 0.1).toBeCloseTo(0.6)
    expect((vMouseY as number) + 0.2).toBeCloseTo(1.0)
  })

  it('returns 0 when mouse is undefined', () => {
    setMouseShims()
    const vMouseX = w.vMouseX as (() => number)
    expect(vMouseX()).toBe(0)
    expect(+(vMouseX as unknown as number)).toBe(0)
  })

  it('tracks dynamic mouse changes', () => {
    setMouseShims()
    w.mouse = { x: 0.1, y: 0.2 }
    const vMouseX = w.vMouseX as (() => number)
    expect(vMouseX()).toBe(0.1)

    w.mouse = { x: 0.9, y: 0.8 }
    expect(vMouseX()).toBe(0.9)
  })

  it('assignment is a no-op (does not throw in strict mode)', () => {
    setMouseShims()
    expect(() => { w.vMouseX = 999 }).not.toThrow()
    // Value should still be a function (setter is no-op)
    expect(typeof w.vMouseX).toBe('function')
  })

  it('returns same function object on repeated access', () => {
    setMouseShims()
    const a = w.vMouseX
    const b = w.vMouseX
    expect(a).toBe(b)
  })
})

describe('clearMouseShims', () => {
  it('removes all shim properties from window', () => {
    setMouseShims()
    clearMouseShims()
    expect('vMouseX' in window).toBe(false)
    expect('vMouseY' in window).toBe(false)
    expect('mouseX' in window).toBe(false)
    expect('mouseY' in window).toBe(false)
  })

  it('set/clear lifecycle is idempotent', () => {
    setMouseShims()
    clearMouseShims()
    setMouseShims()
    w.mouse = { x: 0.33, y: 0.66 }
    expect((w.vMouseX as () => number)()).toBe(0.33)
    clearMouseShims()
  })
})

describe('vMouseX01 / vMouseY01 (normalized 0-1)', () => {
  it('vMouseX01() returns mouse.x / innerWidth', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    const vMouseX01 = w.vMouseX01 as (arg?: unknown) => number
    expect(vMouseX01()).toBe(0.5)
  })

  it('vMouseY01() returns mouse.y / innerHeight', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    const vMouseY01 = w.vMouseY01 as (arg?: unknown) => number
    expect(vMouseY01()).toBe(0.5)
  })

  it('vMouseX01(props) normalizes by props.resolution[0]', () => {
    setMouseShims()
    w.mouse = { x: 400, y: 300 }
    const vMouseX01 = w.vMouseX01 as (arg?: unknown) => number
    expect(vMouseX01({ resolution: [800, 600] })).toBe(0.5)
  })

  it('vMouseY01(props) normalizes by props.resolution[1]', () => {
    setMouseShims()
    w.mouse = { x: 400, y: 300 }
    const vMouseY01 = w.vMouseY01 as (arg?: unknown) => number
    expect(vMouseY01({ resolution: [800, 600] })).toBe(0.5)
  })

  it('returns 0 when mouse is undefined', () => {
    setMouseShims()
    const vMouseX01 = w.vMouseX01 as (arg?: unknown) => number
    expect(vMouseX01()).toBe(0)
  })
})

describe('vMouseXSmooth / vMouseYSmooth (smoothed normalized 0-1)', () => {
  it('converges toward target over repeated calls', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    const vMouseXSmooth = w.vMouseXSmooth as (factor?: unknown) => number
    // Default factor 0.9: smoothed += (0.5 - 0) * (1 - 0.9) = 0.05
    const first = vMouseXSmooth()
    expect(first).toBeCloseTo(0.05)
    // Second call: smoothed += (0.5 - 0.05) * 0.1 = 0.045 → 0.095
    const second = vMouseXSmooth()
    expect(second).toBeCloseTo(0.095)
    // Value approaches 0.5 over many calls
    for (let i = 0; i < 100; i++) vMouseXSmooth()
    expect(vMouseXSmooth()).toBeCloseTo(0.5, 2)
  })

  it('factor 0 means instant (no smoothing)', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    const vMouseXSmooth = w.vMouseXSmooth as (factor?: unknown) => number
    // factor 0: smoothed += (0.5 - 0) * (1 - 0) = 0.5
    expect(vMouseXSmooth(0)).toBeCloseTo(0.5)
  })

  it('factor 0.99 is very smooth (slow convergence)', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    const vMouseXSmooth = w.vMouseXSmooth as (factor?: unknown) => number
    // factor 0.99: smoothed += (0.5 - 0) * 0.01 = 0.005
    const first = vMouseXSmooth(0.99)
    expect(first).toBeCloseTo(0.005)
    // After 5 more calls still far from 0.5
    for (let i = 0; i < 5; i++) vMouseXSmooth(0.99)
    expect(vMouseXSmooth(0.99)).toBeLessThan(0.05)
  })

  it('resetMouseSmoothing() clears state', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    const vMouseXSmooth = w.vMouseXSmooth as (factor?: unknown) => number
    vMouseXSmooth() // advance state
    vMouseXSmooth() // advance more
    resetMouseSmoothing()
    // After reset, starts from 0 again
    const afterReset = vMouseXSmooth()
    expect(afterReset).toBeCloseTo(0.05) // same as first call from 0
  })

  it('clearMouseShims() resets smooth state', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    const fn = w.vMouseXSmooth as (factor?: unknown) => number
    fn(); fn(); fn() // advance state
    clearMouseShims()
    setMouseShims()
    // State should be reset
    const fresh = (w.vMouseXSmooth as (factor?: unknown) => number)()
    expect(fresh).toBeCloseTo(0.05) // same as first call from 0
  })
})

describe('new helpers on window', () => {
  it('setMouseShims() defines new helpers', () => {
    setMouseShims()
    expect('vMouseX01' in window).toBe(true)
    expect('vMouseY01' in window).toBe(true)
    expect('vMouseXSmooth' in window).toBe(true)
    expect('vMouseYSmooth' in window).toBe(true)
  })

  it('clearMouseShims() removes new helpers', () => {
    setMouseShims()
    clearMouseShims()
    expect('vMouseX01' in window).toBe(false)
    expect('vMouseY01' in window).toBe(false)
    expect('vMouseXSmooth' in window).toBe(false)
    expect('vMouseYSmooth' in window).toBe(false)
  })

  it('existing vMouseX() still returns raw pixel value', () => {
    setMouseShims()
    w.mouse = { x: 512, y: 384 }
    const vMouseX = w.vMouseX as (() => number)
    expect(vMouseX()).toBe(512)
    expect(+(vMouseX as unknown as number)).toBe(512)
  })
})
