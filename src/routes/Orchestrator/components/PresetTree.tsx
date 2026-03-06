import React, { useCallback } from 'react'
import clsx from 'clsx'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import Icon from 'components/Icon/Icon'
import type { PresetLeaf, PresetTreeNode } from './presetTree'
import styles from './PresetTree.css'

interface PresetTreeProps {
  nodes: PresetTreeNode[]
  expanded: Set<string>
  selectedPresetId?: number | null
  startingPresetId?: number | null
  playerPresetFolderId?: number | null
  isDndEnabled: boolean
  onToggleFolder: (id: string) => void
  onLoad: (preset: PresetLeaf) => void
  onSend: (preset: PresetLeaf) => void
  onClone?: (preset: PresetLeaf) => void
  onDeletePreset?: (preset: PresetLeaf) => void
  onDeleteFolder?: (node: PresetTreeNode) => void
  onRenamePreset?: (preset: PresetLeaf) => void
  onRenameFolder?: (node: PresetTreeNode) => void
  onDragEnd: (result: DropResult) => void
  onSetStartingPreset?: (preset: PresetLeaf) => void
  onSetPlayerPresetFolder?: (folder: PresetTreeNode) => void
  canDeletePreset?: (preset: PresetLeaf) => boolean
  canDeleteFolder?: (node: PresetTreeNode) => boolean
  canManagePreset?: (preset: PresetLeaf) => boolean
  canManageFolder?: (node: PresetTreeNode) => boolean
  canSetStartingPreset?: (preset: PresetLeaf) => boolean
  canSetPlayerPresetFolder?: (folder: PresetTreeNode) => boolean
}

