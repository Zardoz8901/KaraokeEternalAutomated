import type { PlayerVisualizerState } from 'routes/Player/modules/playerVisualizer'
import type { VisualizerMode } from 'shared/types'
import type { OrchestratorCapabilities } from '../components/orchestratorCapabilities'
import {
  getEffectiveCode,
  resolvePreviewHydraState,
  shouldShowUnsentDot,
  type PreviewHydraState,
} from './orchestratorViewHelpers'
import {
  getOrchestratorShellModel,
  normalizeDesktopPanel,
  normalizeMobileTab,
  type OrchestratorDesktopPanel,
  type OrchestratorMobileTab,
  type OrchestratorShellModel,
} from './orchestratorShellModel'
import { getPreviewSize, type PreviewSize } from './orchestratorLayout'

interface RemoteVisualizerSource {
  hydraCode?: string
  hydraPresetIndex?: number
  hasHydraUpdate?: boolean
  mode?: VisualizerMode
  isEnabled?: boolean
  sensitivity?: number
  allowCamera?: boolean
}

export interface RemoteHydraSnapshot {
  hasHydraUpdate: boolean
  remoteHydraCode: string | undefined
  remotePresetIndex: number | undefined
  previewHydraState: PreviewHydraState
}

export interface OrchestratorWorkspaceModelInput {
  capabilities: Pick<OrchestratorCapabilities, 'canUseOrchestrator' | 'canLiveCode' | 'canSendSavedPresetsByPolicy'>
  activeDesktopPanel: OrchestratorDesktopPanel
  activeMobileTab: OrchestratorMobileTab
  innerWidth: number
}

export interface OrchestratorWorkspaceModel {
  shellModel: OrchestratorShellModel
  activeDesktopPanel: OrchestratorDesktopPanel
  activeMobilePanel: OrchestratorMobileTab
  canShowApiPanel: boolean
  canShowCodePanel: boolean
  isMobile: boolean
  previewSize: PreviewSize
}

export interface EffectiveWorkspaceCodeInput {
  localCode: string
  debouncedCode: string
  remoteHydraCode: string | null | undefined
  userHasEdited: boolean
}

export function getRemoteHydraSnapshot (
  playerVisualizer: RemoteVisualizerSource | null | undefined,
  statusVisualizer: Partial<PlayerVisualizerState> | RemoteVisualizerSource | null | undefined,
): RemoteHydraSnapshot {
  const hasHydraUpdate = playerVisualizer?.hasHydraUpdate === true

  return {
    hasHydraUpdate,
    remoteHydraCode: hasHydraUpdate
      ? playerVisualizer?.hydraCode
      : statusVisualizer?.hydraCode,
    remotePresetIndex: hasHydraUpdate
      ? playerVisualizer?.hydraPresetIndex
      : statusVisualizer?.hydraPresetIndex,
    previewHydraState: resolvePreviewHydraState(hasHydraUpdate, playerVisualizer, statusVisualizer),
  }
}

export function getOrchestratorWorkspaceModel ({
  capabilities,
  activeDesktopPanel,
  activeMobileTab,
  innerWidth,
}: OrchestratorWorkspaceModelInput): OrchestratorWorkspaceModel {
  const shellModel = getOrchestratorShellModel(capabilities)
  const normalizedDesktopPanel = normalizeDesktopPanel(activeDesktopPanel, shellModel)
  const normalizedMobilePanel = normalizeMobileTab(activeMobileTab, shellModel)

  return {
    shellModel,
    activeDesktopPanel: normalizedDesktopPanel,
    activeMobilePanel: normalizedMobilePanel,
    canShowApiPanel: shellModel.visibleDesktopPanels.includes('api'),
    canShowCodePanel: shellModel.visibleMobileTabs.includes('code'),
    isMobile: innerWidth < 980,
    previewSize: getPreviewSize(innerWidth),
  }
}

export function getEffectiveWorkspaceCode ({
  localCode,
  debouncedCode,
  remoteHydraCode,
  userHasEdited,
}: EffectiveWorkspaceCodeInput): string {
  return getEffectiveCode(
    userHasEdited ? debouncedCode : localCode,
    remoteHydraCode,
    userHasEdited,
  )
}

export { shouldShowUnsentDot }
