// @vitest-environment jsdom
import fs from 'node:fs'
import path from 'node:path'
import React, { act } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import PresetTree from './PresetTree'
import {
  APPLIED_ON_PLAYER_LABEL,
  CAM_BADGE_LABEL,
  GALLERY_BADGE_LABEL,
  LOADED_IN_PREVIEW_BADGE_LABEL,
  SELECTED_BADGE_LABEL,
  START_BADGE_LABEL,
} from './orchestratorPresentationModel'
import { getPresetRowUx } from './presetOperatorUx'
import type { OrchestratorCapabilities } from './orchestratorCapabilities'
import type { PresetTreeNode } from './presetTree'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function readPresetTreeCss (): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'src/routes/Orchestrator/components/PresetTree.css'),
    'utf8',
  )
}

function cssBlock (css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`).exec(css)
  return match?.groups?.body ?? ''
}

function expectLabelsInOrder (text: string, labels: string[]): void {
  let previousIndex = -1
  for (const label of labels) {
    const index = text.indexOf(label)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}

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

  it('selects a preset when Enter is pressed on a preset row without loading preview', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    const onSelect = vi.fn()
    const onLoad = vi.fn()

    const nodes = makeNodes()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          onToggleFolder={() => {}}
          onSelect={onSelect}
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

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onLoad).not.toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it('selects by row click and loads only from the explicit Load button', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onSelect = vi.fn()
    const onLoad = vi.fn()
    const nodes = makeNodes()

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          onToggleFolder={() => {}}
          onSelect={onSelect}
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
      row?.click()
    })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onLoad).not.toHaveBeenCalled()

    const loadButton = container.querySelector('button[aria-label="Load preset"]') as HTMLButtonElement | null
    await act(async () => {
      loadButton?.click()
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

    expect(container.textContent).toContain(SELECTED_BADGE_LABEL)
    expect(container.textContent).toContain(LOADED_IN_PREVIEW_BADGE_LABEL)

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

    expect(container.textContent).toContain(SELECTED_BADGE_LABEL)
    expect(container.textContent).not.toContain(LOADED_IN_PREVIEW_BADGE_LABEL)
    expect(container.textContent).toContain(APPLIED_ON_PLAYER_LABEL)

    await act(async () => {
      root.unmount()
    })
  })

  it.each([
    ['sending', '⟳', 'last send: sending'],
    ['synced', '✓', 'last send: synced'],
    ['error', '✕', 'last send: failed'],
  ] as const)('shows glyph-only row send feedback for %s without duplicating strip text', async (presetSendStatus, glyph, label) => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          sendingPresetKey='preset:1'
          presetSendStatus={presetSendStatus}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
      .find(element => element.getAttribute('aria-label')?.startsWith('Preset test'))
    const ack = row?.querySelector(`[aria-label="${label}"]`)

    expect(ack?.textContent).toBe(glyph)
    expect(row?.textContent).not.toContain('Synced')
    expect(row?.textContent).not.toContain('Failed')

    await act(async () => {
      root.unmount()
    })
  })

  it('does not show row send feedback on non-matching preset rows', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PresetTree
          nodes={makeNodes()}
          expanded={new Set(['folder:1'])}
          selectedPresetKey={null}
          loadedPreviewPresetKey={null}
          sendingPresetKey='preset:999'
          presetSendStatus='sending'
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.querySelector('[aria-label="last send: sending"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('renders every row badge from the shared status vocabulary constants in strongest-truth order', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const nodes = makeNodes()
    nodes[0].children[0] = {
      ...nodes[0].children[0],
      usesCamera: true,
    }

    await act(async () => {
      root.render(
        <PresetTree
          nodes={[...makeGalleryNodes(), ...nodes]}
          expanded={new Set(['gallery', 'folder:1'])}
          selectedPresetKey='preset:1'
          loadedPreviewPresetKey='preset:1'
          appliedPresetKey='preset:1'
          startingPresetId={1}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain(SELECTED_BADGE_LABEL)
    expect(container.textContent).toContain(LOADED_IN_PREVIEW_BADGE_LABEL)
    expect(container.textContent).toContain(APPLIED_ON_PLAYER_LABEL)
    expect(container.textContent).toContain(START_BADGE_LABEL)
    expect(container.textContent).toContain(CAM_BADGE_LABEL)

    const savedRow = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
      .find(element => element.getAttribute('aria-label')?.startsWith('Preset test'))
    expect(savedRow).not.toBeNull()
    expectLabelsInOrder(savedRow?.textContent ?? '', [
      APPLIED_ON_PLAYER_LABEL,
      LOADED_IN_PREVIEW_BADGE_LABEL,
      SELECTED_BADGE_LABEL,
      START_BADGE_LABEL,
      CAM_BADGE_LABEL,
    ])

    const galleryRow = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
      .find(element => element.getAttribute('aria-label')?.startsWith('Preset demo'))
    // Gallery is no longer a row badge — the glyph circle is gone (identity now lives in the row aria-label).
    expect(galleryRow?.querySelector(`[role="img"][aria-label="${GALLERY_BADGE_LABEL}"]`)).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('collapses each row badge to a glyph circle carrying its full accessible name at rest', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const nodes = makeNodes()
    nodes[0].children[0] = {
      ...nodes[0].children[0],
      usesCamera: true,
    }

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey='preset:1'
          loadedPreviewPresetKey='preset:1'
          appliedPresetKey='preset:1'
          startingPresetId={1}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
      .find(element => element.getAttribute('aria-label')?.startsWith('Preset test'))
    expect(row).not.toBeUndefined()

    for (const label of [
      APPLIED_ON_PLAYER_LABEL,
      LOADED_IN_PREVIEW_BADGE_LABEL,
      SELECTED_BADGE_LABEL,
      START_BADGE_LABEL,
      CAM_BADGE_LABEL,
    ]) {
      const circle = row?.querySelector<HTMLElement>(`[role="img"][aria-label="${label}"]`)
      expect(circle, `glyph circle for ${label}`).not.toBeNull()
      // title parity with the accessible name (sighted hover decode; mirrors the .sendAck precedent)
      expect(circle?.getAttribute('title')).toBe(label)
      // the full word is a real in-DOM (visually-hidden) text node at rest — keeps the textContent/order guards green
      expect(circle?.textContent).toContain(label)
      // collapsed circles are NOT focus stops
      expect(circle?.hasAttribute('tabindex')).toBe(false)
      expect(circle?.getAttribute('data-tree-focusable')).toBeNull()
    }

    // grayscale distinctness: the shared-yellow (Selected/Start) and adjacent-hue (Loaded/Cam) pairs differ by MARK, not color
    const markSig = (label: string): string => {
      const glyph = row?.querySelector<HTMLElement>(`[role="img"][aria-label="${label}"] [aria-hidden="true"]`)
      return glyph ? (glyph.textContent || glyph.tagName) : ''
    }
    expect(markSig(SELECTED_BADGE_LABEL)).not.toBe(markSig(START_BADGE_LABEL))
    expect(markSig(LOADED_IN_PREVIEW_BADGE_LABEL)).not.toBe(markSig(CAM_BADGE_LABEL))

    await act(async () => {
      root.unmount()
    })
  })

  it('exposes row badge states in the preset row accessible name', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const nodes = makeNodes()
    nodes[0].children[0] = {
      ...nodes[0].children[0],
      usesCamera: true,
    }

    await act(async () => {
      root.render(
        <PresetTree
          nodes={nodes}
          expanded={new Set(['folder:1'])}
          selectedPresetKey='preset:1'
          loadedPreviewPresetKey='preset:1'
          appliedPresetKey='preset:1'
          startingPresetId={1}
          onToggleFolder={() => {}}
          onLoad={() => {}}
          onSend={() => {}}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const focusables = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
    const row = focusables.find(element => element.getAttribute('aria-label')?.startsWith('Preset test'))
    expect(row?.getAttribute('aria-label')).toBe(
      `Preset test, ${APPLIED_ON_PLAYER_LABEL}, ${LOADED_IN_PREVIEW_BADGE_LABEL}, ${SELECTED_BADGE_LABEL}, ${START_BADGE_LABEL}, ${CAM_BADGE_LABEL}`,
    )

    await act(async () => {
      root.unmount()
    })
  })

  it('exposes Gallery identity on gallery preset rows', async () => {
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
          getPresetRowUx={preset => getPresetRowUx(preset, operatorCapabilities)}
          isDndEnabled={false}
          onDragEnd={() => {}}
        />,
      )
    })

    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
      .find(element => element.getAttribute('aria-label')?.startsWith('Preset demo'))
    expect(row?.getAttribute('aria-label')).toBe(`Preset demo, ${GALLERY_BADGE_LABEL}`)
    // identity is preserved in the accessible name only; the visible Gallery badge circle is dropped.
    expect(row?.querySelector(`[role="img"][aria-label="${GALLERY_BADGE_LABEL}"]`)).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('reserves a fixed-height no-wrap badge lane of glyph circles to avoid row reflow', () => {
    const css = readPresetTreeCss()
    const presetMeta = cssBlock(css, '.presetMeta')
    const badgeDot = cssBlock(css, '.badgeDot')

    expect(presetMeta).toContain('flex-wrap: nowrap;')
    expect(presetMeta).toContain('min-height: var(--orch-preset-badge-lane-height);')
    expect(presetMeta).toContain('overflow: hidden;')
    // collapsed badge = fixed lane-height circle (reuses the .sendAck box), so it can never wrap or reflow the row
    expect(badgeDot).toContain('width: var(--orch-preset-badge-lane-height);')
    expect(badgeDot).toContain('height: var(--orch-preset-badge-lane-height);')
    expect(badgeDot).toContain('border-radius: 999px;')
  })

  it('neutralizes the badge hover-lift under prefers-reduced-motion', () => {
    const css = readPresetTreeCss()
    // the in-lane micro-lift is size-neutral (filter + inset ring); reduce-motion makes it instant
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.badgeDot[\s\S]*?transition:\s*none/)
  })
})
