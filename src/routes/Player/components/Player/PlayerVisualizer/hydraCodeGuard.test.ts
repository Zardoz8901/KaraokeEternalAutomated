import { describe, it, expect } from 'vitest'
import { detectFatalPatterns } from './hydraCodeGuard'

describe('detectFatalPatterns', () => {
  describe('safe code passes', () => {
    it('returns null for valid Hydra code', () => {
      expect(detectFatalPatterns('osc(10, 0.1, 2).out()')).toBeNull()
    })

    it('returns null for Math.random() calls (parens prevent match)', () => {
      expect(detectFatalPatterns('osc(Math.random() * 20).out()')).toBeNull()
    })

    it('returns null for Math.random() with chained methods', () => {
      expect(detectFatalPatterns('osc(Math.random().toString()).out()')).toBeNull()
    })

    it('returns null for empty/whitespace code', () => {
      expect(detectFatalPatterns('')).toBeNull()
      expect(detectFatalPatterns('   ')).toBeNull()
    })

    it('returns null for Math.random in a comment', () => {
      expect(detectFatalPatterns('// Math.random.afft[2]\nosc(10).out()')).toBeNull()
    })

    it('returns null for Math.random in a block comment', () => {
      expect(detectFatalPatterns('/* Math.random.afft[2] */ osc(10).out()')).toBeNull()
    })

    it('returns null for Math.random in a string literal', () => {
      expect(detectFatalPatterns('"Math.random.afft[2]"')).toBeNull()
      expect(detectFatalPatterns("'Math.random.afft[2]'")).toBeNull()
    })

    it('returns null for Math.random in a template literal', () => {
      expect(detectFatalPatterns('`Math.random.afft[2]`')).toBeNull()
    })

    it('returns null for standalone Math.random without property access', () => {
      expect(detectFatalPatterns('let x = Math.random')).toBeNull()
    })
  })

  describe('fatal patterns detected', () => {
    it('catches Math.random.afft[2] (bracket deref)', () => {
      const result = detectFatalPatterns('osc(Math.random.afft[2]).out()')
      expect(result).toBeTruthy()
      expect(result).toContain('Math.random')
    })

    it('catches Math.random.afft.foo (chained dot deref)', () => {
      const result = detectFatalPatterns('osc(Math.random.afft.foo).out()')
      expect(result).toBeTruthy()
    })

    it('catches Math.random.afft( (call deref)', () => {
      const result = detectFatalPatterns('osc(Math.random.afft()).out()')
      expect(result).toBeTruthy()
    })

    it('catches with whitespace: Math.random .afft[2]', () => {
      const result = detectFatalPatterns('osc(Math.random .afft[2]).out()')
      expect(result).toBeTruthy()
    })

    it('returns first fatal pattern when multiple exist', () => {
      const result = detectFatalPatterns('Math.random.x[0] + Math.random.y[1]')
      expect(result).toBeTruthy()
    })

    it('catches fatal pattern after safe code', () => {
      const result = detectFatalPatterns('osc(Math.random() * 10).out()\nMath.random.afft[2]')
      expect(result).toBeTruthy()
    })

    it('catches fatal pattern outside comment even when comment has one too', () => {
      const result = detectFatalPatterns('// safe comment\nMath.random.afft[2]')
      expect(result).toBeTruthy()
    })
  })

  describe('deduped logging', () => {
    it('returns same description for same fatal code', () => {
      const code = 'Math.random.afft[2]'
      const r1 = detectFatalPatterns(code)
      const r2 = detectFatalPatterns(code)
      expect(r1).toBe(r2)
    })
  })
})
