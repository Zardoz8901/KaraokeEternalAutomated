import { describe, it, expect } from 'vitest'
import statusReducer, { type StatusState } from './status'
import { PLAYER_FFT, PLAYER_LEAVE, VISUALIZER_HYDRA_CODE } from 'shared/actionTypes'
import { type FftPayload } from 'shared/fftPayload'

describe('status reducer', () => {
  const initialState: StatusState = {
    cdgAlpha: 0,
    cdgSize: 0.8,
    errorMessage: '',
    fftData: null,
    historyJSON: '[]',
    isAtQueueEnd: false,
    isErrored: false,
    isPlayerPresent: false,
    isPlaying: false,
    isVideoKeyingEnabled: false,
    isWebGLSupported: false,
    mediaType: null,
    mp4Alpha: 1,
    nextUserId: null,
    position: 0,
    queueId: -1,
    visualizer: {},
    volume: 1,
  }

  it('should handle PLAYER_FFT', () => {
    const payload: FftPayload = {
      fft: [0, 1],
      bass: 0.5,
      mid: 0.5,
      treble: 0.5,
      beat: 1,
      energy: 0.5,
      bpm: 120,
      bright: 0.5,
    }

    const nextState = statusReducer(initialState, {
      type: PLAYER_FFT,
      payload,
    })

    expect(nextState.fftData).toEqual(payload)
  })

  describe('VISUALIZER_HYDRA_CODE', () => {
    it('updates visualizer preset name immediately', () => {
      const nextState = statusReducer(initialState, {
        type: VISUALIZER_HYDRA_CODE,
        payload: {
          code: 'osc(10).out(o0)',
          hydraPresetName: 'My Preset',
          hydraPresetIndex: 3,
          hydraPresetId: 42,
          hydraPresetFolderId: 1,
          hydraPresetSource: 'folder' as const,
        },
      })

      expect(nextState.visualizer.hydraPresetName).toBe('My Preset')
      expect(nextState.visualizer.hydraPresetIndex).toBe(3)
      expect(nextState.visualizer.hydraPresetId).toBe(42)
      expect(nextState.visualizer.hydraPresetFolderId).toBe(1)
      expect(nextState.visualizer.hydraPresetSource).toBe('folder')
    })

    it('does not merge hydraCode into status.visualizer', () => {
      const nextState = statusReducer(initialState, {
        type: VISUALIZER_HYDRA_CODE,
        payload: {
          code: 'osc(10).out(o0)',
          hydraPresetName: 'My Preset',
          hydraPresetIndex: 3,
        },
      })

      expect(nextState.visualizer.hydraCode).toBeUndefined()
    })

    it('handles partial payload (only code, no metadata)', () => {
      const stateWithViz: StatusState = {
        ...initialState,
        visualizer: {
          hydraPresetName: 'Existing',
          hydraPresetIndex: 5,
        },
      }

      const nextState = statusReducer(stateWithViz, {
        type: VISUALIZER_HYDRA_CODE,
        payload: {
          code: 'osc(10).out(o0)',
        },
      })

      // Existing fields should be unchanged
      expect(nextState.visualizer.hydraPresetName).toBe('Existing')
      expect(nextState.visualizer.hydraPresetIndex).toBe(5)
    })

    it('only updates index when name is also present', () => {
      const stateWithViz: StatusState = {
        ...initialState,
        visualizer: {
          hydraPresetName: 'Old Name',
          hydraPresetIndex: 1,
        },
      }

      const nextState = statusReducer(stateWithViz, {
        type: VISUALIZER_HYDRA_CODE,
        payload: {
          code: 'osc(10).out(o0)',
          hydraPresetIndex: 7,
          // no hydraPresetName
        },
      })

      // Index should NOT update without name — prevents mismatch
      expect(nextState.visualizer.hydraPresetName).toBe('Old Name')
      expect(nextState.visualizer.hydraPresetIndex).toBe(1)
    })
  })

  it('should clear fftData on PLAYER_LEAVE', () => {
    const stateWithFft: StatusState = {
      ...initialState,
      isPlayerPresent: true,
      fftData: {
        fft: [0, 1],
        bass: 0.5,
        mid: 0.5,
        treble: 0.5,
        beat: 1,
        energy: 0.5,
        bpm: 120,
        bright: 0.5,
      },
    }

    const nextState = statusReducer(stateWithFft, {
      type: PLAYER_LEAVE,
    })

    expect(nextState.isPlayerPresent).toBe(false)
    expect(nextState.fftData).toBeNull()
  })
})
