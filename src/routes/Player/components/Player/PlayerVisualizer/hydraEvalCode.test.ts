import { describe, it, expect } from 'vitest'
import { getHydraEvalCode, DEFAULT_PATCH, wrapWithTimerTracking } from './hydraEvalCode'

describe('getHydraEvalCode', () => {
  it('returns raw code unchanged (no auto-audio injection)', () => {
    const code = 'osc(10).out()'
    expect(getHydraEvalCode(code)).toBe(code)
  })

  it('falls back to default patch when code is empty', () => {
    expect(getHydraEvalCode('')).toBe(DEFAULT_PATCH)
  })

  it('default patch uses safe __hydraAudio fallback', () => {
    expect(DEFAULT_PATCH).toContain('__hydraAudio')
    expect(DEFAULT_PATCH).toContain('globalThis.a')
    expect(DEFAULT_PATCH).not.toMatch(/[^.]a\.fft/)  // no bare a.fft
    expect(DEFAULT_PATCH).not.toContain('bass(')
    expect(DEFAULT_PATCH).not.toContain('mid(')
    expect(DEFAULT_PATCH).not.toContain('treble(')
    expect(DEFAULT_PATCH).not.toContain('beat(')
    expect(DEFAULT_PATCH).not.toContain('energy(')
    expect(DEFAULT_PATCH).not.toContain('bpm(')
    expect(DEFAULT_PATCH).not.toContain('bright(')
  })

  it('default patch validates .fft on __hydraAudio before using it', () => {
    expect(DEFAULT_PATCH).toContain('__H.fft')
  })

  it('default patch gracefully degrades when audio globals are absent', () => {
    expect(DEFAULT_PATCH).toContain('|| 0')
  })
})

describe('wrapWithTimerTracking', () => {
  it('wraps code in IIFE with timer shadows', () => {
    const wrapped = wrapWithTimerTracking('osc(10).out()')
    expect(wrapped).toContain('__hydraUserTimers')
    expect(wrapped).toContain('var setTimeout=')
    expect(wrapped).toContain('var setInterval=')
    expect(wrapped).toContain('osc(10).out()')
  })

  it('preserves original code inside wrapper', () => {
    const code = 'osc(10).color(1,0,0).out()'
    const wrapped = wrapWithTimerTracking(code)
    expect(wrapped).toContain(code)
  })

  it('wraps in a self-executing IIFE', () => {
    const wrapped = wrapWithTimerTracking('x()')
    expect(wrapped).toMatch(/^\s*;\(function\(\)\{/)
    expect(wrapped).toMatch(/\}\)\(\)\s*$/)
  })
})
