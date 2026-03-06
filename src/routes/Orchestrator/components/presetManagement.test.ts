import { describe, expect, it } from 'vitest'
import type { IRoomPrefs } from 'shared/types'
import type { PresetFolder } from './presetTree'
import {
  getDefaultSaveFolderId,
  reorderByDirection,
  reorderByDragIndices,
  parseFolderIdFromDroppableId,
  toSortOrderUpdates,
} from './presetManagement'

describe('presetManagement', () => {
  const folders: PresetFolder[] = [
    { folderId: 1, name: 'A', authorUserId: 1, authorName: 'A', sortOrder: 0 },
    { folderId: 2, name: 'B', authorUserId: 1, authorName: 'A', sortOrder: 1 },
    { folderId: 3, name: 'C', authorUserId: 1, authorName: 'A', sortOrder: 2 },
  ]

  it('prefers room party preset folder as save default when valid', () => {
    const prefs: Partial<IRoomPrefs> = {
      partyPresetFolderId: 2,
      restrictCollaboratorsToPartyPresetFolder: true,
    }

    expect(getDefaultSaveFolderId(folders, prefs)).toBe(2)
  })

  it('falls back to first folder when room party folder is missing', () => {
    const prefs: Partial<IRoomPrefs> = {
      partyPresetFolderId: 999,
      restrictCollaboratorsToPartyPresetFolder: true,
    }

    expect(getDefaultSaveFolderId(folders, prefs)).toBe(1)
  })

  it('reorders list upward and returns updated sort order patch set', () => {
    const next = reorderByDirection([1, 2, 3], 2, 'up')
    expect(next).toEqual([2, 1, 3])
    expect(toSortOrderUpdates(next)).toEqual([
      { id: 2, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
      { id: 3, sortOrder: 2 },
    ])
  })

  it('returns null when moving first item up or unknown item', () => {
    expect(reorderByDirection([1, 2, 3], 1, 'up')).toBeNull()
    expect(reorderByDirection([1, 2, 3], 999, 'down')).toBeNull()
  })

  describe('reorderByDragIndices', () => {
    it('moves item forward', () => {
      expect(reorderByDragIndices([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    })

    it('moves item backward', () => {
      expect(reorderByDragIndices([1, 2, 3], 2, 0)).toEqual([3, 1, 2])
    })

    it('returns null when indices are the same', () => {
      expect(reorderByDragIndices([1, 2, 3], 1, 1)).toBeNull()
    })

    it('returns null for single-item list with same index', () => {
      expect(reorderByDragIndices([1], 0, 0)).toBeNull()
    })
  })

  describe('parseFolderIdFromDroppableId', () => {
    it('extracts folder id from valid droppableId', () => {
      expect(parseFolderIdFromDroppableId('presets:folder:123')).toBe(123)
    })

    it('returns null for gallery droppableId', () => {
      expect(parseFolderIdFromDroppableId('presets:gallery')).toBeNull()
    })

    it('returns null for folder-list droppableId', () => {
      expect(parseFolderIdFromDroppableId('folder-list')).toBeNull()
    })

    it('returns null for malformed input', () => {
      expect(parseFolderIdFromDroppableId('presets:folder:abc')).toBeNull()
      expect(parseFolderIdFromDroppableId('')).toBeNull()
    })
  })
})
