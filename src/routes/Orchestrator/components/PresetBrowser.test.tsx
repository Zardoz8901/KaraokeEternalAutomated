// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresetBrowser from './PresetBrowser'
import type { PresetLeaf, PresetTreeNode } from './presetTree'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const presetTreeMock = vi.hoisted(() => ({
  lastProps: null as Record<string, unknown> | null,
}))

const apiMock = vi.hoisted(() => ({
  fetchFolders: vi.fn(),
  fetchAllPresets: vi.fn(),
  createFolder: vi.fn(),
  createPreset: vi.fn(),
  reorderFolders: vi.fn(),
  reorderPresets: vi.fn(),
  updateFolder: vi.fn(),
  updatePreset: vi.fn(),
  deleteFolder: vi.fn(),
  deletePreset: vi.fn(),
}))

let mockState: {
  user: {
    userId: number
    roomId: number
    ownRoomId: number
    isAdmin: boolean
    isGuest: boolean
  }
  rooms: {
    entities: Record<number, {
      prefs: {
        allowGuestOrchestrator: boolean
        allowRoomCollaboratorsToSendVisualizer: boolean
        restrictCollaboratorsToPartyPresetFolder: boolean
        partyPresetFolderId: number | null
      }
    }>
  }
  status: {
    visualizerApplied: null | {
      visualizerRunId: string
      visualizerCodeHash: string
      visualizerAcceptedAt: number
      visualizerAppliedAt: number
      playerSocketId: string
      playerInstanceId: string
      hydraPresetSource?: 'gallery' | 'folder' | 'raw'
      hydraPresetId?: number | null
      hydraGalleryId?: string
    }
  }
}

vi.mock('store/hooks', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}))

vi.mock('../api/hydraPresetsApi', () => apiMock)

vi.mock('../api/roomPrefsApi', () => ({
  updateMyRoomPrefs: vi.fn(),
}))

vi.mock('components/Modal/Modal', async () => {
  const ReactModule = await import('react')
  return {
    default: ({ visible = true, title, children }: { visible?: boolean, title: string, children?: React.ReactNode }) => {
      if (!visible) return null
      return ReactModule.createElement('div', { 'role': 'dialog', 'aria-label': title }, children)
    },
  }
})

vi.mock('./PresetTree', async () => {
  const ReactModule = await import('react')

  function flattenPresets (nodes: PresetTreeNode[]): PresetLeaf[] {
    return nodes.flatMap(node => node.children)
  }

  return {
    default: (props: {
      nodes: PresetTreeNode[]
      selectedPresetKey?: string | null
      loadedPreviewPresetKey?: string | null
      appliedPresetKey?: string | null
      onLoad: (preset: PresetLeaf) => void
      onSend: (preset: PresetLeaf) => void
      onRenamePreset?: (preset: PresetLeaf) => void
      onDeletePreset?: (preset: PresetLeaf) => void
      onClone?: (preset: PresetLeaf) => void
      canManagePreset?: (preset: PresetLeaf) => boolean
      getPresetRowUx?: (preset: PresetLeaf) => {
        showSend: boolean
        sendEnabled: boolean
        showClone: boolean
      }
    }) => {
      presetTreeMock.lastProps = props as unknown as Record<string, unknown>
      return ReactModule.createElement(
        'div',
        { 'data-testid': 'preset-tree' },
        flattenPresets(props.nodes).map((preset) => {
          const row = props.getPresetRowUx?.(preset)
          const children: React.ReactNode[] = [
            ReactModule.createElement(
              'button',
              {
                'key': 'load',
                'type': 'button',
                'data-testid': `load-${preset.id}`,
                'onClick': () => props.onLoad(preset),
              },
              `Load ${preset.name}`,
            ),
          ]

          if (row?.showSend) {
            children.push(ReactModule.createElement(
              'button',
              {
                'key': 'send',
                'type': 'button',
                'disabled': !row.sendEnabled,
                'data-testid': `send-${preset.id}`,
                'onClick': () => props.onSend(preset),
              },
              `Send ${preset.name}`,
            ))
          }

          if (row?.showClone && props.onClone) {
            children.push(ReactModule.createElement(
              'button',
              {
                'key': 'clone',
                'type': 'button',
                'data-testid': `clone-${preset.id}`,
                'onClick': () => props.onClone?.(preset),
              },
              `Save copy ${preset.name}`,
            ))
          }

          if (props.canManagePreset?.(preset)) {
            children.push(ReactModule.createElement(
              'button',
              {
                'key': 'rename',
                'type': 'button',
                'data-testid': `rename-${preset.id}`,
                'onClick': () => props.onRenamePreset?.(preset),
              },
              `Rename ${preset.name}`,
            ))
          }

          if (props.selectedPresetKey === preset.id) {
            children.push(ReactModule.createElement('span', { key: 'selected' }, 'Selected'))
          }

          if (props.loadedPreviewPresetKey === preset.id) {
            children.push(ReactModule.createElement('span', { key: 'loaded' }, 'Loaded in preview'))
          }

          if (props.appliedPresetKey === preset.id) {
            children.push(ReactModule.createElement('span', { key: 'applied' }, 'Applied on Player'))
          }

          return ReactModule.createElement('div', { 'key': preset.id, 'data-testid': `row-${preset.id}` }, children)
        }),
      )
    },
  }
})

