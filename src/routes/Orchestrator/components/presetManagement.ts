import type { IRoomPrefs } from 'shared/types'
import type { PresetFolder } from './presetTree'

export type MoveDirection = 'up' | 'down'

export function getDefaultSaveFolderId (
  folders: PresetFolder[],
  roomPrefs?: Partial<IRoomPrefs> | null,
): number | '' {
  if (folders.length === 0) return ''

  const scopedFolderId = roomPrefs?.partyPresetFolderId
  if (typeof scopedFolderId === 'number' && folders.some(folder => folder.folderId === scopedFolderId)) {
    return scopedFolderId
  }

  return folders[0].folderId
}

export function reorderByDirection (ids: number[], id: number, direction: MoveDirection): number[] | null {
  const currentIndex = ids.indexOf(id)
  if (currentIndex < 0) return null

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= ids.length) return null

  const next = ids.slice()
  const [item] = next.splice(currentIndex, 1)
  next.splice(targetIndex, 0, item)
  return next
}

export function reorderByDragIndices (ids: number[], sourceIndex: number, destIndex: number): number[] | null {
  if (sourceIndex === destIndex) return null
  const result = [...ids]
  const [removed] = result.splice(sourceIndex, 1)
  result.splice(destIndex, 0, removed)
  return result
}

export function parseFolderIdFromDroppableId (droppableId: string): number | null {
  const match = droppableId.match(/^presets:folder:(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

export function toSortOrderUpdates (ids: number[]): Array<{ id: number, sortOrder: number }> {
  return ids.map((id, index) => ({ id, sortOrder: index }))
}
