// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { setMouseShims, clearMouseShims } from './mouseShims'

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
