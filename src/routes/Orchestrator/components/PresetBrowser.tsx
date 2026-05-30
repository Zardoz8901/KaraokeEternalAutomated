import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import Modal from 'components/Modal/Modal'
import Button from 'components/Button/Button'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchCurrentRoom } from 'store/modules/rooms'
import { ROOM_PREFS_PUSH } from 'shared/actionTypes'
import { HYDRA_GALLERY } from './hydraGallery'
import PresetTree from './PresetTree'
import { buildPresetTree, type PresetLeaf, type PresetTreeNode, type PresetFolder, type PresetItem } from './presetTree'
import { getOrchestratorCapabilities } from './orchestratorCapabilities'
import {
  collectPresetKeys,
  getAppliedPresetKey,
  getPresetKey,
  getPresetPanelNotice,
  getPresetRowUx,
  getPresetToolbarUx,
  type PresetKey,
} from './presetOperatorUx'
import { scopePresetTreeForRoom } from './presetScope'
import { buildPresetDraft } from './presetDraft'
import { countPresetLeaves, getPresetPanelState, ROOM_EMPTY_PRESET_PANEL_MESSAGE } from './presetEmptyState'
import type { DropResult } from '@hello-pangea/dnd'
import { getDefaultSaveFolderId, reorderByDragIndices, parseFolderIdFromDroppableId, toSortOrderUpdates } from './presetManagement'
import {
  fetchAllPresets,
  fetchFolders,
  createFolder,
  createPreset,
  reorderFolders,
  reorderPresets,
  updateFolder,
  updatePreset,
  deleteFolder,
  deletePreset,
} from '../api/hydraPresetsApi'
import { updateMyRoomPrefs } from '../api/roomPrefsApi'
import styles from './PresetBrowser.css'

interface PresetBrowserProps {
  currentCode: string
  onLoad: (code: string) => void
  onSend: (preset: PresetLeaf) => void
}

type PendingDelete = { type: 'preset', preset: PresetLeaf } | { type: 'folder', folder: PresetTreeNode } | null

type PendingRename = { type: 'preset', preset: PresetLeaf } | { type: 'folder', folder: PresetTreeNode } | null

