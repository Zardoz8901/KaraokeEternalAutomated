// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import OrchestratorStatusStrip from './OrchestratorStatusStrip'
import type { OrchestratorStatusModel } from './orchestratorStatus'

vi.mock('./OrchestratorStatusStrip.css', () => ({
  default: {
    strip: 'strip',
    pill: 'pill',
    authorityPill: 'authorityPill',
    signalPill: 'signalPill',
    toneNeutral: 'toneNeutral',
    tonePrimary: 'tonePrimary',
    toneLive: 'toneLive',
    toneSuccess: 'toneSuccess',
    toneWarning: 'toneWarning',
    toneDanger: 'toneDanger',
  },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const model: OrchestratorStatusModel = {
  authority: { label: 'Host live coding', tone: 'primary' },
  broadcast: { label: 'Local edits', tone: 'warning' },
  camera: { label: 'Camera live', tone: 'live' },
}

describe('OrchestratorStatusStrip', () => {
  it('renders authority, broadcast, and camera status labels', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<OrchestratorStatusStrip model={model} />)
    })

    expect(container.textContent).toContain('Host live coding')
    expect(container.textContent).toContain('Local edits')
    expect(container.textContent).toContain('Camera live')
    expect(container.querySelector('[aria-label="Orchestrator status"]')).not.toBeNull()
    const cameraPill = Array.from(container.querySelectorAll('span'))
      .find(el => el.textContent === 'Camera live')
    expect(cameraPill?.className).toContain('toneLive')

    await act(async () => {
      root.unmount()
    })
  })
})