async function flushEffects () {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderBrowser (onLoad = vi.fn(), onSend = vi.fn()) {
  const container = document.createElement('div')
  const root = createRoot(container)

  await act(async () => {
    root.render(<PresetBrowser currentCode='osc(10).out()' onLoad={onLoad} onSend={onSend} />)
  })
  await flushEffects()

  return { container, root, onLoad, onSend }
}

describe('PresetBrowser runtime UX', () => {
  beforeEach(() => {
    presetTreeMock.lastProps = null
    mockState = {
      user: {
        userId: 2,
        roomId: 10,
        ownRoomId: 20,
        isAdmin: false,
        isGuest: false,
      },
      rooms: {
        entities: {
          10: {
            prefs: {
              allowGuestOrchestrator: true,
              allowRoomCollaboratorsToSendVisualizer: true,
              restrictCollaboratorsToPartyPresetFolder: false,
              partyPresetFolderId: null,
            },
          },
        },
      },
      status: {
        visualizerApplied: null,
      },
    }
    apiMock.fetchFolders.mockResolvedValue([
      { folderId: 7, name: 'Party', authorUserId: 1, authorName: 'host', sortOrder: 0 },
    ])
    apiMock.fetchAllPresets.mockResolvedValue([
      { presetId: 10, folderId: 7, name: 'Saved', code: 'osc(20).out()', authorUserId: 1, authorName: 'host', sortOrder: 0 },
    ])
  })

  it('hides non-host toolbar management and does not leave modal entry points', async () => {
    const { container, root } = await renderBrowser()

    expect(container.textContent).not.toContain('New Folder')
    expect(container.textContent).not.toContain('Save Preset')

    const props = presetTreeMock.lastProps as {
      onRenamePreset?: (preset: PresetLeaf) => void
      onDeletePreset?: (preset: PresetLeaf) => void
      onClone?: (preset: PresetLeaf) => void
      canManagePreset?: (preset: PresetLeaf) => boolean
      nodes: PresetTreeNode[]
    }
    const savedPreset = props.nodes.flatMap(node => node.children).find(preset => preset.id === 'preset:10')
    expect(savedPreset).toBeDefined()
    expect(props.canManagePreset?.(savedPreset as PresetLeaf)).toBe(false)

    await act(async () => {
      props.onRenamePreset?.(savedPreset as PresetLeaf)
      props.onDeletePreset?.(savedPreset as PresetLeaf)
      props.onClone?.(savedPreset as PresetLeaf)
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it('selects and marks gallery presets as loaded only through Load', async () => {
    const { container, root, onLoad, onSend } = await renderBrowser()
    const galleryLoad = container.querySelector('button[data-testid^="load-gallery:"]') as HTMLButtonElement | null
    expect(galleryLoad).not.toBeNull()

    await act(async () => {
      galleryLoad?.click()
    })

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Selected')
    expect(container.textContent).toContain('Loaded in preview')

    const savedSend = container.querySelector('button[data-testid="send-preset:10"]') as HTMLButtonElement | null
    expect(savedSend).not.toBeNull()

    await act(async () => {
      savedSend?.click()
    })

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-testid^="row-gallery:"]')?.textContent).toContain('Loaded in preview')
    expect(container.querySelector('[data-testid="row-preset:10"]')?.textContent).not.toContain('Loaded in preview')

    await act(async () => {
      root.unmount()
    })
  })

  it('shows one broad policy notice for browse-only sends and does not repeat it per row', async () => {
    mockState.rooms.entities[10].prefs.allowRoomCollaboratorsToSendVisualizer = false

    const { container, root } = await renderBrowser()

    expect(container.textContent).toContain('Room policy blocks collaborator visual sends.')
    const disabledSend = container.querySelector('button[data-testid="send-preset:10"]') as HTMLButtonElement | null
    expect(disabledSend?.disabled).toBe(true)
    expect((container.textContent?.match(/Send disabled by room policy/g) ?? []).length).toBe(0)

    await act(async () => {
      root.unmount()
    })
  })

  it('passes player-applied saved preset state to the tree without changing selected or loaded state', async () => {
    mockState.status.visualizerApplied = {
      visualizerRunId: 'run-10',
      visualizerCodeHash: 'hash-10',
      visualizerAcceptedAt: 1,
      visualizerAppliedAt: 2,
      playerSocketId: 'player-sock',
      playerInstanceId: 'player-instance',
      hydraPresetSource: 'folder',
      hydraPresetId: 10,
    }

    const { container, root } = await renderBrowser()

    expect(container.querySelector('[data-testid="row-preset:10"]')?.textContent).toContain('Applied on Player')
    expect(container.querySelector('[data-testid="row-preset:10"]')?.textContent).not.toContain('Selected')
    expect(container.querySelector('[data-testid="row-preset:10"]')?.textContent).not.toContain('Loaded in preview')

    await act(async () => {
      root.unmount()
    })
  })
})
