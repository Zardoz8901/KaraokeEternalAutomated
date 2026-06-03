// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { FFT_STALE_MS, isPreviewLive, selectPreviewVideoElement, getCameraPipelineState, formatCameraPipelineLabel } from './hydraPreviewUtils'
import type { FftPayload } from 'shared/fftPayload'

describe('hydraPreviewUtils', () => {
  const fftPayload: FftPayload = {
    fft: [0.2, 0.4, 0.1, 0.3],
    bass: 0.4,
    mid: 0.3,
    treble: 0.2,
    beat: 0.1,
    energy: 0.5,
    bpm: 0.5,
    bright: 0.3,
  }

  it('returns live only when player present and fft is fresh', () => {
    const now = 1_000_000
    expect(isPreviewLive(fftPayload, true, now - 100, now)).toBe(true)
    expect(isPreviewLive(fftPayload, true, now - (FFT_STALE_MS + 1), now)).toBe(false)
  })

  it('returns simulated when player not present or fft missing', () => {
    const now = 1_000_000
    expect(isPreviewLive(null, true, now, now)).toBe(false)
    expect(isPreviewLive(fftPayload, false, now, now)).toBe(false)
  })

  it('prefers local video element when present', () => {
    const local = document.createElement('video')
    const remote = document.createElement('video')
    expect(selectPreviewVideoElement(local, remote)).toBe(local)
    expect(selectPreviewVideoElement(null, remote)).toBe(remote)
    expect(selectPreviewVideoElement(null, null)).toBeNull()
  })

  it('returns live pipeline state only when relay is active and hydra has bound camera sources', () => {
    expect(getCameraPipelineState({
      cameraStatus: 'active',
      usesCameraSource: true,
      boundSourceCount: 1,
    })).toEqual({
      level: 'live',
      missing: [],
    })
  })

  it('returns partial pipeline state when relay is not active and hydra source is not bound', () => {
    expect(getCameraPipelineState({
      cameraStatus: 'connecting',
      usesCameraSource: true,
      boundSourceCount: 0,
    })).toEqual({
      level: 'partial',
      missing: ['publish/subscribe', 'hydra source bind'],
    })
  })

  it('returns off pipeline state when camera is idle and code does not use camera', () => {
    expect(getCameraPipelineState({
      cameraStatus: 'idle',
      usesCameraSource: false,
      boundSourceCount: 0,
    })).toEqual({
      level: 'off',
      missing: [],
    })
  })

  it('formats camera pipeline labels as source-binding states without forbidden live wording', () => {
    expect(formatCameraPipelineLabel({ level: 'live' })).toBe('Source bound')
    expect(formatCameraPipelineLabel({ level: 'partial' })).toBe('Source binding partial')
    expect(formatCameraPipelineLabel({ level: 'off' })).toBe('Source: no camera')
  })
})
