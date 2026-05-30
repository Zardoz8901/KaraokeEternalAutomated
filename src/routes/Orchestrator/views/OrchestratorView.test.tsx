// @vitest-environment jsdom
import React, { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { REMOTE_UPDATE_BANNER_LABEL } from '../components/orchestratorPresentationModel'
import type { UseOrchestratorWorkspaceResult } from './useOrchestratorWorkspace'

const mocks = vi.hoisted(() => {
  const noop = () => {}

  return {
    workspace: {
      containerRef: { current: null as HTMLDivElement | null },
      containerStyle: {},
      workspaceModel: {
        shellModel: {
          workspaceMode: 'host',
          desktopLayout: 'hostSplit',
          visibleDesktopPanels: ['presets', 'api'],
          visibleMobileTabs: ['stage', 'code', 'ref'],
          defaultDesktopTab: 'presets',
          defaultMobileTab: 'stage',
          statusAuthorityLabel: 'Host live coding',
          canExitToLibrary: true,
        },
        activeDesktopPanel: 'presets',
        activeMobilePanel: 'stage',
        canShowApiPanel: true,
        canShowCodePanel: true,
        isMobile: false,
        previewSize: { width: 640, height: 360 },
      },
      orchestratorCapabilities: {
        canUseOrchestrator: true,
        canLiveCode: true,
        canSendSavedPresetsByPolicy: true,
        canSendHydraCode: true,
        canSendGalleryPreset: true,
        canManageRoomPolicy: true,
      },
      orchestratorStatusModel: {
        authority: { label: 'Host live coding', tone: 'primary' },
        broadcast: { label: 'Remote update', tone: 'warning' },
        camera: { label: 'Camera idle', tone: 'neutral' },
      },
      presetBrowserProps: {
        currentCode: 'osc(10).out()',
        onLoad: noop,
        onSend: noop,
      },
      apiReferenceProps: {
        onInsertExample: noop,
        onReplaceWithExample: noop,
      },
      stagePanelProps: {
        code: 'osc(10).out()',
        width: 640,
        height: 360,
        buffer: 'auto',
        onBufferChange: noop,
        localCameraStream: null as MediaStream | null,
        onPresetLoad: noop,
        onPresetSend: noop,
        onRandomize: noop,
        visualizerMode: 'hydra',
        visualizerEnabled: true,
        visualizerSensitivity: 1,
        visualizerAllowCamera: true,
        cameraRelayStatus: 'idle',
      },
      codeEditorProps: {
        code: 'osc(10).out()',
        onCodeChange: noop,
        onSend: noop,
        canSend: true,
        sendStatus: 'idle',
        onResend: noop,
        onRandomize: noop,
        cameraStatus: 'idle',
        onCameraToggle: noop,
      },
      activeDesktopPanel: 'presets',
      activeMobilePanel: 'stage',
      setActiveDesktopPanel: noop,
      setActiveMobilePanel: noop,
      isKeyboardOpen: false,
      isMobile: false,
      isRefOpen: true,
      isResizingPanel: false,
      startRefPanelResize: noop,
      pendingRemoteCode: 'remote-code',
      pendingRemoteCount: 2,
      handleApplyRemote: noop,
      handleDismissRemote: noop,
      showUnsentMobileDot: false,
    },
  }
})

vi.mock('./useOrchestratorWorkspace', () => ({
  useOrchestratorWorkspace: () => mocks.workspace as unknown as UseOrchestratorWorkspaceResult,
}))

vi.mock('./OrchestratorView.css', () => ({
  default: new Proxy({}, {
    get: (_, prop: string | symbol) => String(prop),
  }),
}))

vi.mock('components/Icon/Icon', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ icon }: { icon: string }) => React.createElement('span', { 'data-icon': icon }),
  }
})

vi.mock('../components/PresetBrowser', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: () => React.createElement('section', { 'data-testid': 'preset-browser' }),
  }
})

vi.mock('../components/ApiReference', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: () => React.createElement('section', { 'data-testid': 'api-reference' }),
  }
})

vi.mock('../components/CodeEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: () => React.createElement('section', { 'data-testid': 'code-editor' }),
  }
})

vi.mock('../components/StagePanel', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ statusStrip }: { statusStrip?: React.ReactNode }) => React.createElement(
      'section',
      { 'data-testid': 'stage-panel' },
      statusStrip,
    ),
  }
})

import OrchestratorView from './OrchestratorView'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function renderOrchestratorView () {
  const container = document.createElement('div')
  const root = createRoot(container)

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/orchestrator']}>
        <OrchestratorView />
      </MemoryRouter>,
    )
  })

  return { container, root }
}

describe('OrchestratorView remote-update ownership', () => {
  beforeEach(() => {
    mocks.workspace.pendingRemoteCode = 'remote-code'
    mocks.workspace.pendingRemoteCount = 2
  })

  it('keeps Apply/Dismiss actions in the remote banner, not the Stage strip', async () => {
    const { container, root } = await renderOrchestratorView()

    const strip = container.querySelector('[aria-label="Orchestrator status"]')
    const buttons = Array.from(container.querySelectorAll('button'))
      .map(button => button.textContent?.trim())

    expect(REMOTE_UPDATE_BANNER_LABEL).toBe('Remote update available')
    expect(container.textContent).toContain(`${REMOTE_UPDATE_BANNER_LABEL} (×2)`)
    const bannerStatus = container.querySelector('[role="status"][aria-live="polite"]')
    expect(bannerStatus?.textContent).toContain(`${REMOTE_UPDATE_BANNER_LABEL} (×2)`)
    expect(buttons).toContain('Apply')
    expect(buttons).toContain('Dismiss')
    expect(strip?.textContent).toContain('Remote update')
    expect(strip?.textContent).not.toContain(REMOTE_UPDATE_BANNER_LABEL)
    expect(strip?.textContent).not.toContain('Apply')
    expect(strip?.textContent).not.toContain('Dismiss')
    expect(strip?.querySelector('button')).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })
})
