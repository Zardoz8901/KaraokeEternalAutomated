// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import React, { act } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import StagePanel from './StagePanel'
import { buildPreviewCode, detectOutputBuffer } from './stagePanelUtils'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface MockHydraPreviewProps {
  width: number
  height: number
  onCameraBoundSourcesChange?: (sources: string[]) => void
}

interface MockResizePayload {
  width?: number
  height?: number
}

const stagePanelMockState = vi.hoisted(() => ({
  boundSources: [] as string[],
  previewProps: [] as MockHydraPreviewProps[],
  previewMountCount: 0,
  resizeCallback: null as ((payload: MockResizePayload) => void) | null,
}))

vi.mock('use-resize-observer', () => ({
  default: ({ onResize }: { onResize?: (payload: MockResizePayload) => void }) => {
    stagePanelMockState.resizeCallback = onResize ?? null
    return {}
  },
}))

vi.mock('./HydraPreview', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react')
  function MockHydraPreview ({ width, height, onCameraBoundSourcesChange }: MockHydraPreviewProps) {
    ReactModule.useEffect(() => {
      stagePanelMockState.previewMountCount += 1
    }, [])
    ReactModule.useEffect(() => {
      onCameraBoundSourcesChange?.(stagePanelMockState.boundSources)
    }, [onCameraBoundSourcesChange])
    stagePanelMockState.previewProps.push({ width, height, onCameraBoundSourcesChange })
    return <div data-testid='preview' />
  }

  return {
    default: MockHydraPreview,
  }
})

function readStagePanelCss (): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src/routes/Orchestrator/components/StagePanel.css'),
    'utf8',
  )
}

function readStatusStripCss (): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src/routes/Orchestrator/components/OrchestratorStatusStrip.css'),
    'utf8',
  )
}

