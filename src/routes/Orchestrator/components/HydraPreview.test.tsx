// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushSync } from 'react-dom'
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

function installFakeAudioContext () {
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
}

function previewStatusText (container: HTMLElement): string {
  return container.querySelector('[data-testid="hydra-preview-status"]')?.textContent ?? ''
}

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

  it('shows waiting before player media provider is created, then mounts with Player MP4 status', async () => {
    installFakeAudioContext()
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

    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      flushSync(() => {
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

      expect(previewStatusText(container)).toContain('Local Preview')
      expect(previewStatusText(container)).toContain('Waiting for Player media')
      expect(container.querySelector('[data-testid="hydra"]')).toBeNull()
    })

    expect(previewStatusText(container)).toContain('Local Preview')
    expect(previewStatusText(container)).toContain('Preview using Player MP4')
    expect(container.querySelector('[data-testid="hydra"]')).not.toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('shows safe preset video-source copy for initVideo without Player MP4 media', async () => {
    installFakeAudioContext()
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <HydraPreview
          code='s0.initVideo("https://example.com/preset.mp4"); src(s0).out(o0)'
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

    expect(previewStatusText(container)).toContain('Local Preview')
    expect(previewStatusText(container)).toContain('Preview uses preset video source')
    expect(previewStatusText(container)).not.toContain('Fallback')
    expect(container.querySelector('[data-testid="hydra"]')).not.toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('shows player audio reactive copy from Player FFT data without live preview wording', async () => {
    installFakeAudioContext()
    mockStatus = {
      ...mockStatus,
      isPlayerPresent: true,
      fftData: {
        fft: [0, 0, 0, 0],
        bass: 0,
        mid: 0,
        treble: 0,
        beat: 0,
        energy: 0,
        bpm: 120,
        bright: 0,
      },
    }
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

    expect(previewStatusText(container)).toContain('Local Preview')
    expect(previewStatusText(container)).toContain('Player audio reactive')
    expect(previewStatusText(container)).not.toContain('Live')

    await act(async () => {
      root.unmount()
    })
  })

  it('does not create a shadow MP4 video for non-initVideo code under an MP4 clock', async () => {
    installFakeAudioContext()
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

    expect(hydraRenderProps.length).toBeGreaterThan(0)
    expect(document.getElementById('__hydraVideoMount')?.querySelector('video') ?? null).toBeNull()
    expect(previewStatusText(container)).toContain('Local Preview')
    expect(previewStatusText(container)).not.toContain('Waiting for Player media')

    await act(async () => {
      root.unmount()
    })
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
