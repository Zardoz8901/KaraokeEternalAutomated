import { describe, it, expect } from 'vitest'
import { fitPreviewToFrame, getPreviewSize, shouldShowRefPanelToggle } from './orchestratorLayout'

describe('orchestratorLayout', () => {
  it('uses full-width preview on narrow screens', () => {
    const size = getPreviewSize(390)
    expect(size.width).toBe(358)
    expect(size.height).toBe(269)
  })

  it('uses full-width preview on tablet-width mobile', () => {
    const size = getPreviewSize(768)
    expect(size.width).toBe(736)
    expect(size.height).toBe(552)
  })

  it('clamps preview width to minimum on very small screens', () => {
    const size = getPreviewSize(260)
    expect(size.width).toBe(240)
    expect(size.height).toBe(180)
  })

  it('uses desktop preview sizing on wide screens', () => {
    const size = getPreviewSize(1200)
    expect(size.width).toBe(420)
    expect(size.height).toBe(315)
  })

  describe('shouldShowRefPanelToggle', () => {
    it('returns true for narrow screens', () => {
      expect(shouldShowRefPanelToggle(800)).toBe(true)
    })

    it('returns false at breakpoint', () => {
      expect(shouldShowRefPanelToggle(980)).toBe(false)
    })

    it('returns false for wide screens', () => {
      expect(shouldShowRefPanelToggle(1200)).toBe(false)
    })
  })

  describe('fitPreviewToFrame', () => {
    it('fills the frame at the frame own aspect (Option A: canvas CSS == measured content-box)', () => {
      expect(fitPreviewToFrame(800, 450, { dpr: 1 })).toEqual({ width: 800, height: 450 })
      expect(fitPreviewToFrame(640, 640, { dpr: 1 })).toEqual({ width: 640, height: 640 })
    })

    it('multiplies by devicePixelRatio for crispness and caps DPR at 2', () => {
      expect(fitPreviewToFrame(400, 300, { dpr: 2 })).toEqual({ width: 800, height: 600 })
      expect(fitPreviewToFrame(400, 300, { dpr: 3 })).toEqual({ width: 800, height: 600 })
    })

    it('clamps a collapsed/below-minimum frame to a positive integer floor', () => {
      const tiny = fitPreviewToFrame(50, 10, { dpr: 1 })
      expect(tiny.width).toBeGreaterThanOrEqual(1)
      expect(tiny.height).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(tiny.width)).toBe(true)
      expect(Number.isInteger(tiny.height)).toBe(true)
    })

    it('never yields <=0, NaN, or fractional dims for 0/negative/NaN/undefined inputs', () => {
      for (const [w, h] of [[0, 0], [-100, -50], [NaN, 200], [200, NaN]] as Array<[number, number]>) {
        const out = fitPreviewToFrame(w, h, { dpr: 1 })
        expect(out.width).toBeGreaterThan(0)
        expect(out.height).toBeGreaterThan(0)
        expect(Number.isFinite(out.width)).toBe(true)
        expect(Number.isFinite(out.height)).toBe(true)
        expect(Number.isInteger(out.width)).toBe(true)
        expect(Number.isInteger(out.height)).toBe(true)
      }
      const noDpr = fitPreviewToFrame(640, 360, {} as { dpr?: number })
      expect(Number.isInteger(noDpr.width)).toBe(true)
      expect(noDpr.width).toBeGreaterThan(0)
    })

    it('rounds (not truncates) the buffer dimensions to integers', () => {
      expect(fitPreviewToFrame(333, 100, { dpr: 1.5 })).toEqual({ width: 500, height: 150 })
    })
  })
})
