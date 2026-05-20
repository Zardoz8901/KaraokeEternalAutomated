import type { OrchestratorCapabilities } from '../components/orchestratorCapabilities'

export type OrchestratorWorkspaceMode = 'host' | 'operator' | 'browse' | 'blocked'
export type OrchestratorDesktopLayout = 'hostSplit' | 'operatorStageExpanded'
export type OrchestratorDesktopPanel = 'presets' | 'api'
export type OrchestratorMobileTab = 'stage' | 'code' | 'ref'

export interface OrchestratorShellModel {
  workspaceMode: OrchestratorWorkspaceMode
  desktopLayout: OrchestratorDesktopLayout
  visibleDesktopPanels: OrchestratorDesktopPanel[]
  visibleMobileTabs: OrchestratorMobileTab[]
  defaultDesktopTab: OrchestratorDesktopPanel
  defaultMobileTab: OrchestratorMobileTab
  statusAuthorityLabel: string
  canExitToLibrary: boolean
}

type ShellCapabilities = Pick<
  OrchestratorCapabilities,
  'canUseOrchestrator' | 'canLiveCode' | 'canSendSavedPresetsByPolicy'
>

export function getOrchestratorShellModel (capabilities: ShellCapabilities): OrchestratorShellModel {
  if (!capabilities.canUseOrchestrator) {
    return makePresetOnlyModel('blocked', 'Policy blocked')
  }

  if (capabilities.canLiveCode) {
    return {
      workspaceMode: 'host',
      desktopLayout: 'hostSplit',
      visibleDesktopPanels: ['presets', 'api'],
      visibleMobileTabs: ['stage', 'code', 'ref'],
      defaultDesktopTab: 'presets',
      defaultMobileTab: 'stage',
      statusAuthorityLabel: 'Host live coding',
      canExitToLibrary: true,
    }
  }

  if (capabilities.canSendSavedPresetsByPolicy) {
    return makePresetOnlyModel('operator', 'Preset operator')
  }

  return makePresetOnlyModel('browse', 'Browse only')
}

export function normalizeDesktopPanel (
  panel: OrchestratorDesktopPanel,
  model: OrchestratorShellModel,
): OrchestratorDesktopPanel {
  return model.visibleDesktopPanels.includes(panel) ? panel : model.defaultDesktopTab
}

export function normalizeMobileTab (
  tab: OrchestratorMobileTab,
  model: OrchestratorShellModel,
): OrchestratorMobileTab {
  return model.visibleMobileTabs.includes(tab) ? tab : model.defaultMobileTab
}

function makePresetOnlyModel (
  workspaceMode: Exclude<OrchestratorWorkspaceMode, 'host'>,
  statusAuthorityLabel: string,
): OrchestratorShellModel {
  return {
    workspaceMode,
    desktopLayout: 'operatorStageExpanded',
    visibleDesktopPanels: ['presets'],
    visibleMobileTabs: ['stage', 'ref'],
    defaultDesktopTab: 'presets',
    defaultMobileTab: 'stage',
    statusAuthorityLabel,
    canExitToLibrary: true,
  }
}
