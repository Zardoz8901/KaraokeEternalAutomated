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

function makeHydraSource () {
  return {
    initVideo: vi.fn(),
    src: null as unknown,
    tex: null as unknown,
    regl: { texture: vi.fn((opts: Record<string, unknown>) => ({ ...opts })) },
    dynamic: false,
  }
}

function makeReadyVideo () {
  const video = document.createElement('video')
  Object.defineProperty(video, 'readyState', { value: 2, configurable: true })
  Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true })
  Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true })
  return video
}

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
    Reflect.deleteProperty(window as unknown as Record<string, unknown>, 's0')
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
        sourceBindingStatus: 'not-tracked',
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

  it('emits applied for a new run id even when code and binding are unchanged', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const props = {
      audioSourceNode: null as MediaElementAudioSourceNode | null,
      isPlaying: false,
      sensitivity: 1,
      width: 320,
      height: 180,
      code: 'osc(10).out()',
      playerInstanceId: 'player-instance-a',
    }

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...props}
          visualizerRunId='run-same-code-1'
        />,
      )
    })

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...props}
          visualizerRunId='run-same-code-2'
        />,
      )
    })

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: expect.objectContaining({ visualizerRunId: 'run-same-code-1' }),
    })
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: expect.objectContaining({ visualizerRunId: 'run-same-code-2' }),
    })

    await act(async () => {
      root.unmount()
    })
  })

  it('does not emit applied when required player media provider is missing', async () => {
    const source = makeHydraSource()
    ;(window as unknown as Record<string, unknown>).s0 = source
    evalSpy.mockImplementation((code: string) => {
      new Function(code)()
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
          code='s0.initVideo("https://example.com/missing-provider.mp4", { startTime: "random" })'
          visualizerRunId='run-waiting-provider'
          playerInstanceId='player-instance-a'
          requirePlayerMediaVideo={true}
          playerMediaVideoElement={null}
          playerMediaClock={{ mediaId: 91, mediaType: 'mp4', queueId: 55, position: 12, isPlaying: true, statusAt: 1770000000000 }}
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

  it('re-runs and emits applied when required player media provider appears', async () => {
    const source = makeHydraSource()
    ;(window as unknown as Record<string, unknown>).s0 = source
    evalSpy.mockImplementation((code: string) => {
      new Function(code)()
    })
    const playerVideo = makeReadyVideo()
    const container = document.createElement('div')
    const root = createRoot(container)
    const baseProps = {
      audioSourceNode: null as MediaElementAudioSourceNode | null,
      isPlaying: false,
      sensitivity: 1,
      width: 320,
      height: 180,
      code: 's0.initVideo("https://example.com/player-media.mp4", { startTime: "random" })',
      visualizerRunId: 'run-provider-arrives',
      playerInstanceId: 'player-instance-a',
      requirePlayerMediaVideo: true,
      playerMediaClock: { mediaId: 91, mediaType: 'mp4' as const, queueId: 55, position: 12, isPlaying: true, statusAt: 1770000000000 },
    }

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...baseProps}
          playerMediaVideoElement={null}
        />,
      )
    })
    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
    }))

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...baseProps}
          playerMediaVideoElement={playerVideo}
        />,
      )
    })

    expect(evalSpy).toHaveBeenCalledTimes(2)
    expect(source.src).toBe(playerVideo)
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: expect.objectContaining({
        visualizerRunId: 'run-provider-arrives',
        playerInstanceId: 'player-instance-a',
        sourceBindingStatus: 'player-media',
        sourceBindingMediaId: 91,
        sourceBindingQueueId: 55,
      }),
    })

    await act(async () => {
      root.unmount()
    })
  })

  it('re-runs for media identity changes but not position-only drift updates', async () => {
    const source = makeHydraSource()
    ;(window as unknown as Record<string, unknown>).s0 = source
    evalSpy.mockImplementation((code: string) => {
      new Function(code)()
    })
    const playerVideoA = makeReadyVideo()
    const playerVideoB = makeReadyVideo()
    const container = document.createElement('div')
    const root = createRoot(container)
    const baseProps = {
      audioSourceNode: null as MediaElementAudioSourceNode | null,
      isPlaying: false,
      sensitivity: 1,
      width: 320,
      height: 180,
      code: 's0.initVideo("https://example.com/player-media.mp4", { startTime: "random" })',
      visualizerRunId: 'run-media-change',
      playerInstanceId: 'player-instance-a',
      requirePlayerMediaVideo: true,
    }

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...baseProps}
          playerMediaVideoElement={playerVideoA}
          playerMediaClock={{ mediaId: 91, mediaType: 'mp4', queueId: 55, position: 12, isPlaying: true, statusAt: 1770000000000 }}
        />,
      )
    })
    expect(source.src).toBe(playerVideoA)

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...baseProps}
          playerMediaVideoElement={playerVideoA}
          playerMediaClock={{ mediaId: 91, mediaType: 'mp4', queueId: 55, position: 20, isPlaying: true, statusAt: 1770000005000 }}
        />,
      )
    })
    expect(evalSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.render(
        <HydraVisualizer
          {...baseProps}
          playerMediaVideoElement={playerVideoB}
          playerMediaClock={{ mediaId: 92, mediaType: 'mp4', queueId: 56, position: 0, isPlaying: true, statusAt: 1770000010000 }}
        />,
      )
    })

    expect(evalSpy).toHaveBeenCalledTimes(2)
    expect(source.src).toBe(playerVideoB)
    expect(dispatchSpy).toHaveBeenCalledTimes(2)
    expect(dispatchSpy).toHaveBeenLastCalledWith({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: expect.objectContaining({
        visualizerRunId: 'run-media-change',
        sourceBindingStatus: 'player-media',
        sourceBindingMediaId: 92,
        sourceBindingQueueId: 56,
      }),
    })

    await act(async () => {
      root.unmount()
    })
  })
})
