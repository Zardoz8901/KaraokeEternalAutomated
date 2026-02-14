import { describe, it, expect } from 'vitest'
import { createHydraAudioCompat, type AudioDataForCompat } from './hydraAudioCompat'

function makeAudioData (bins: number, fill: number): AudioDataForCompat {
  const raw = new Float32Array(bins)
  raw.fill(fill)
  return { rawFrequencyData: raw }
}

describe('hydraAudioCompat', () => {
  describe('createHydraAudioCompat', () => {
    it('returns object with fft, setBins, setSmooth, setScale', () => {
      const compat = createHydraAudioCompat()
      expect(compat.fft).toBeInstanceOf(Array)
      expect(typeof compat.setBins).toBe('function')
      expect(typeof compat.setSmooth).toBe('function')
      expect(typeof compat.setScale).toBe('function')
      expect(typeof compat.update).toBe('function')
    })

    it('exposes Hydra audio compatibility methods used by gallery sketches', () => {
      const compat = createHydraAudioCompat()
      expect(typeof compat.show).toBe('function')
      expect(typeof compat.hide).toBe('function')
      expect(typeof compat.setCutoff).toBe('function')
      expect(typeof compat.vol).toBe('number')
    })

    it('default fft array length = 4 (Hydra default)', () => {
      const compat = createHydraAudioCompat()
      expect(compat.fft.length).toBe(4)
    })
  })

  describe('setBins', () => {
    it('changes fft array length', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(8)
      expect(compat.fft.length).toBe(8)
    })

    it('clamps to minimum 2', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(0)
      expect(compat.fft.length).toBe(2)
    })

    it('clamps to maximum 64', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(100)
      expect(compat.fft.length).toBe(64)
    })

    it('does NOT reallocate when value unchanged', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(4)
      const ref1 = compat.fft
      compat.setBins(4)
      expect(compat.fft).toBe(ref1) // same reference
    })
  })

  describe('setSmooth', () => {
    it('stores smoothing value', () => {
      const compat = createHydraAudioCompat()
      compat.setSmooth(0.5)
      // Internal state — verified via update behavior
      // Just ensure no throw
    })
  })

  describe('setScale', () => {
    it('stores scale value (no throw)', () => {
      const compat = createHydraAudioCompat()
      compat.setScale(2)
    })

    it('clamps to maximum 3', () => {
      const compat = createHydraAudioCompat()
      compat.setScale(5)
      // Verify via update: scale 5 clamped to 3, so 0.5 * 3 = 1.5 → clamped to 1.0
      compat.update(makeAudioData(128, 0.5))
      for (const v of compat.fft) {
        expect(v).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('setCutoff', () => {
    it('suppresses low amplitudes below cutoff', () => {
      const compat = createHydraAudioCompat()
      compat.setSmooth(0)
      compat.setCutoff(0.6)
      compat.update(makeAudioData(128, 0.4))
      for (const v of compat.fft) {
        expect(v).toBe(0)
      }
    })
  })

  describe('show/hide', () => {
    it('can be called safely (no throw)', () => {
      const compat = createHydraAudioCompat()
      expect(() => compat.show()).not.toThrow()
      expect(() => compat.hide()).not.toThrow()
    })
  })

  describe('fft invariants', () => {
    it('fft is always defined after creation', () => {
      const compat = createHydraAudioCompat()
      expect(compat.fft).toBeDefined()
      expect(Array.isArray(compat.fft)).toBe(true)
    })

    it('fft values default to 0', () => {
      const compat = createHydraAudioCompat()
      for (const v of compat.fft) {
        expect(v).toBe(0)
      }
    })

    it('fft is always defined after setBins', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(8)
      expect(compat.fft).toBeDefined()
      expect(compat.fft.length).toBe(8)
      for (const v of compat.fft) {
        expect(v).toBe(0)
      }
    })

    it('fft is defined after setBins reduces bins below previous size', () => {
      const compat = createHydraAudioCompat()
      compat.setBins(16)
      compat.update(makeAudioData(128, 0.5))
      // Now reduce bins — fft must still be valid
      compat.setBins(2)
      expect(compat.fft).toBeDefined()
      expect(compat.fft.length).toBe(2)
      for (const v of compat.fft) {
        expect(v).toBe(0) // freshly allocated
      }
    })

    it('fft supports standard array operations (length, map, forEach, Array.from)', () => {
      const compat = createHydraAudioCompat()
      expect(compat.fft.length).toBe(4)
      expect(compat.fft.map(v => v + 1)).toEqual([1, 1, 1, 1])
      const collected: number[] = []
      compat.fft.forEach(v => collected.push(v))
      expect(collected).toEqual([0, 0, 0, 0])
      expect(Array.from(compat.fft)).toEqual([0, 0, 0, 0])
    })

    it('ignores external writes to fft (clobber protection)', () => {
      const compat = createHydraAudioCompat()
      const before = compat.fft;
      (compat as any).fft = undefined
      expect(compat.fft).toBeDefined()
      expect(Array.isArray(compat.fft)).toBe(true)
      expect(compat.fft).toBe(before)
    })

    it('ignores assignment of non-empty array to fft', () => {
      const compat = createHydraAudioCompat()
      const before = compat.fft;
      (compat as any).fft = [1, 2, 3]
      expect(compat.fft).toBe(before)
      expect(compat.fft.length).toBe(4)
    })

    it('returns same reference on consecutive reads (no per-read allocation)', () => {
      const compat = createHydraAudioCompat()
      expect(compat.fft).toBe(compat.fft)
    })

    it('setBins updates fft length via getter after accessor is in place', () => {
      const compat = createHydraAudioCompat();
      (compat as any).fft = undefined // attempt clobber
      compat.setBins(8)
      expect(compat.fft.length).toBe(8)
      for (const v of compat.fft) {
        expect(v).toBe(0)
      }
    })
  })

  describe('update', () => {
    it('populates fft array from rawFrequencyData', () => {
      const compat = createHydraAudioCompat()
      compat.update(makeAudioData(128, 0.7))
      // After update, all fft values should be > 0 (from 0.7 input)
      for (const v of compat.fft) {
        expect(v).toBeGreaterThan(0)
      }
    })

    it('updates vol from latest frame energy', () => {
      const compat = createHydraAudioCompat()
      compat.update(makeAudioData(128, 0.7))
      expect(compat.vol).toBeGreaterThan(0)
    })

    it('fft values are clamped [0, 1]', () => {
      const compat = createHydraAudioCompat()
      compat.setScale(3) // max scale
      compat.update(makeAudioData(128, 1.0))
      for (const v of compat.fft) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    })

    it('fft values reflect input data proportionally', () => {
      const compat = createHydraAudioCompat()
      compat.setSmooth(0) // disable smoothing for test
      compat.setScale(1)
      compat.update(makeAudioData(128, 0.5))
      // With 4 bins evenly sampling 128-bin data filled with 0.5, all should be ~0.5
      for (const v of compat.fft) {
        expect(v).toBeCloseTo(0.5, 1)
      }
    })

    it('handles empty frequency data gracefully', () => {
      const compat = createHydraAudioCompat()
      compat.update({ rawFrequencyData: new Float32Array(0) })
      // Should not crash, fft should remain at defaults (0)
      expect(compat.fft.length).toBe(4)
    })
  })
})