function toErrorMessage (err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

function PresetBrowser ({ currentCode, onLoad, onSend }: PresetBrowserProps) {
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.user)
  const currentRoomPrefs = useAppSelector((state) => {
    if (typeof state.user.roomId !== 'number') return undefined
    return state.rooms.entities[state.user.roomId]?.prefs
  })
  const appliedVisualizer = useAppSelector(state => state.status.visualizerApplied)
  const acceptedVisualizerRunId = useAppSelector(state => state.status.visualizer?.visualizerRunId ?? null)
  const orchestratorCapabilities = useMemo(() => getOrchestratorCapabilities(user, currentRoomPrefs), [
    currentRoomPrefs,
    user,
  ])
  const isPrivilegedPresetUser = orchestratorCapabilities.isManager
  const canUsePresetManagement = orchestratorCapabilities.isManager
  const canManageRoomPolicy = orchestratorCapabilities.canManageRoomVisualPolicy
  const toolbarUx = useMemo(() => getPresetToolbarUx(orchestratorCapabilities), [orchestratorCapabilities])
  const startingPresetId = typeof currentRoomPrefs?.startingPresetId === 'number'
    ? currentRoomPrefs.startingPresetId
    : null
  const playerPresetFolderId = typeof currentRoomPrefs?.playerPresetFolderId === 'number'
    ? currentRoomPrefs.playerPresetFolderId
    : null

  const [folders, setFolders] = useState<PresetFolder[]>([])
  const [presets, setPresets] = useState<PresetItem[]>([])
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['gallery']))
  const [selectedPresetKey, setSelectedPresetKey] = useState<PresetKey | null>(null)
  const [loadedPreviewPresetKey, setLoadedPreviewPresetKey] = useState<PresetKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [presetName, setPresetName] = useState('')
  const [presetFolderId, setPresetFolderId] = useState<number | ''>('')
  const [draftCode, setDraftCode] = useState('')

  const [savingFolder, setSavingFolder] = useState(false)
  const [savingPreset, setSavingPreset] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleting, setDeleting] = useState(false)

  const [pendingRename, setPendingRename] = useState<PendingRename>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [updatingRoomPresetPolicy, setUpdatingRoomPresetPolicy] = useState(false)

  const [pendingMove, setPendingMove] = useState<PresetLeaf | null>(null)
  const [moveFolderId, setMoveFolderId] = useState<number | ''>('')
  const [moving, setMoving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (canUsePresetManagement) return
    setShowNewFolder(false)
    setShowSavePreset(false)
    setPendingDelete(null)
    setPendingRename(null)
    setPendingMove(null)
  }, [canUsePresetManagement])

  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setRefreshing(true)
      setError(null)
      const [folderList, presetList] = await Promise.all([
        fetchFolders(),
        fetchAllPresets(),
      ])
      setFolders(folderList)
      setPresets(presetList)
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load presets'))
    } finally {
      if (!silent) setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const tree = useMemo(
    () => {
      const rawTree = buildPresetTree(folders, presets, HYDRA_GALLERY)
      return scopePresetTreeForRoom(rawTree, {
        isPrivileged: isPrivilegedPresetUser,
        roomPrefs: currentRoomPrefs,
      })
    },
    [folders, presets, isPrivilegedPresetUser, currentRoomPrefs],
  )

  const visiblePresetKeys = useMemo(() => collectPresetKeys(tree), [tree])
  const appliedPresetKey = useMemo(
    () => getAppliedPresetKey(appliedVisualizer, acceptedVisualizerRunId),
    [appliedVisualizer, acceptedVisualizerRunId],
  )

  useEffect(() => {
    setSelectedPresetKey(prev => (prev !== null && !visiblePresetKeys.has(prev) ? null : prev))
    setLoadedPreviewPresetKey(prev => (prev !== null && !visiblePresetKeys.has(prev) ? null : prev))
  }, [visiblePresetKeys])

  const selectedPreset = useMemo(() => {
    if (selectedPresetKey === null) return null
    for (const node of tree) {
      for (const child of node.children) {
        if (getPresetKey(child) === selectedPresetKey) return child
      }
    }
    return null
  }, [tree, selectedPresetKey])

  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tree
    return tree
      .map(node => ({
        ...node,
        children: node.children.filter(child => child.name.toLowerCase().includes(q)),
      }))
      .filter(node => node.children.length > 0)
  }, [tree, query])

  const scopedPresetCount = useMemo(() => countPresetLeaves(tree), [tree])
  const presetPanelState = useMemo(() => getPresetPanelState({
    query,
    visibleTreeCount: filteredTree.length,
    scopedPresetCount,
    isRestrictedToPartyPresetFolder: orchestratorCapabilities.isRestrictedToPartyPresetFolder,
    partyPresetFolderId: orchestratorCapabilities.partyPresetFolderId,
    canSendSavedPresetsByPolicy: orchestratorCapabilities.canSendSavedPresetsByPolicy,
  }), [
    filteredTree.length,
    orchestratorCapabilities.canSendSavedPresetsByPolicy,
    orchestratorCapabilities.isRestrictedToPartyPresetFolder,
    orchestratorCapabilities.partyPresetFolderId,
    query,
    scopedPresetCount,
  ])
  const presetPanelNotice = useMemo(
    () => getPresetPanelNotice(orchestratorCapabilities),
    [orchestratorCapabilities],
  )
  const getPresetRowUxModel = useCallback(
    (preset: PresetLeaf) => getPresetRowUx(preset, orchestratorCapabilities),
    [orchestratorCapabilities],
  )

  const toggleFolder = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleLoad = useCallback((preset: PresetLeaf) => {
    const presetKey = getPresetKey(preset)
    setSelectedPresetKey(presetKey)
    setLoadedPreviewPresetKey(presetKey)
    onLoad(preset.code)
  }, [onLoad])

  const handleSend = useCallback((preset: PresetLeaf) => {
    if (!orchestratorCapabilities.canSendPreset(preset)) return
    setSelectedPresetKey(getPresetKey(preset))
    onSend(preset)
  }, [onSend, orchestratorCapabilities])

  const canDeletePreset = useCallback((preset: PresetLeaf) => {
    if (!canUsePresetManagement) return false
    if (preset.isGallery) return false
    if (user.isAdmin) return true
    return preset.authorUserId === user.userId
  }, [canUsePresetManagement, user])

  const canDeleteFolder = useCallback((node: PresetTreeNode) => {
    if (!canUsePresetManagement) return false
    if (node.isGallery) return false
    if (user.isAdmin) return true
    return node.authorUserId === user.userId
  }, [canUsePresetManagement, user])

  const canManagePreset = canDeletePreset
  const canManageFolder = canDeleteFolder

  const canSetStartingPreset = useCallback((preset: PresetLeaf) => {
    if (!canManageRoomPolicy) return false
    return preset.isGallery === false && typeof preset.presetId === 'number'
  }, [canManageRoomPolicy])

  const canSetPlayerPresetFolder = useCallback((folder: PresetTreeNode) => {
    if (!canManageRoomPolicy) return false
    return folder.isGallery === false && typeof folder.folderId === 'number'
  }, [canManageRoomPolicy])

  const requestDeletePreset = useCallback((preset: PresetLeaf) => {
    if (!canDeletePreset(preset)) return
    if (!preset.presetId) return
    setPendingDelete({ type: 'preset', preset })
  }, [canDeletePreset])

  const requestDeleteFolder = useCallback((node: PresetTreeNode) => {
    if (!canDeleteFolder(node)) return
    if (!node.folderId) return
    setPendingDelete({ type: 'folder', folder: node })
  }, [canDeleteFolder])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deleting) return

    try {
      setDeleting(true)
      setError(null)

      if (pendingDelete.type === 'preset') {
        if (!pendingDelete.preset.presetId) return
        await deletePreset(pendingDelete.preset.presetId)
      } else {
        if (!pendingDelete.folder.folderId) return
        await deleteFolder(pendingDelete.folder.folderId)
      }

      setPendingDelete(null)
      await refresh()
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to delete item'))
    } finally {
      setDeleting(false)
    }
  }, [pendingDelete, deleting, refresh])

  const requestRenamePreset = useCallback((preset: PresetLeaf) => {
    if (!canManagePreset(preset)) return
    if (!preset.presetId) return
    setPendingRename({ type: 'preset', preset })
    setRenameValue(preset.name)
  }, [canManagePreset])

  const requestRenameFolder = useCallback((folder: PresetTreeNode) => {
    if (!canManageFolder(folder)) return
    if (!folder.folderId || folder.isGallery) return
    setPendingRename({ type: 'folder', folder })
    setRenameValue(folder.name)
  }, [canManageFolder])

  const confirmRename = useCallback(async () => {
    const name = renameValue.trim()
    if (!pendingRename || !name || renaming) return

    try {
      setRenaming(true)
      setError(null)

      if (pendingRename.type === 'preset') {
        if (!pendingRename.preset.presetId) return
        await updatePreset(pendingRename.preset.presetId, { name })
      } else {
        if (!pendingRename.folder.folderId) return
        await updateFolder(pendingRename.folder.folderId, { name })
      }

      setPendingRename(null)
      setRenameValue('')
      await refresh()
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to rename item'))
    } finally {
      setRenaming(false)
    }
  }, [pendingRename, renameValue, renaming, refresh])

  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!canUsePresetManagement) return
    if (!result.destination) return
    const { source, destination, type } = result

    if (type === 'FOLDER') {
      // Gallery nodes occupy DnD indices but aren't in orderedFolderIds
      const galleryCount = filteredTree.filter(n => n.isGallery).length
      const srcIdx = source.index - galleryCount
      const dstIdx = destination.index - galleryCount
      if (srcIdx < 0 || dstIdx < 0) return

      const orderedFolderIds = folders
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.folderId - b.folderId)
        .map(item => item.folderId)

      const reordered = reorderByDragIndices(orderedFolderIds, srcIdx, dstIdx)
      if (!reordered) return

      const updates = toSortOrderUpdates(reordered)
      const sortMap = new Map(updates.map(u => [u.id, u.sortOrder]))
      // flushSync must be synchronous (before any await) so DnD sees updated DOM
      flushSync(() => {
        setFolders(prev => prev.map((f) => {
          const newSort = sortMap.get(f.folderId)
          return newSort !== undefined ? { ...f, sortOrder: newSort } : f
        }))
      })

      try {
        setError(null)
        await reorderFolders(updates)
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to reorder folders'))
        await refresh({ silent: true })
      }
    }

    if (type === 'PRESET') {
      if (source.droppableId !== destination.droppableId) return

      const folderId = parseFolderIdFromDroppableId(source.droppableId)
      if (folderId === null) return

      const orderedPresetIds = presets
        .filter(item => item.folderId === folderId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.presetId - b.presetId)
        .map(item => item.presetId)

      const reordered = reorderByDragIndices(orderedPresetIds, source.index, destination.index)
      if (!reordered) return

      const updates = toSortOrderUpdates(reordered)
      const sortMap = new Map(updates.map(u => [u.id, u.sortOrder]))
      // flushSync must be synchronous (before any await) so DnD sees updated DOM
      flushSync(() => {
        setPresets(prev => prev.map((p) => {
          const newSort = sortMap.get(p.presetId)
          return newSort !== undefined ? { ...p, sortOrder: newSort } : p
        }))
      })

      try {
        setError(null)
        await reorderPresets(updates)
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to reorder presets'))
        await refresh({ silent: true })
      }
    }
  }, [canUsePresetManagement, folders, presets, filteredTree, refresh])

  const openSavePreset = useCallback((preset?: PresetLeaf) => {
    if (!canUsePresetManagement) return
    const draft = buildPresetDraft({ currentCode, preset })

    if (preset?.folderId && folders.some(folder => folder.folderId === preset.folderId)) {
      setPresetFolderId(preset.folderId)
    } else {
      setPresetFolderId(getDefaultSaveFolderId(folders, currentRoomPrefs))
    }

    setPresetName(draft.name)
    setDraftCode(draft.code)
    setShowSavePreset(true)
  }, [canUsePresetManagement, currentCode, folders, currentRoomPrefs])

  const handleClonePreset = useCallback((preset: PresetLeaf) => {
    openSavePreset(preset)
  }, [openSavePreset])

  const handleCreateFolder = useCallback(async () => {
    if (!canUsePresetManagement) return
    const name = newFolderName.trim()
    if (!name || savingFolder) return

    try {
      setSavingFolder(true)
      setError(null)
      const created = await createFolder(name)
      setExpanded(prev => new Set(prev).add(`folder:${created.folderId}`))
      setShowNewFolder(false)
      setNewFolderName('')
      await refresh()
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to create folder'))
    } finally {
      setSavingFolder(false)
    }
  }, [canUsePresetManagement, newFolderName, refresh, savingFolder])

  const handleSavePreset = useCallback(async () => {
    if (!canUsePresetManagement) return
    const name = presetName.trim()
    if (!name || !presetFolderId || savingPreset) return

    try {
      setSavingPreset(true)
      setError(null)

      const created = await createPreset({
        folderId: presetFolderId,
        name,
        code: draftCode,
      })

      setExpanded(prev => new Set(prev).add(`folder:${presetFolderId}`))
      setSelectedPresetKey(getPresetKey({
        id: `preset:${created.presetId}`,
        presetId: created.presetId,
        folderId: created.folderId,
        name: created.name,
        code: created.code,
        isGallery: false,
        usesCamera: false,
      }))
      setShowSavePreset(false)
      setPresetName('')
      setDraftCode('')
      await refresh()
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to save preset'))
    } finally {
      setSavingPreset(false)
    }
  }, [canUsePresetManagement, presetName, presetFolderId, draftCode, refresh, savingPreset])

  const handleOverwritePreset = useCallback(async () => {
    if (!canUsePresetManagement) return
    if (!selectedPreset || !selectedPreset.presetId || selectedPreset.isGallery || savingPreset) return

    try {
      setSavingPreset(true)
      setError(null)
      await updatePreset(selectedPreset.presetId, { code: draftCode })
      setShowSavePreset(false)
      setDraftCode('')
      await refresh()
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to overwrite preset'))
    } finally {
      setSavingPreset(false)
    }
  }, [canUsePresetManagement, selectedPreset, draftCode, refresh, savingPreset])

  const handleSetStartingPreset = useCallback(async (preset: PresetLeaf) => {
    if (!canManageRoomPolicy || preset.isGallery || !preset.presetId) return

    const nextStartingPresetId = startingPresetId === preset.presetId ? null : preset.presetId

    try {
      setUpdatingRoomPresetPolicy(true)
      setError(null)
      const res = await updateMyRoomPrefs({ startingPresetId: nextStartingPresetId })
      if (res.room?.prefs) {
        dispatch({ type: ROOM_PREFS_PUSH, payload: { roomId: res.room.roomId, prefs: res.room.prefs } })
      } else {
        await dispatch(fetchCurrentRoom())
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to update starting visual'))
    } finally {
      setUpdatingRoomPresetPolicy(false)
    }
  }, [canManageRoomPolicy, startingPresetId, dispatch])

  const handleSetPlayerPresetFolder = useCallback(async (folder: PresetTreeNode) => {
    if (!canManageRoomPolicy || folder.isGallery || !folder.folderId) return

    const nextPlayerPresetFolderId = playerPresetFolderId === folder.folderId ? null : folder.folderId

    try {
      setUpdatingRoomPresetPolicy(true)
      setError(null)
      const res = await updateMyRoomPrefs({ playerPresetFolderId: nextPlayerPresetFolderId })
      if (res.room?.prefs) {
        dispatch({ type: ROOM_PREFS_PUSH, payload: { roomId: res.room.roomId, prefs: res.room.prefs } })
      } else {
        await dispatch(fetchCurrentRoom())
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to update player preset folder'))
    } finally {
      setUpdatingRoomPresetPolicy(false)
    }
  }, [canManageRoomPolicy, playerPresetFolderId, dispatch])

  const requestMoveToFolder = useCallback((preset: PresetLeaf) => {
    if (!canManagePreset(preset)) return
    if (!preset.presetId || preset.isGallery) return
    setPendingMove(preset)
    setMoveFolderId('')
  }, [canManagePreset])

  const confirmMoveToFolder = useCallback(async () => {
    if (!pendingMove?.presetId || !moveFolderId || moving) return
    try {
      setMoving(true)
      setError(null)
      await updatePreset(pendingMove.presetId, { folderId: moveFolderId })
      setPendingMove(null)
      await refresh({ silent: true })
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to move preset'))
    } finally {
      setMoving(false)
    }
  }, [pendingMove, moveFolderId, moving, refresh])

  const movableFolders = useMemo(() => {
    if (!pendingMove) return []
    return folders.filter(f =>
      f.folderId !== pendingMove.folderId
      && (user.isAdmin || f.authorUserId === user.userId),
    )
  }, [folders, pendingMove, user.isAdmin, user.userId])

  let savePresetBody: React.ReactNode
  if (folders.length === 0) {
    savePresetBody = <div className={styles.empty}>Create a folder first.</div>
  } else {
    savePresetBody = (
      <>
        <label className={styles.modalLabel}>
          Preset name
          <input
            className={styles.modalInput}
            type='text'
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            autoFocus
          />
        </label>
        <label className={styles.modalLabel}>
          Folder
          <select
            className={styles.modalSelect}
            value={presetFolderId}
            onChange={e => setPresetFolderId(Number(e.target.value))}
          >
            {folders.map(folder => (
              <option key={folder.folderId} value={folder.folderId}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.modalLabel}>
          Code preview
          <textarea
            className={styles.modalCodePreview}
            value={draftCode}
            readOnly
            rows={10}
            spellCheck={false}
          />
        </label>
      </>
    )
  }

  const deleteModalTitle = pendingDelete?.type === 'folder' ? 'Delete Folder' : 'Delete Preset'
  const deleteModalText = pendingDelete?.type === 'folder'
    ? `Delete folder "${pendingDelete.folder.name}" and all presets inside?`
    : pendingDelete?.type === 'preset'
      ? `Delete preset "${pendingDelete.preset.name}"?`
      : ''

  const renameModalTitle = pendingRename?.type === 'folder' ? 'Rename Folder' : 'Rename Preset'
  const renameModalLabel = pendingRename?.type === 'folder' ? 'Folder name' : 'Preset name'

  return (
    <div className={styles.panel}>
      {toolbarUx.showManagementToolbar && (
        <div className={styles.toolbar}>
          {toolbarUx.showNewFolder && (
            <button type='button' className={styles.toolbarButton} onClick={() => setShowNewFolder(true)}>
              New Folder
            </button>
          )}
          {toolbarUx.showSavePreset && (
            <button type='button' className={styles.toolbarButtonPrimary} onClick={() => openSavePreset()}>
              Save Preset
            </button>
          )}
          {updatingRoomPresetPolicy && <span className={styles.toolbarHint}>Updating room presets...</span>}
        </div>
      )}

      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          type='text'
          placeholder='Search presets...'
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query.length > 0 && (
          <button
            type='button'
            className={styles.searchClear}
            onClick={() => setQuery('')}
            aria-label='Clear preset search'
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className={styles.loading} role='status' aria-live='polite'>
          <div className={styles.loadingLabel}>Loading presets...</div>
          <div className={styles.skeletonList}>
            {[0, 1, 2].map(group => (
              <div key={group} className={styles.skeletonGroup}>
                <div className={styles.skeletonFolder} />
                <div className={styles.skeletonItem} />
                <div className={styles.skeletonItemShort} />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && presetPanelNotice && (
        <div className={styles.policyNotice}>{presetPanelNotice.message}</div>
      )}

      {!loading && !error && filteredTree.length === 0 && (
        <div className={styles.empty}>{presetPanelState?.message ?? ROOM_EMPTY_PRESET_PANEL_MESSAGE}</div>
      )}

      {!loading && !error && filteredTree.length > 0 && (
        <PresetTree
          nodes={filteredTree}
          expanded={expanded}
          selectedPresetKey={selectedPresetKey}
          loadedPreviewPresetKey={loadedPreviewPresetKey}
          appliedPresetKey={appliedPresetKey}
          startingPresetId={startingPresetId}
          playerPresetFolderId={playerPresetFolderId}
          isDndEnabled={query === '' && !refreshing && canUsePresetManagement}
          onToggleFolder={toggleFolder}
          onLoad={handleLoad}
          onSend={handleSend}
          onClone={handleClonePreset}
          onDeletePreset={requestDeletePreset}
          onDeleteFolder={requestDeleteFolder}
          onRenamePreset={requestRenamePreset}
          onRenameFolder={requestRenameFolder}
          onDragEnd={handleDragEnd}
          onSetStartingPreset={handleSetStartingPreset}
          onSetPlayerPresetFolder={handleSetPlayerPresetFolder}
          onMoveToFolder={requestMoveToFolder}
          canDeletePreset={canDeletePreset}
          canDeleteFolder={canDeleteFolder}
          canManagePreset={canManagePreset}
          canManageFolder={canManageFolder}
          canSendPreset={orchestratorCapabilities.canSendPreset}
          canSetStartingPreset={canSetStartingPreset}
          canSetPlayerPresetFolder={canSetPlayerPresetFolder}
          getPresetRowUx={getPresetRowUxModel}
        />
      )}

      <Modal
        title='New Folder'
        className={styles.orchestratorModal}
        visible={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        buttons={(
          <>
            <Button variant='default' onClick={() => setShowNewFolder(false)} disabled={savingFolder}>Cancel</Button>
            <Button variant='primary' onClick={handleCreateFolder} disabled={savingFolder || !newFolderName.trim()}>
              {savingFolder ? 'Creating...' : 'Create'}
            </Button>
          </>
        )}
      >
        <label className={styles.modalLabel}>
          Folder name
          <input
            className={styles.modalInput}
            type='text'
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        title='Save Preset'
        className={styles.orchestratorModal}
        visible={showSavePreset}
        onClose={() => setShowSavePreset(false)}
        buttons={(
          <>
            <Button variant='default' onClick={() => setShowSavePreset(false)} disabled={savingPreset}>Cancel</Button>
            {selectedPreset && !selectedPreset.isGallery && selectedPreset.presetId && canManagePreset(selectedPreset) && (
              <Button
                variant='default'
                onClick={handleOverwritePreset}
                disabled={savingPreset}
              >
                {savingPreset ? 'Saving...' : `Overwrite "${selectedPreset.name}"`}
              </Button>
            )}
            <Button
              variant='primary'
              onClick={handleSavePreset}
              disabled={savingPreset || folders.length === 0 || !presetName.trim() || !presetFolderId}
            >
              {savingPreset ? 'Saving...' : 'Save as New'}
            </Button>
          </>
        )}
      >
        {savePresetBody}
      </Modal>

      <Modal
        title={renameModalTitle}
        className={styles.orchestratorModal}
        visible={pendingRename !== null}
        onClose={() => {
          setPendingRename(null)
          setRenameValue('')
        }}
        buttons={(
          <>
            <Button
              variant='default'
              onClick={() => {
                setPendingRename(null)
                setRenameValue('')
              }}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button variant='primary' onClick={confirmRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
      >
        <label className={styles.modalLabel}>
          {renameModalLabel}
          <input
            className={styles.modalInput}
            type='text'
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        title={deleteModalTitle}
        className={styles.orchestratorModal}
        visible={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        buttons={(
          <>
            <Button variant='default' onClick={() => setPendingDelete(null)} disabled={deleting}>Cancel</Button>
            <Button variant='danger' onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </>
        )}
      >
        <div className={styles.confirmText}>{deleteModalText}</div>
      </Modal>

      <Modal
        title='Move to Folder'
        className={styles.orchestratorModal}
        visible={pendingMove !== null}
        onClose={() => setPendingMove(null)}
        buttons={(
          <>
            <Button variant='default' onClick={() => setPendingMove(null)} disabled={moving}>Cancel</Button>
            <Button variant='primary' onClick={confirmMoveToFolder} disabled={moving || !moveFolderId}>
              {moving ? 'Moving...' : 'Move'}
            </Button>
          </>
        )}
      >
        {movableFolders.length === 0
          ? <div className={styles.empty}>No other folders available.</div>
          : (
              <label className={styles.modalLabel}>
                Destination folder
                <select
                  className={styles.modalSelect}
                  value={moveFolderId}
                  onChange={e => setMoveFolderId(Number(e.target.value))}
                >
                  <option value='' disabled>Select a folder...</option>
                  {movableFolders.map(f => (
                    <option key={f.folderId} value={f.folderId}>{f.name}</option>
                  ))}
                </select>
              </label>
            )}
      </Modal>
    </div>
  )
}

export default PresetBrowser
