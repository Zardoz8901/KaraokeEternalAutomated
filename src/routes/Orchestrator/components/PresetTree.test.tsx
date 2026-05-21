// @vitest-environment jsdom
import React, { act } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import PresetTree from './PresetTree'
import { getPresetRowUx } from './presetOperatorUx'
import type { OrchestratorCapabilities } from './orchestratorCapabilities'
import type { PresetTreeNode } from './presetTree'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('PresetTree', () => {
  const operatorCapabilities: OrchestratorCapabilities = {
    isRoomOwner: false,
    isManager: false,
    canUseOrchestrator: true,
    canLiveCode: false,
    canSendGalleryPreset: false,
    canSendSavedPresetsByPolicy: true,
    canManageRoomVisualPolicy: false,
    partyPresetFolderId: null,
    isRestrictedToPartyPresetFolder: false,
    canSendPreset: preset => !preset.isGallery && preset.presetId === 1,
  }

  const browseCapabilities: OrchestratorCapabilities = {
    ...operatorCapabilities,
    canSendSavedPresetsByPolicy: false,
    canSendPreset: () => false,
  }

  const restrictedCapabilities: OrchestratorCapabilities = {
    ...operatorCapabilities,
    partyPresetFolderId: 1,
    isRestrictedToPartyPresetFolder: true,
    canSendPreset: preset => !preset.isGallery && preset.presetId === 1 && preset.folderId === 1,
  }

  function makeNodes (): PresetTreeNode[] {
    return [
      {
        id: 'folder:1',
        folderId: 1,
        name: 'My Presets',
        isGallery: false,
        children: [
          {
            id: 'preset:1',
            presetId: 1,
            folderId: 1,
            name: 'test',
            code: 'osc(10).out()',
            isGallery: false,
            usesCamera: false,
          },
        ],
      },
    ]
  }

  function makeGalleryNodes (): PresetTreeNode[] {
    return [
      {
        id: 'gallery',
        name: 'Gallery',
        isGallery: true,
        children: [
          {
            id: 'gallery:demo',
            name: 'demo',
            code: 'osc(10).out()',
            isGallery: true,
            usesCamera: false,
          },
        ],
      },
    ]
  }

  it('renders preset action controls with explicit aria labels for compact icon UI', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    const nodes = makeNodes()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey='preset:1'
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          onDeletePreset={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.querySelector('button[aria-label="Load preset"]')?.textContent).toContain('Load')
    expect(container.querySelector('button[aria-label="Send preset"]')?.textContent).toContain('Send')
    expect(container.querySelector('button[aria-label="Delete preset"]')).not.toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('loads a preset when Enter is pressed on a preset row', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    const onLoad = vi.fn()

    const nodes = makeNodes()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={onLoad}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const focusables = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
    const row = focusables[1] ?? null
    expect(row).not.toBeNull()

    await act(async () => {
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(onLoad).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
  })

  it('does not send a preset by click when canSendPreset rejects it', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={onSend}
          canSendPreset={() => false}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const sendButton = container.querySelector('button[aria-label="Send preset"]') as HTMLButtonElement | null
    expect(sendButton).not.toBeNull()
    expect(sendButton?.disabled).toBe(true)

    await act(async () => {
      sendButton?.click()
    })

    expect(onSend).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it('does not send a preset with Space when canSendPreset rejects it', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={onSend}
          canSendPreset={() => false}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const focusables = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
    const row = focusables[1] ?? null
    expect(row).not.toBeNull()

    await act(async () => {
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })

    expect(onSend).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it('renders non-host gallery presets as preview-only with no Send or Save copy action', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeGalleryNodes()}
          expanded={new Set(['gallery'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          onClone={() => {}}
          getPresetRowUx={preset => getPresetRowUx(preset, operatorCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.querySelector('button[aria-label="Load preset"]')?.textContent).toContain('Load')
    expect(container.querySelector('button[aria-label="Send preset"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Save preset copy"]')).toBeNull()
    expect(container.textContent).toContain('Gallery presets are preview-only.')

    await act(async () => {
      root.unmount()
    })
  })

  it('does not send non-host gallery presets with keyboard Space', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeGalleryNodes()}
          expanded={new Set(['gallery'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={onSend}
          getPresetRowUx={preset => getPresetRowUx(preset, operatorCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const focusables = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
    const row = focusables[1] ?? null
    expect(row).not.toBeNull()

    await act(async () => {
      row?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    })

    expect(onSend).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it('enables Send for non-host saved DB presets allowed by policy', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={onSend}
          getPresetRowUx={preset => getPresetRowUx(preset, operatorCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const sendButton = container.querySelector('button[aria-label="Send preset"]') as HTMLButtonElement | null
    expect(sendButton).not.toBeNull()
    expect(sendButton?.disabled).toBe(false)

    await act(async () => {
      sendButton?.click()
    })

    expect(onSend).toHaveBeenCalledTimes(1)

    await act(async () => {
      root.unmount()
    })
  })

  it('does not render non-host management controls even when callbacks are provided', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          onDeletePreset={() => {}}
          onRenamePreset={() => {}}
          onMoveToFolder={() => {}}
          onSetStartingPreset={() => {}}
          getPresetRowUx={preset => getPresetRowUx(preset, operatorCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.querySelector('button[aria-label="Delete preset"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Rename preset"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Move to folder"]')).toBeNull()
    expect(container.querySelector('button[aria-label="Set as starting visual"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('keeps broad room-policy send blockers accessible without repeating row copy', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSend = vi.fn()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={onSend}
          getPresetRowUx={preset => getPresetRowUx(preset, browseCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const sendButton = container.querySelector('button[aria-label="Send preset"]') as HTMLButtonElement | null
    expect(sendButton).not.toBeNull()
    expect(sendButton?.disabled).toBe(true)
    expect(sendButton?.title).toBe('Send disabled by room policy')
    expect(container.textContent).not.toContain('Send disabled by room policy')

    await act(async () => {
      sendButton?.click()
    })

    expect(onSend).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it('uses visible row copy for party-folder send restrictions', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const nodes = makeNodes()
    nodes[0].children[0] = { ...nodes[0].children[0], folderId: 2 }

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          getPresetRowUx={preset => getPresetRowUx(preset, restrictedCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const sendButton = container.querySelector('button[aria-label="Send preset"]') as HTMLButtonElement | null
    expect(sendButton?.disabled).toBe(true)
    expect(container.textContent).toContain('Not in party folder')

    await act(async () => {
      root.unmount()
    })
  })

  it('keeps Selected and Loaded in preview visually distinct', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey='preset:1'
          loadedPreviewPresetKey='preset:1'
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('Selected')
    expect(container.textContent).toContain('Loaded in preview')

    await act(async () => {
      root.unmount()
    })
  })

  it('shows Applied on Player separately from selected and loaded preview state', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey='preset:1'
          loadedPreviewPresetKey={null}
          appliedPresetKey='preset:1'
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('Selected')
    expect(container.textContent).not.toContain('Loaded in preview')
    expect(container.textContent).toContain('Applied on Player')

    await act(async () => {
      root.unmount()
    })
  })
})