function PresetTree ({
  nodes,
  expanded,
  selectedPresetId,
  startingPresetId,
  playerPresetFolderId,
  isDndEnabled,
  onToggleFolder,
  onLoad,
  onSend,
  onClone,
  onDeletePreset,
  onDeleteFolder,
  onRenamePreset,
  onRenameFolder,
  onDragEnd,
  onSetStartingPreset,
  onSetPlayerPresetFolder,
  canDeletePreset,
  canDeleteFolder,
  canManagePreset,
  canManageFolder,
  canSetStartingPreset,
  canSetPlayerPresetFolder,
}: PresetTreeProps) {
  const focusByOffset = useCallback((target: HTMLElement, offset: number) => {
    const treeRoot = target.closest('[data-tree-root="true"]') as HTMLElement | null
    if (!treeRoot) return

    const focusables = Array.from(treeRoot.querySelectorAll<HTMLElement>('[data-tree-focusable="true"]'))
    const idx = focusables.indexOf(target)
    if (idx === -1) return

    const next = focusables[idx + offset]
    if (next) next.focus()
  }, [])

  const handleFolderKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, node: PresetTreeNode, isOpen: boolean) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleFolder(node.id)
      return
    }

    if (event.key === 'ArrowRight' && !isOpen && node.children.length > 0) {
      event.preventDefault()
      onToggleFolder(node.id)
      return
    }

    if (event.key === 'ArrowLeft' && isOpen) {
      event.preventDefault()
      onToggleFolder(node.id)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusByOffset(event.currentTarget, 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusByOffset(event.currentTarget, -1)
    }
  }, [focusByOffset, onToggleFolder])

  const handlePresetKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, preset: PresetLeaf) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onLoad(preset)
      return
    }

    if (event.key === ' ') {
      event.preventDefault()
      onSend(preset)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusByOffset(event.currentTarget, 1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusByOffset(event.currentTarget, -1)
    }
  }, [focusByOffset, onLoad, onSend])

  const droppableId = useCallback((node: PresetTreeNode) => {
    if (node.isGallery) return 'presets:gallery'
    return `presets:folder:${node.folderId}`
  }, [])

  const folderContent = (nodes: PresetTreeNode[]) =>
    nodes.map((node, folderIndex) => {
      const isOpen = expanded.has(node.id)
      const folderManageAllowed = !node.isGallery && (canManageFolder?.(node) ?? true)
      const folderDragDisabled = !isDndEnabled || node.isGallery || !folderManageAllowed
      const isPlayerPresetFolder = typeof node.folderId === 'number' && node.folderId === playerPresetFolderId

      return (
        <Draggable
          key={node.id}
          draggableId={`folder:${node.id}`}
          index={folderIndex}
          isDragDisabled={folderDragDisabled}
        >
          {(folderProvided, folderSnapshot) => (
            <div
              ref={folderProvided.innerRef}
              {...folderProvided.draggableProps}
              style={folderProvided.draggableProps.style}
              className={clsx(styles.folder, folderSnapshot.isDragging && styles.folderDragging)}
            >
              <div
                className={styles.folderHeader}
                role='button'
                tabIndex={0}
                data-tree-focusable='true'
                onClick={() => onToggleFolder(node.id)}
                onKeyDown={e => handleFolderKeyDown(e, node, isOpen)}
              >
                {!folderDragDisabled && (
                  <div {...folderProvided.dragHandleProps} className={styles.dragHandle} tabIndex={-1}>
                    <Icon icon='DRAG_INDICATOR' size={16} />
                  </div>
                )}
                <span
                  className={clsx(styles.disclosure, isOpen && styles.disclosureOpen)}
                  aria-hidden
                >
                  ▸
                </span>
                <span className={styles.folderName}>{node.name}</span>
                {node.isGallery && <span className={styles.badge}>Gallery</span>}

                {!node.isGallery && (
                  <div className={styles.folderActions}>
                    {onSetPlayerPresetFolder && !node.isGallery && (canSetPlayerPresetFolder?.(node) ?? true) && (
                      <button
                        type='button'
                        className={clsx(styles.folderActionButton, isPlayerPresetFolder && styles.actionActive)}
                        aria-label={isPlayerPresetFolder ? 'Clear player preset folder' : 'Set as player preset folder'}
                        title={isPlayerPresetFolder ? 'Clear player preset folder' : 'Set as player preset folder'}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetPlayerPresetFolder(node)
                        }}
                      >
                        <span aria-hidden>{isPlayerPresetFolder ? '★' : '☆'}</span>
                      </button>
                    )}
                    {onRenameFolder && folderManageAllowed && (
                      <button
                        type='button'
                        className={styles.folderActionButton}
                        aria-label='Rename folder'
                        title='Rename folder'
                        onClick={(e) => {
                          e.stopPropagation()
                          onRenameFolder(node)
                        }}
                      >
                        <span aria-hidden>✎</span>
                      </button>
                    )}
                    {onDeleteFolder && (canDeleteFolder?.(node) ?? true) && (
                      <button
                        type='button'
                        className={clsx(styles.folderActionButton, styles.actionDanger)}
                        aria-label='Delete folder'
                        title='Delete folder'
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFolder(node)
                        }}
                      >
                        <span aria-hidden>×</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className={clsx(styles.childrenWrap, isOpen && styles.childrenWrapOpen)}>
                <Droppable
                  droppableId={droppableId(node)}
                  type='PRESET'
                  isDropDisabled={node.isGallery || !isDndEnabled}
                >
                  {(presetListProvided) => (
                    <div
                      ref={presetListProvided.innerRef}
                      {...presetListProvided.droppableProps}
                      className={styles.children}
                    >
                      {node.children.length === 0 && (
                        <div className={styles.empty}>No presets</div>
                      )}
                      {node.children.map((preset, presetIndex) => {
                        const isSelected = typeof preset.presetId === 'number' && preset.presetId === selectedPresetId
                        const isStarting = typeof preset.presetId === 'number' && preset.presetId === startingPresetId
                        const presetManageAllowed = !preset.isGallery && (canManagePreset?.(preset) ?? true)
                        const presetDragDisabled = !isDndEnabled || preset.isGallery || !presetManageAllowed

                        return (
                          <Draggable
                            key={preset.id}
                            draggableId={`preset:${preset.id}`}
                            index={presetIndex}
                            isDragDisabled={presetDragDisabled}
                          >
                            {(presetProvided, presetSnapshot) => (
                              <div
                                ref={presetProvided.innerRef}
                                {...presetProvided.draggableProps}
                                style={presetProvided.draggableProps.style}
                                className={clsx(
                                  styles.presetRow,
                                  isSelected && styles.presetRowSelected,
                                  presetSnapshot.isDragging && styles.presetDragging,
                                )}
                                role='button'
                                tabIndex={0}
                                aria-pressed={isSelected}
                                aria-label={`Preset ${preset.name}`}
                                data-tree-focusable='true'
                                onClick={() => onLoad(preset)}
                                onKeyDown={e => handlePresetKeyDown(e, preset)}
                              >
                                {!presetDragDisabled && (
                                  <div {...presetProvided.dragHandleProps} className={styles.dragHandle} tabIndex={-1}>
                                    <Icon icon='DRAG_INDICATOR' size={16} />
                                  </div>
                                )}
                                <div className={styles.presetMain}>
                                  <span className={styles.presetName}>{preset.name}</span>
                                  <div className={styles.presetMeta}>
                                    {isSelected && <span className={clsx(styles.badge, styles.badgeSelected)}>Selected</span>}
                                    {isStarting && <span className={clsx(styles.badge, styles.badgeStart)}>Start</span>}
                                    {preset.usesCamera && <span className={clsx(styles.badge, styles.badgeCam)}>Cam</span>}
                                  </div>
                                </div>

                                <div className={styles.actions} role='group' aria-label={`${preset.name} actions`}>
                                  <button
                                    type='button'
                                    className={styles.actionButton}
                                    aria-label='Load preset'
                                    title='Load preset'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onLoad(preset)
                                    }}
                                  >
                                    <span aria-hidden>↓</span>
                                  </button>
                                  <button
                                    type='button'
                                    className={clsx(styles.actionButton, styles.actionPrimary)}
                                    aria-label='Send preset'
                                    title='Send preset'
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onSend(preset)
                                    }}
                                  >
                                    <span aria-hidden>↑</span>
                                  </button>
                                  {!preset.isGallery && onSetStartingPreset && (canSetStartingPreset?.(preset) ?? true) && (
                                    <button
                                      type='button'
                                      className={clsx(styles.actionButton, isStarting && styles.actionActive)}
                                      aria-label={isStarting ? 'Clear starting visual' : 'Set as starting visual'}
                                      title={isStarting ? 'Clear starting visual' : 'Set as starting visual'}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onSetStartingPreset(preset)
                                      }}
                                    >
                                      <span aria-hidden>{isStarting ? '★' : '☆'}</span>
                                    </button>
                                  )}
                                  {!preset.isGallery && onRenamePreset && presetManageAllowed && (
                                    <button
                                      type='button'
                                      className={styles.actionButton}
                                      aria-label='Rename preset'
                                      title='Rename preset'
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onRenamePreset(preset)
                                      }}
                                    >
                                      <span aria-hidden>✎</span>
                                    </button>
                                  )}
                                  {preset.isGallery && onClone && (
                                    <button
                                      type='button'
                                      className={styles.actionButton}
                                      aria-label='Save preset copy'
                                      title='Save preset copy'
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onClone(preset)
                                      }}
                                    >
                                      <span aria-hidden>⧉</span>
                                    </button>
                                  )}
                                  {!preset.isGallery && onDeletePreset && (canDeletePreset?.(preset) ?? true) && (
                                    <button
                                      type='button'
                                      className={clsx(styles.actionButton, styles.actionDanger)}
                                      aria-label='Delete preset'
                                      title='Delete preset'
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onDeletePreset(preset)
                                      }}
                                    >
                                      <span aria-hidden>×</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {presetListProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          )}
        </Draggable>
      )
    })

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId='folder-list' type='FOLDER'>
        {(folderListProvided) => (
          <div
            ref={folderListProvided.innerRef}
            {...folderListProvided.droppableProps}
            className={styles.tree}
            data-tree-root='true'
          >
            {folderContent(nodes)}
            {folderListProvided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

export default PresetTree
