import { describe, it, expect } from 'vitest'
import { detectCameraUsage } from './detectCameraUsage'

describe('detectCameraUsage', () => {
  it('detects src(s0) usage', () => {
    const result = detectCameraUsage('src(s0).out()')
    expect(result).toEqual({
      sources: ['s0'],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })

  it('detects src(s0) with explicit initCam', () => {
    const result = detectCameraUsage('s0.initCam()\nsrc(s0).out()')
    expect(result).toEqual({
      sources: ['s0'],
      hasInitCam: true,
      hasExplicitSource: false,
      sourceInitMap: { s0: { hasInitCam: true, hasExplicitInit: false } },
    })
  })

  it('detects multiple sources in one expression', () => {
    const result = detectCameraUsage('src(s0).blend(src(s2)).out()')
    expect(result.sources).toEqual(['s0', 's2'])
  })

  it('returns empty sources for non-camera code', () => {
    const result = detectCameraUsage('osc(10).out()')
    expect(result).toEqual({
      sources: [],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })

  it('ignores src(s0) in line comments', () => {
    const result = detectCameraUsage('// src(s0)\nosc(10).out()')
    expect(result).toEqual({
      sources: [],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })

  it('ignores src(s0) in block comments', () => {
    const result = detectCameraUsage('/* src(s0) */\nosc(10).out()')
    expect(result).toEqual({
      sources: [],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })

  it('ignores src(s0) in string literals', () => {
    const result = detectCameraUsage('"src(s0)"\nosc(10).out()')
    expect(result).toEqual({
      sources: [],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })

  it('deduplicates sources', () => {
    const result = detectCameraUsage('src(s0).blend(src(s0)).out()')
    expect(result.sources).toEqual(['s0'])
  })

  it('detects initImage as explicit source (not initCam)', () => {
    const result = detectCameraUsage('s0.initImage("url")\nsrc(s0).out()')
    expect(result).toEqual({
      sources: ['s0'],
      hasInitCam: false,
      hasExplicitSource: true,
      sourceInitMap: { s0: { hasInitCam: false, hasExplicitInit: true } },
    })
  })

  it('detects initVideo as explicit source (not initCam)', () => {
    const result = detectCameraUsage('s0.initVideo("url")\nsrc(s0).out()')
    expect(result).toEqual({
      sources: ['s0'],
      hasInitCam: false,
      hasExplicitSource: true,
      sourceInitMap: { s0: { hasInitCam: false, hasExplicitInit: true } },
    })
  })

  it('detects initScreen as explicit source (not initCam)', () => {
    const result = detectCameraUsage('s0.initScreen()\nsrc(s0).out()')
    expect(result).toEqual({
      sources: ['s0'],
      hasInitCam: false,
      hasExplicitSource: true,
      sourceInitMap: { s0: { hasInitCam: false, hasExplicitInit: true } },
    })
  })

  it('detects both initCam and initVideo together', () => {
    const result = detectCameraUsage('s0.initCam()\ns1.initVideo("url")\nsrc(s0).blend(src(s1)).out()')
    expect(result).toEqual({
      sources: ['s0', 's1'],
      hasInitCam: true,
      hasExplicitSource: true,
      sourceInitMap: {
        s0: { hasInitCam: true, hasExplicitInit: false },
        s1: { hasInitCam: false, hasExplicitInit: true },
      },
    })
  })

  it('sorts sources numerically', () => {
    const result = detectCameraUsage('src(s2).blend(src(s0)).out()')
    expect(result.sources).toEqual(['s0', 's2'])
  })

  // Per-source init tracking tests
  it('tracks initVideo per-source: s0 has video, s1 gets camera', () => {
    const result = detectCameraUsage('s0.initVideo("url")\nsrc(s0).add(src(s1)).out()')
    expect(result.sourceInitMap).toEqual({
      s0: { hasInitCam: false, hasExplicitInit: true },
    })
    expect(result.sources).toEqual(['s0', 's1'])
  })

  it('tracks initCam on s0, initVideo on s1 in mixed preset', () => {
    const result = detectCameraUsage('s0.initCam()\ns1.initVideo("url")\nsrc(s0).blend(src(s1)).out()')
    expect(result.sourceInitMap).toEqual({
      s0: { hasInitCam: true, hasExplicitInit: false },
      s1: { hasInitCam: false, hasExplicitInit: true },
    })
  })

  it('source with both initCam and initVideo has both flags', () => {
    const result = detectCameraUsage('s0.initCam()\ns0.initVideo("url")\nsrc(s0).out()')
    expect(result.sourceInitMap).toEqual({
      s0: { hasInitCam: true, hasExplicitInit: true },
    })
  })

  it('ignores init calls inside comments in sourceInitMap', () => {
    const result = detectCameraUsage('// s0.initVideo("url")\nsrc(s0).out()')
    expect(result.sourceInitMap).toEqual({})
  })

  /**
   * Known limitation: template literals (backtick strings) are treated as
   * opaque skip regions by getSkipRegions. src(s0) inside a template literal
   * will be skipped, even if it's in a ${} expression. This is acceptable
   * for Hydra code patterns where template literals are rarely used.
   */
  it('(known limitation) src(s0) inside template literal is skipped', () => {
    const result = detectCameraUsage('`${src(s0)}`\nosc(10).out()')
    expect(result).toEqual({
      sources: [],
      hasInitCam: false,
      hasExplicitSource: false,
      sourceInitMap: {},
    })
  })
})
