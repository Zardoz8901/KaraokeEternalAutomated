// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { PLAYER_EMIT_VISUALIZER_APPLIED } from 'shared/actionTypes'
import HydraVisualizer from './HydraVisualizer'
import { executeHydraCode } from './hydraCodeExecution'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { dispatchSpy, evalSpy, tickSpy } = vi.hoisted(() => ({
  dispatchSpy: vi.fn(),
  evalSpy: vi.fn(),
  tickSpy: vi.fn(),
}))

vi.mock('react-redux', () => ({
  useDispatch: () => dispatchSpy,
}))

vi.mock('hydra-synth', () => {
  class FakeHydra {
    regl = { destroy: vi.fn() }
    o = [{}, {}, {}, {}]
    synth = { solid: vi.fn(() => ({ out: vi.fn() })), render: vi.fn() }

    constructor () {}

    eval (...args: unknown[]) { evalSpy(...args) }

    tick (...args: unknown[]) { tickSpy(...args) }

    setResolution () {}
  }

  return { default: FakeHydra }
})

vi.mock('./hooks/useHydraAudio', () => ({
  useHydraAudio: () => ({
    update: () => {},
    compat: { fft: new Float32Array(8) },
    audioRef: {
      current: {
        bass: 0,
        mid: 0,
        treble: 0,
        beatIntensity: 0,
        energy: 0,
        beatFrequency: 0,
        spectralCentroid: 0,
      },
    },
  }),
}))

describe('executeHydraCode', () => {
  it('returns an observable success result', () => {
    const hydra = { eval: vi.fn() }

    const result = executeHydraCode(hydra as never, 'osc(10).out()')

    expect(result.ok).toBe(true)
  })

  it('returns an observable failure result', () => {
    const hydra = {
      eval: vi.fn(() => {
        throw new Error('bad code')
      }),
    }

    const result = executeHydraCode(hydra as never, 'bad()')

    expect(result.ok).toBe(false)
  })
})

describe('HydraVisualizer applied emit', () => {
  beforeEach(() => {
    dispatchSpy.mockClear()
    evalSpy.mockReset()
    tickSpy.mockReset()
  })

  it('emits applied once after eval and first tick succeed for a player run', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraVisualizer
          audioSourceNode={null}
          isPlaying={false}
          sensitivity={1}
          width={320}
          height={180}
          code='osc(10).out()'
          visualizerRunId='run-1'
          playerInstanceId='player-instance-a'
        />,
      )
    })

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: {
        visualizerRunId: 'run-1',
        playerInstanceId: 'player-instance-a',
      },
    })

    await act(async () => {
      root.render(
        <HydraVisualizer
          audioSourceNode={null}
          isPlaying={false}
          sensitivity={1}
          width={320}
          height={180}
          code='osc(10).out()'
          visualizerRunId='run-1'
          playerInstanceId='player-instance-a'
        />,
      )
    })

    expect(dispatchSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
  })

  it('does not emit applied when eval fails', async () => {
    evalSpy.mockImplementation(() => {
      throw new Error('bad code')
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraVisualizer
          audioSourceNode={null}
          isPlaying={false}
          sensitivity={1}
          width={320}
          height={180}
          code='bad()'
          visualizerRunId='run-bad'
          playerInstanceId='player-instance-a'
        />,
      )
    })

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
    }))

    await act(async () => {
      root.unmount()
    })
  })

  it('does not emit applied when first tick fails', async () => {
    tickSpy.mockImplementation(() => {
      throw new Error('tick failed')
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraVisualizer
          audioSourceNode={null}
          isPlaying={false}
          sensitivity={1}
          width={320}
          height={180}
          code='osc(10).out()'
          visualizerRunId='run-tick-fail'
          playerInstanceId='player-instance-a'
        />,
      )
    })

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
    }))

    await act(async () => {
      root.unmount()
    })
  })
})
