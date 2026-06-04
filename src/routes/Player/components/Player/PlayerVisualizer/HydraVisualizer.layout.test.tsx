// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import HydraVisualizer from './HydraVisualizer'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
}))

vi.mock('hydra-synth', () => {
  class FakeHydra {
    regl = { destroy: vi.fn() }
    o = [{}, {}, {}, {}]
    synth = { solid: vi.fn(() => ({ out: vi.fn() })), render: vi.fn() }

    constructor () {}
    eval () {}
    hush () {}
    tick () {}
    setResolution () {}
  }

  return { default: FakeHydra }
})

vi.mock('./hooks/useHydraAudio', () => ({
  useHydraAudio: () => ({
    update: () => {},
    compat: { fft: new Float32Array(8) },
    audioRef: {
      current: { bass: 0, mid: 0, treble: 0, beatIntensity: 0, energy: 0, beatFrequency: 0, spectralCentroid: 0 },
    },
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
})

async function renderViz (width: number, height: number) {
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <HydraVisualizer
        audioSourceNode={null}
        isPlaying={true}
        sensitivity={1}
        width={width}
        height={height}
        code='osc(10).out(o0)'
        layer={0}
      />,
    )
  })
  return { container, root }
}

describe('HydraVisualizer sizing', () => {
  it('keeps the canvas backing store at the given (DPR-scaled) dimensions', async () => {
    const { container, root } = await renderViz(800, 600)

    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    expect(canvas?.getAttribute('width')).toBe('800')
    expect(canvas?.getAttribute('height')).toBe('600')

    await act(async () => {
      root.unmount()
    })
  })

  it('does not pin an inline pixel CSS box on the container — it fills its parent via the stylesheet', async () => {
    // Regression: the DPR-scaled fit dims were applied as the absolutely-positioned container's
    // inline width/height, overflowing the overflow:hidden preview frame → cropped to a corner.
    // The container must size from CSS (.container { width:100%; height:100% }), not inline px.
    const { container, root } = await renderViz(800, 600)

    const wrapper = container.querySelector('canvas')?.parentElement as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.style.width).toBe('')
    expect(wrapper.style.height).toBe('')

    await act(async () => {
      root.unmount()
    })
  })
})
