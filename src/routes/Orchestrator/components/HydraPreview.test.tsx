// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRoot } from 'react-dom/client'

let lastHydraProps: Record<string, unknown> | null = null
let hydraRenderProps: Array<Record<string, unknown>> = []
let mockStatus = {
  fftData: null,
  isPlayerPresent: false,
  isPlaying: false,
  mediaId: null as number | null,
  mediaType: null as 'cdg' | 'mp4' | '' | null,
  position: 0,
  queueId: -1,
  statusAt: 0,
}

vi.mock('../../Player/components/Player/PlayerVisualizer/HydraVisualizer', () => ({
  default: (props: Record<string, unknown>) => {
    lastHydraProps = props
    hydraRenderProps.push(props)
    return <div data-testid='hydra' />
  },
}))

vi.mock('store/hooks', () => ({
  useAppSelector: (selector: (state: { status: typeof mockStatus }) => unknown) => {
    return selector({ status: mockStatus })
  },
}))

import HydraPreview from './HydraPreview'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('HydraPreview', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    document.getElementById('__hydraVideoMount')?.remove()
    lastHydraProps = null
    hydraRenderProps = []
    mockStatus = {
      fftData: null,
      isPlayerPresent: false,
      isPlaying: false,
      mediaId: null,
      mediaType: null,
      position: 0,
      queueId: -1,
      statusAt: 0,
    }
  })

  it('passes local camera stream as remoteVideoElement to HydraVisualizer', async () => {
    class FakeGainNode {
      gain = { value: 1 }
      connect () {}
    }
    class FakeOscillatorNode {
      type = 'sine'
      frequency = { value: 0 }
      connect () {}
      start () {}
      stop () {}
    }
    class FakeAudioContext {
      destination = {}
      createGain () { return new FakeGainNode() }
      createOscillator () { return new FakeOscillatorNode() }
      close () {}
    }

    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext

    lastHydraProps = null
    const container = document.createElement('div')
    const root = createRoot(container)

    const fakeStream = { id: 'local-stream' } as unknown as MediaStream

    await act(async () => {
      root.render(
        <HydraPreview
          code='osc(10).out()'
          width={320}
          height={200}
          localCameraStream={fakeStream}
          mode='hydra'
          isEnabled={true}
          sensitivity={1}
          allowCamera={true}
        />,
      )
    })

    expect(lastHydraProps).not.toBeNull()
    expect(lastHydraProps?.remoteVideoElement).toBeInstanceOf(HTMLVideoElement)

    await act(async () => {
      root.unmount()
    })
  })

  it('does not pass a camera element when local stream is unavailable', async () => {
    class FakeGainNode {
      gain = { value: 1 }
      connect () {}
    }
    class FakeOscillatorNode {
      type = 'sine'
      frequency = { value: 0 }
      connect () {}
      start () {}
      stop () {}
    }
    class FakeAudioContext {
      destination = {}
      createGain () { return new FakeGainNode() }
      createOscillator () { return new FakeOscillatorNode() }
      close () {}
    }

    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext

    lastHydraProps = null
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraPreview
          code='osc(10).out()'
          width={320}
          height={200}
          localCameraStream={null}
          mode='hydra'
          isEnabled={true}
          sensitivity={1}
          allowCamera={true}
        />,
      )
    })

    expect(lastHydraProps).not.toBeNull()
    expect(lastHydraProps?.remoteVideoElement).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('passes a synchronized shadow video for current Player MP4 media', async () => {
    class FakeGainNode {
      gain = { value: 1 }
      connect () {}
    }
    class FakeOscillatorNode {
      type = 'sine'
      frequency = { value: 0 }
      connect () {}
      start () {}
      stop () {}
    }
    class FakeAudioContext {
      destination = {}
      createGain () { return new FakeGainNode() }
      createOscillator () { return new FakeOscillatorNode() }
      close () {}
    }

    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext
    vi.spyOn(Date, 'now').mockReturnValue(1770000002500)
    mockStatus = {
      ...mockStatus,
      isPlayerPresent: true,
      isPlaying: true,
      mediaId: 91,
      mediaType: 'mp4',
      position: 12,
      queueId: 55,
      statusAt: 1770000000000,
    }

    lastHydraProps = null
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraPreview
          code='s0.initVideo("https://example.com/ignored.mp4"); src(s0).out(o0)'
          width={320}
          height={200}
          localCameraStream={null}
          mode='hydra'
          isEnabled={true}
          sensitivity={1}
          allowCamera={true}
        />,
      )
    })

    expect(lastHydraProps?.playerMediaVideoElement).toBeInstanceOf(HTMLVideoElement)
    const shadowVideo = lastHydraProps?.playerMediaVideoElement as HTMLVideoElement
    expect(shadowVideo.getAttribute('src')).toBe('/api/media/91?type=video')
    expect(shadowVideo.parentElement?.id).toBe('__hydraVideoMount')
    expect(shadowVideo.currentTime).toBe(14.5)
    expect(lastHydraProps?.requirePlayerMediaVideo).toBe(true)
    expect(lastHydraProps?.playerMediaClock).toEqual({
      mediaId: 91,
      mediaType: 'mp4',
      queueId: 55,
      position: 12,
      isPlaying: true,
      statusAt: 1770000000000,
    })

    await act(async () => {
      root.unmount()
    })

    expect(document.getElementById('__hydraVideoMount')?.querySelector('video')).toBeNull()
  })

  it('does not require player media for initImage under a current Player MP4 clock', async () => {
    class FakeGainNode {
      gain = { value: 1 }
      connect () {}
    }
    class FakeOscillatorNode {
      type = 'sine'
      frequency = { value: 0 }
      connect () {}
      start () {}
      stop () {}
    }
    class FakeAudioContext {
      destination = {}
      createGain () { return new FakeGainNode() }
      createOscillator () { return new FakeOscillatorNode() }
      close () {}
    }

    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext
    mockStatus = {
      ...mockStatus,
      isPlayerPresent: true,
      mediaId: 91,
      mediaType: 'mp4',
      position: 12,
      queueId: 55,
      statusAt: 1770000000000,
    }
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraPreview
          code='s0.initImage("https://example.com/frame.jpg"); src(s0).out(o0)'
          width={320}
          height={200}
          localCameraStream={null}
          mode='hydra'
          isEnabled={true}
          sensitivity={1}
          allowCamera={true}
        />,
      )
    })

    expect(hydraRenderProps.length).toBeGreaterThan(0)
    expect(lastHydraProps?.requirePlayerMediaVideo).toBe(false)

    await act(async () => {
      root.unmount()
    })
  })

  it('does not require player media for initScreen under a current Player MP4 clock', async () => {
    class FakeGainNode {
      gain = { value: 1 }
      connect () {}
    }
    class FakeOscillatorNode {
      type = 'sine'
      frequency = { value: 0 }
      connect () {}
      start () {}
      stop () {}
    }
    class FakeAudioContext {
      destination = {}
      createGain () { return new FakeGainNode() }
      createOscillator () { return new FakeOscillatorNode() }
      close () {}
    }

    ;(window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext
    mockStatus = {
      ...mockStatus,
      isPlayerPresent: true,
      mediaId: 91,
      mediaType: 'mp4',
      position: 12,
      queueId: 55,
      statusAt: 1770000000000,
    }
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraPreview
          code='s0.initScreen(); src(s0).out(o0)'
          width={320}
          height={200}
          localCameraStream={null}
          mode='hydra'
          isEnabled={true}
          sensitivity={1}
          allowCamera={true}
        />,
      )
    })

    expect(hydraRenderProps.length).toBeGreaterThan(0)
    expect(lastHydraProps?.requirePlayerMediaVideo).toBe(false)

    await act(async () => {
      root.unmount()
    })
  })
})