function cssBlock (css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`).exec(css)
  return match?.groups?.body ?? ''
}

function latestPreviewProps (): MockHydraPreviewProps {
  const props = stagePanelMockState.previewProps[stagePanelMockState.previewProps.length - 1]
  expect(props).toBeDefined()
  return props!
}

async function renderStagePanel (root: ReturnType<typeof createRoot>, props: Partial<React.ComponentProps<typeof StagePanel>> = {}) {
  await act(async () => {
    root.render(
      <StagePanel
        code='osc(10,0,1).out(o0)'
        width={360}
        height={270}
        buffer='auto'
        onBufferChange={vi.fn()}
        visualizerMode='hydra'
        visualizerEnabled={true}
        visualizerSensitivity={1}
        visualizerAllowCamera={false}
        cameraRelayStatus='idle'
        {...props}
      />,
    )
  })
}

describe('StagePanel', () => {
  beforeEach(() => {
    stagePanelMockState.boundSources = []
    stagePanelMockState.previewProps = []
    stagePanelMockState.previewMountCount = 0
    stagePanelMockState.resizeCallback = null
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses fallback preview dimensions until frame measurement settles, then keeps the preview mounted and single-child', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      window.clearTimeout(id)
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    await renderStagePanel(root)

    expect(latestPreviewProps()).toMatchObject({ width: 360, height: 270 })
    expect(stagePanelMockState.resizeCallback).toBeTypeOf('function')
    const preview = container.querySelector('[data-testid="preview"]')
    const stageFrame = preview?.parentElement
    expect(stageFrame?.children).toHaveLength(1)

    await act(async () => {
      stagePanelMockState.resizeCallback?.({ width: 800, height: 450 })
      vi.advanceTimersByTime(119)
    })

    expect(latestPreviewProps()).toMatchObject({ width: 360, height: 270 })

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(latestPreviewProps()).toMatchObject({ width: 800, height: 450 })
    expect(stagePanelMockState.previewMountCount).toBe(1)
    expect(stageFrame?.children).toHaveLength(1)
    expect(stageFrame?.firstElementChild).toBe(preview)

    await act(async () => {
      root.unmount()
    })
  })

  it('coalesces burst frame measurements into one settled preview-size update', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(0), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number) => {
      window.clearTimeout(id)
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    await renderStagePanel(root)
    const initialRenderCount = stagePanelMockState.previewProps.length

    await act(async () => {
      stagePanelMockState.resizeCallback?.({ width: 700, height: 390 })
      stagePanelMockState.resizeCallback?.({ width: 800, height: 450 })
      stagePanelMockState.resizeCallback?.({ width: 960, height: 540 })
      vi.advanceTimersByTime(120)
    })

    const settledUpdates = stagePanelMockState.previewProps
      .slice(initialRenderCount)
      .filter(props => props.width !== 360 || props.height !== 270)

    expect(settledUpdates).toHaveLength(1)
    expect(settledUpdates[0]).toMatchObject({ width: 960, height: 540 })
    expect(stagePanelMockState.previewMountCount).toBe(1)

    await act(async () => {
      root.unmount()
    })
  })

  describe('detectOutputBuffer', () => {
    it('.out() (no arg) → o0', () => {
      expect(detectOutputBuffer('osc(10).out()')).toBe('o0')
    })

    it('.out(o2) → o2', () => {
      expect(detectOutputBuffer('osc(10).out(o2)')).toBe('o2')
    })

    it('render(o2) overrides .out(o1)', () => {
      expect(detectOutputBuffer('osc(10).out(o1)\nrender(o2)')).toBe('o2')
    })

    it('render() (no arg) → o0', () => {
      expect(detectOutputBuffer('osc(10).out(o1)\nrender()')).toBe('o0')
    })

    it('multiple .out() → last one', () => {
      expect(detectOutputBuffer('osc(10).out(o1)\nnoise(3).out(o3)')).toBe('o3')
    })

    it('no .out or render → o0', () => {
      expect(detectOutputBuffer('osc(10).color(1,0,0)')).toBe('o0')
    })

    it('.out(o2) inside // comment is ignored', () => {
      expect(detectOutputBuffer('// .out(o2)\nosc(10).out(o1)')).toBe('o1')
    })

    it('.out(o3) inside /* */ block comment is ignored', () => {
      expect(detectOutputBuffer('/* .out(o3) */\nosc(10).out(o1)')).toBe('o1')
    })
  })

  describe('buildPreviewCode', () => {
    it('auto mode uses detectOutputBuffer to find target', () => {
      const code = 'osc(10).out(o2)'
      const result = buildPreviewCode(code, 'auto')
      // Auto-detect: .out(o2) → render(o2)
      expect(result).toContain('render(o2)')
    })

    it('auto mode with .out() → render(o0)', () => {
      const code = 'osc(10).out()'
      const result = buildPreviewCode(code, 'auto')
      expect(result).toContain('render(o0)')
    })

    it('auto mode with render(o2) in code → no extra render appended', () => {
      const code = 'osc(10).out(o1)\nrender(o2)'
      const result = buildPreviewCode(code, 'auto')
      expect(result).toBe(code)
    })

    it('auto mode with render() in code → no extra render appended', () => {
      const code = 'osc(10).out()\nrender()'
      const result = buildPreviewCode(code, 'auto')
      expect(result).toBe(code)
    })

    it('auto mode with commented-out render → appends render', () => {
      const code = '// render(o2)\nosc(10).out(o1)'
      const result = buildPreviewCode(code, 'auto')
      expect(result).toBe(`${code}\nrender(o1)`)
    })

    it('explicit buffer override always appends even with existing render', () => {
      const code = 'osc(10).out(o1)\nrender(o2)'
      const result = buildPreviewCode(code, 'o1')
      expect(result).toBe(`${code}\nrender(o1)`)
    })

    it('manual o1 override works', () => {
      const code = 'osc(10).out(o2)'
      const result = buildPreviewCode(code, 'o1')
      expect(result).toBe(`${code}\nrender(o1)`)
    })

    it('returns empty for empty code', () => {
      expect(buildPreviewCode('', 'auto')).toBe('')
      expect(buildPreviewCode('  ', 'o0')).toBe('')
    })
  })

  // NOTE: In auto mode, preview respects user's existing render() call.
  // In explicit buffer mode, preview always appends render(oN).
  it('renders buffer buttons (Auto + o0-o3)', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <StagePanel
          code='osc(10,0,1).out(o0)'
          width={360}
          height={270}
          buffer='auto'
          onBufferChange={vi.fn()}
          visualizerMode='hydra'
          visualizerEnabled={true}
          visualizerSensitivity={1}
          visualizerAllowCamera={false}
          cameraRelayStatus='idle'
        />,
      )
    })

    expect(container.textContent).toContain('Auto')
    expect(container.textContent).toContain('o0')
    expect(container.textContent).toContain('o1')
    expect(container.textContent).toContain('o2')
    expect(container.textContent).toContain('o3')
    expect(container.textContent).not.toContain('Player Feed')
    const bufferGroup = container.querySelector('[role="radiogroup"][aria-label="Preview output buffer"]')
    expect(bufferGroup).not.toBeNull()
    const radios = Array.from(bufferGroup?.querySelectorAll('[role="radio"]') ?? [])
    expect(radios).toHaveLength(5)
    expect(radios.map(radio => radio.getAttribute('aria-label'))).toEqual([
      'Output buffer Auto',
      'Output buffer o0',
      'Output buffer o1',
      'Output buffer o2',
      'Output buffer o3',
    ])
    expect(radios.map(radio => radio.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ])

    await act(async () => {
      root.unmount()
    })
  })

  it('renders the Preview qualifier in the Stage title', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <StagePanel
          code='osc(10,0,1).out(o0)'
          width={360}
          height={270}
          buffer='auto'
          onBufferChange={vi.fn()}
          visualizerMode='hydra'
          visualizerEnabled={true}
          visualizerSensitivity={1}
          visualizerAllowCamera={false}
          cameraRelayStatus='idle'
        />,
      )
    })

    expect(container.textContent).toContain('Stage')
    expect(container.textContent).toContain('Preview')

    await act(async () => {
      root.unmount()
    })
  })

  it('locks the Stage header CSS order, truncation, mobile qualifier, and touch contract', () => {
    const stageCss = readStagePanelCss()
    const statusCss = readStatusStripCss()
    const stageHeader = cssBlock(stageCss, '.stageHeader')
    const stageHeaderLeft = cssBlock(stageCss, '.stageHeaderLeft')
    const stageStatusSlot = cssBlock(stageCss, '.stageStatusSlot')
    const stageHeaderRight = cssBlock(stageCss, '.stageHeaderRight')
    const stageHint = cssBlock(stageCss, '.stageHint')
    const mobileBlock = stageCss.split('@media (max-width: 979px) {')[1]?.split('@media (min-width: 980px)')[0] ?? ''
    const pill = cssBlock(statusCss, '.pill')

    expect(stageHeader).toMatch(/grid-template-areas:\s*"label status controls";/)
    expect(stageHeaderLeft).toMatch(/grid-area:\s*label;/)
    expect(stageStatusSlot).toMatch(/grid-area:\s*status;/)
    expect(stageStatusSlot).toMatch(/overflow:\s*hidden;/)
    expect(stageHeaderRight).toMatch(/grid-area:\s*controls;/)
    expect(stageHint).not.toMatch(/display:\s*none;/)
    expect(mobileBlock).toMatch(/\.stageHeader[\s\S]*grid-template-areas:\s*"label"[\s\S]*"status"[\s\S]*"controls";/)
    expect(mobileBlock).toMatch(/\.bufferButton[\s\S]*min-height:\s*var\(--orch-touch-target\);/)
    expect(pill).toMatch(/text-overflow:\s*ellipsis;/)
  })

  it('shows Source bound when relay is active and Hydra has bound camera source', async () => {
    stagePanelMockState.boundSources = ['s0']
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <StagePanel
          code='src(s0).out(o0)'
          width={360}
          height={270}
          buffer='auto'
          onBufferChange={vi.fn()}
          visualizerMode='hydra'
          visualizerEnabled={true}
          visualizerSensitivity={1}
          visualizerAllowCamera={true}
          cameraRelayStatus='active'
        />,
      )
    })

    expect(container.textContent).toContain('Source bound')
    expect(container.textContent).not.toContain('Camera Live')
    expect(container.textContent).not.toContain('Missing')
    const region = container.querySelector('[role="status"]')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('aria-label')).toBe('Source bound')

    await act(async () => {
      root.unmount()
    })
  })

  it('shows Source binding partial and missing checks when relay is still connecting', async () => {
    stagePanelMockState.boundSources = []
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <StagePanel
          code='src(s0).out(o0)'
          width={360}
          height={270}
          buffer='auto'
          onBufferChange={vi.fn()}
          visualizerMode='hydra'
          visualizerEnabled={true}
          visualizerSensitivity={1}
          visualizerAllowCamera={true}
          cameraRelayStatus='connecting'
        />,
      )
    })

    expect(container.textContent).toContain('Source binding partial')
    expect(container.textContent).not.toContain('Camera Partial')
    expect(container.textContent).toContain('publish/subscribe')
    expect(container.textContent).toContain('hydra source bind')
    const region = container.querySelector('[role="status"]')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('aria-label')).toContain('Source binding partial')
    expect(region?.getAttribute('aria-label')).toContain('Missing:')

    await act(async () => {
      root.unmount()
    })
  })
})
