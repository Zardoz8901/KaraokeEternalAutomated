// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import StagePanel from '../components/StagePanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../components/HydraPreview', () => ({
  default: () => <div data-testid='hydra-preview' />,
}))

function readCss (relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function cssBlock (source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`).exec(source)
  return match?.groups?.body ?? ''
}

function cssDeclaration (block: string, property: string): string {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`${escapedProperty}:\\s*(?<value>[^;]+);`).exec(block)
  return match?.groups?.value.trim() ?? ''
}

describe('Orchestrator spatial model', () => {
  it('keeps hostSplit Stage row larger than bounded Code row in the base desktop grid', () => {
    const source = readCss('src/routes/Orchestrator/views/OrchestratorView.css')
    const container = cssBlock(source, '.container')

    expect(cssDeclaration(container, 'grid-template-rows')).toBe('minmax(0, 1fr) clamp(12rem, 30dvh, 22rem)')
    expect(container).not.toContain('44dvh')
  })

  it('keeps the pre-Option-B Stage frame as a single-preview flex reserve', async () => {
    const stageCss = readCss('src/routes/Orchestrator/components/StagePanel.css')
    const stageFrame = cssBlock(stageCss, '.stageFrame')

    expect(stageFrame).toContain('display: flex')
    expect(stageFrame).not.toContain('grid-template-columns')
    expect(stageCss).not.toContain('.snapshotCell')

    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <StagePanel
          code='osc(10, 0.1, 0.8).out(o0)'
          width={640}
          height={360}
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

    const preview = container.querySelector('[data-testid="hydra-preview"]')
    const stageFrameElement = preview?.parentElement

    expect(preview).not.toBeNull()
    expect(stageFrameElement?.children).toHaveLength(1)
    expect(stageFrameElement?.firstElementChild).toBe(preview)
    expect(container.querySelector('.snapshotCell')).toBeNull()
    expect(container.textContent).not.toContain('Player Output')

    await act(async () => {
      root.unmount()
    })
  })
})
