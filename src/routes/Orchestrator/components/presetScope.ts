import type { IRoomPrefs } from 'shared/types'
import type { PresetTreeNode } from './presetTree'

interface PresetScopeOptions {
  isPrivileged: boolean
  roomPrefs?: Partial<IRoomPrefs> | null
}

export function scopePresetTreeForRoom (nodes: PresetTreeNode[], options: PresetScopeOptions): PresetTreeNode[] {
  // Phase 6 keeps browsing/local preview broad; send restrictions are explained per row.
  void options
  return nodes
}
