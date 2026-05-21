import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import combinedReducer from 'store/reducers'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchCurrentRoom } from 'store/modules/rooms'
import { VISUALIZER_HYDRA_CODE_REQ } from 'shared/actionTypes'
import playerVisualizerReducer from 'routes/Player/modules/playerVisualizer'
import { sliceInjectNoOp } from 'routes/Player/modules/player'
import { useCameraSender } from 'lib/webrtc/useCameraSender'
import { useVisualViewport } from 'lib/useVisualViewport'
import { DEFAULT_SKETCH, getRandomSketch } from '../components/hydraSketchBook'
import type { PresetLeaf } from '../components/presetTree'
import { canSendHydraInput, getOrchestratorCapabilities, type OrchestratorCapabilities } from '../components/orchestratorCapabilities'
import { getPresetKey } from '../components/presetOperatorUx'
import { getOrchestratorStatusModel, type OrchestratorStatusModel } from '../components/orchestratorStatus'
import { type CameraRelayStatus } from '../components/hydraPreviewUtils'
import { type StageBuffer } from '../components/stagePanelUtils'
import {
  acknowledgeHydraRemote,
  clearHydraSendAfterEdit,
  expireHydraSend,
  INITIAL_ORCHESTRATOR_SEND_STATE,
  rejectHydraSend,
  resetSyncedHydraSend,
  startHydraSend,
  type OrchestratorSendState,
  type OrchestratorSendStatus,
  type SendHydraPayload,
} from './orchestratorSendState'
import {
  applyPendingRemote,
  applyPresetIndexRemoteUpdate,
  dismissPendingRemote,
  syncRemoteBeforeEdit,
  trackPendingRemoteUpdate,
  type OrchestratorRemoteState,
} from './orchestratorRemoteState'
import {
  getEffectiveWorkspaceCode,
  getOrchestratorWorkspaceModel,
  getRemoteHydraSnapshot,
  shouldShowUnsentDot,
  type OrchestratorWorkspaceModel,
} from './orchestratorWorkspaceModel'
import { type OrchestratorDesktopPanel, type OrchestratorMobileTab } from './orchestratorShellModel'
import {
  getPointerRefPanelWidth,
  getStoredRefPanelWidth,
  ORCHESTRATOR_REF_PANEL_STORAGE_KEY,
  serializeRefPanelWidth,
} from './orchestratorWorkspaceResize'

export interface WorkspacePresetBrowserProps {
  currentCode: string
  onLoad: (code: string) => void
  onSend: (preset: PresetLeaf) => void
}

export interface WorkspaceApiReferenceProps {
  onInsertExample: (code: string) => void
  onReplaceWithExample: (code: string) => void
}

export interface WorkspaceStagePanelProps {
  code: string
  width: number
  height: number
  buffer: StageBuffer
  onBufferChange: (buffer: StageBuffer) => void
  localCameraStream?: MediaStream | null
  onPresetLoad: (code: string) => void
  onPresetSend?: (preset: PresetLeaf) => void
  onRandomize: () => void
  visualizerMode: 'hydra' | 'off'
  visualizerEnabled: boolean
  visualizerSensitivity: number
  visualizerAllowCamera: boolean
  cameraRelayStatus: CameraRelayStatus
}

export interface WorkspaceCodeEditorProps {
  code: string
  onCodeChange: (code: string) => void
  onSend: (code: string) => void
  canSend: boolean
  sendStatus: OrchestratorSendStatus
  onResend: () => void
  onRandomize: () => void
  cameraStatus: CameraRelayStatus
  onCameraToggle: () => void
}

export interface UseOrchestratorWorkspaceResult {
  containerRef: RefObject<HTMLDivElement>
  containerStyle: CSSProperties
  workspaceModel: OrchestratorWorkspaceModel
  orchestratorCapabilities: OrchestratorCapabilities
  orchestratorStatusModel: OrchestratorStatusModel
  presetBrowserProps: WorkspacePresetBrowserProps
  apiReferenceProps: WorkspaceApiReferenceProps
  stagePanelProps: WorkspaceStagePanelProps
  codeEditorProps: WorkspaceCodeEditorProps
  activeDesktopPanel: OrchestratorDesktopPanel
  activeMobilePanel: OrchestratorMobileTab
  setActiveDesktopPanel: (panel: OrchestratorDesktopPanel) => void
  setActiveMobilePanel: (tab: OrchestratorMobileTab) => void
  isKeyboardOpen: boolean
  isMobile: boolean
  isRefOpen: boolean
  isResizingPanel: boolean
  startRefPanelResize: () => void
  pendingRemoteCode: string | null
  pendingRemoteCount: number
  handleApplyRemote: () => void
  handleDismissRemote: () => void
  showUnsentMobileDot: boolean
}

function getInitialRemoteState (): OrchestratorRemoteState {
  return {
    localCode: DEFAULT_SKETCH,
    debouncedCode: DEFAULT_SKETCH,
    userHasEdited: false,
    pendingRemoteCode: null,
    pendingRemoteCount: 0,
    prevRemoteCode: undefined,
    prevPresetIndex: undefined,
  }
}

function getInitialRefPanelWidth (): number {
  if (typeof window === 'undefined') return getStoredRefPanelWidth(null)
  return getStoredRefPanelWidth(window.localStorage.getItem(ORCHESTRATOR_REF_PANEL_STORAGE_KEY))
}

export function useOrchestratorWorkspace (): UseOrchestratorWorkspaceResult {
  const dispatch = useAppDispatch()
  const camera = useCameraSender()
  const playerVisualizer = useAppSelector(state => state.playerVisualizer)
  const status = useAppSelector(state => state.status)
  const user = useAppSelector(state => state.user)
  const ui = useAppSelector(state => state.ui)
  const currentRoomPrefs = useAppSelector((state) => {
    if (typeof state.user.roomId !== 'number') return undefined
    return state.rooms.entities[state.user.roomId]?.prefs
  })
  const { isKeyboardOpen } = useVisualViewport()
  const containerRef = useRef<HTMLDivElement>(null)
  const remoteSyncRafRef = useRef<number | null>(null)
  const [remoteState, setRemoteState] = useState<OrchestratorRemoteState>(getInitialRemoteState)
  const [sendState, setSendState] = useState<OrchestratorSendState>(INITIAL_ORCHESTRATOR_SEND_STATE)
  const [previewBuffer, setPreviewBuffer] = useState<StageBuffer>('auto')
  const [activeDesktopPanel, setActiveDesktopPanel] = useState<OrchestratorDesktopPanel>('presets')
  const [activeMobileTab, setActiveMobileTab] = useState<OrchestratorMobileTab>('stage')
  const [refPanelWidth, setRefPanelWidth] = useState<number>(getInitialRefPanelWidth)
  const [isResizingPanel, setIsResizingPanel] = useState(false)

  if (!playerVisualizer) {
    combinedReducer.inject({ reducerPath: 'playerVisualizer', reducer: playerVisualizerReducer })
    dispatch(sliceInjectNoOp())
  }

  const orchestratorCapabilities = useMemo(() => getOrchestratorCapabilities(user, currentRoomPrefs), [
    currentRoomPrefs,
    user,
  ])
  const workspaceModel = useMemo(() => getOrchestratorWorkspaceModel({
    capabilities: orchestratorCapabilities,
    activeDesktopPanel,
    activeMobileTab,
    innerWidth: ui.innerWidth,
  }), [
    activeDesktopPanel,
    activeMobileTab,
    orchestratorCapabilities,
    ui.innerWidth,
  ])
  const hydraSnapshot = useMemo(() => getRemoteHydraSnapshot(playerVisualizer, status.visualizer), [
    playerVisualizer,
    status.visualizer,
  ])

  const cancelPendingRemoteSync = useCallback(() => {
    if (remoteSyncRafRef.current !== null) {
      cancelAnimationFrame(remoteSyncRafRef.current)
      remoteSyncRafRef.current = null
    }
  }, [])

  const dispatchHydraPayload = useCallback((payload: SendHydraPayload) => {
    setSendState(prev => startHydraSend(prev, payload))
    dispatch({
      type: VISUALIZER_HYDRA_CODE_REQ,
      payload,
    })
  }, [dispatch])

  const rejectHydraSendRequest = useCallback(() => {
    setSendState(rejectHydraSend())
  }, [])

  const handleSendCode = useCallback((input: string | SendHydraPayload) => {
    if (!orchestratorCapabilities.canLiveCode) {
      rejectHydraSendRequest()
      return
    }

    dispatchHydraPayload(typeof input === 'string' ? { code: input } : input)
  }, [dispatchHydraPayload, orchestratorCapabilities.canLiveCode, rejectHydraSendRequest])

  const handleCodeChange = useCallback((code: string) => {
    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: code,
      userHasEdited: true,
    }))
    setSendState(prev => clearHydraSendAfterEdit(prev))
  }, [cancelPendingRemoteSync])

  const handleRandomize = useCallback(() => {
    const sketch = getRandomSketch()
    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: sketch,
      debouncedCode: sketch,
      userHasEdited: true,
    }))
  }, [cancelPendingRemoteSync])

  const handleCameraToggle = useCallback(() => {
    if (camera.status === 'idle' || camera.status === 'error') {
      void camera.start()
    } else {
      camera.stop()
    }
  }, [camera])

  const handleLoadPreset = useCallback((code: string) => {
    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: code,
      debouncedCode: code,
      userHasEdited: true,
    }))
    if (ui.innerWidth < 980) {
      setActiveMobileTab('stage')
    }
  }, [cancelPendingRemoteSync, ui.innerWidth])

  const handleSendPreset = useCallback((input: PresetLeaf | string) => {
    if (!canSendHydraInput(input, orchestratorCapabilities)) {
      rejectHydraSendRequest()
      return
    }

    let payload: SendHydraPayload
    if (typeof input === 'string') {
      payload = { code: input }
    } else {
      const presetKey = getPresetKey(input)
      const hydraGalleryId = input.isGallery && presetKey?.startsWith('gallery:')
        ? presetKey.slice('gallery:'.length)
        : undefined
      payload = {
        code: input.code,
        hydraPresetName: input.name,
        hydraPresetId: input.presetId ?? null,
        hydraPresetFolderId: input.folderId ?? null,
        hydraPresetSource: input.isGallery ? 'gallery' : 'folder',
        hydraGalleryId,
      }
    }

    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: payload.code,
      debouncedCode: payload.code,
      userHasEdited: true,
    }))
    dispatchHydraPayload(payload)
    if (ui.innerWidth < 980) {
      setActiveMobileTab('stage')
    }
  }, [
    cancelPendingRemoteSync,
    dispatchHydraPayload,
    orchestratorCapabilities,
    rejectHydraSendRequest,
    ui.innerWidth,
  ])

  const handleInsertApiExample = useCallback((snippet: string) => {
    const trimmed = snippet.trim()
    if (trimmed.length === 0) return
    const base = (
      remoteState.userHasEdited
        ? remoteState.localCode
        : (hydraSnapshot.remoteHydraCode ?? remoteState.localCode)
    ).trimEnd()
    const nextCode = base.length > 0 ? `${base}\n\n${trimmed}` : trimmed
    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: nextCode,
      debouncedCode: nextCode,
      userHasEdited: true,
    }))
    if (ui.innerWidth < 980) {
      setActiveMobileTab('code')
    }
  }, [
    cancelPendingRemoteSync,
    hydraSnapshot.remoteHydraCode,
    remoteState.localCode,
    remoteState.userHasEdited,
    ui.innerWidth,
  ])

  const handleReplaceApiExample = useCallback((snippet: string) => {
    const nextCode = snippet.trim()
    if (nextCode.length === 0) return
    cancelPendingRemoteSync()
    setRemoteState(prev => ({
      ...prev,
      localCode: nextCode,
      debouncedCode: nextCode,
      userHasEdited: true,
    }))
    if (ui.innerWidth < 980) {
      setActiveMobileTab('code')
    }
  }, [cancelPendingRemoteSync, ui.innerWidth])

  const handleResend = useCallback(() => {
    if (!orchestratorCapabilities.canLiveCode) {
      rejectHydraSendRequest()
      return
    }

    handleSendCode(remoteState.localCode)
  }, [
    handleSendCode,
    orchestratorCapabilities.canLiveCode,
    rejectHydraSendRequest,
    remoteState.localCode,
  ])

  const handleApplyRemote = useCallback(() => {
    setRemoteState(prev => applyPendingRemote(prev))
  }, [])

  const handleDismissRemote = useCallback(() => {
    setRemoteState(prev => dismissPendingRemote(prev))
  }, [])

  useEffect(() => {
    dispatch(fetchCurrentRoom())
  }, [dispatch])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ORCHESTRATOR_REF_PANEL_STORAGE_KEY, serializeRefPanelWidth(refPanelWidth))
  }, [refPanelWidth])

  useEffect(() => {
    if (!isResizingPanel) return
    const handleMove = (event: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      setRefPanelWidth(getPointerRefPanelWidth({
        containerLeft: rect.left,
        pointerClientX: event.clientX,
      }))
    }
    const handleUp = () => {
      setIsResizingPanel(false)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingPanel])

  useEffect(() => {
    if (remoteState.userHasEdited) return
    if (!hydraSnapshot.remoteHydraCode || hydraSnapshot.remoteHydraCode.trim() === '') return
    if (hydraSnapshot.remoteHydraCode === remoteState.localCode) return

    remoteSyncRafRef.current = requestAnimationFrame(() => {
      setRemoteState(prev => syncRemoteBeforeEdit(prev, hydraSnapshot.remoteHydraCode))
      remoteSyncRafRef.current = null
    })

    return () => {
      cancelPendingRemoteSync()
    }
  }, [
    cancelPendingRemoteSync,
    hydraSnapshot.remoteHydraCode,
    remoteState.localCode,
    remoteState.userHasEdited,
  ])

  useEffect(() => {
    let timeoutId: number | null = null
    const rafId = requestAnimationFrame(() => {
      setSendState((prev) => {
        const next = acknowledgeHydraRemote(prev, hydraSnapshot.remoteHydraCode)
        if (next !== prev) {
          timeoutId = window.setTimeout(() => {
            setSendState(current => resetSyncedHydraSend(current))
          }, 1500)
        }
        return next
      })
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [hydraSnapshot.remoteHydraCode])

  useEffect(() => {
    if (sendState.status !== 'sending') return
    const id = window.setTimeout(() => {
      setSendState(prev => expireHydraSend(prev))
    }, 4000)
    return () => window.clearTimeout(id)
  }, [sendState.status])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRemoteState(prev => trackPendingRemoteUpdate(prev, hydraSnapshot.remoteHydraCode))
    })
    return () => cancelAnimationFrame(id)
  }, [hydraSnapshot.remoteHydraCode, remoteState.localCode, remoteState.userHasEdited])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRemoteState(prev => applyPresetIndexRemoteUpdate(prev, {
        remotePresetIndex: hydraSnapshot.remotePresetIndex,
        remoteHydraCode: hydraSnapshot.remoteHydraCode,
      }))
    })
    return () => cancelAnimationFrame(id)
  }, [hydraSnapshot.remoteHydraCode, hydraSnapshot.remotePresetIndex])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRemoteState((prev) => {
        if (prev.debouncedCode === prev.localCode) return prev
        return {
          ...prev,
          debouncedCode: prev.localCode,
        }
      })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [remoteState.localCode])

  const effectiveCode = getEffectiveWorkspaceCode({
    localCode: remoteState.localCode,
    debouncedCode: remoteState.debouncedCode,
    remoteHydraCode: hydraSnapshot.remoteHydraCode,
    userHasEdited: remoteState.userHasEdited,
  })

  const orchestratorStatusModel = useMemo(() => getOrchestratorStatusModel({
    capabilities: orchestratorCapabilities,
    sendStatus: sendState.status,
    userHasEdited: remoteState.userHasEdited,
    pendingRemoteCount: remoteState.pendingRemoteCount,
    cameraStatus: camera.status,
  }), [
    camera.status,
    orchestratorCapabilities,
    remoteState.pendingRemoteCount,
    remoteState.userHasEdited,
    sendState.status,
  ])

  const containerStyle = useMemo(() => ({
    ['--ref-panel-width' as string]: `${refPanelWidth}px`,
  }) as CSSProperties, [refPanelWidth])

  return {
    containerRef,
    containerStyle,
    workspaceModel,
    orchestratorCapabilities,
    orchestratorStatusModel,
    presetBrowserProps: {
      currentCode: remoteState.localCode,
      onLoad: handleLoadPreset,
      onSend: handleSendPreset,
    },
    apiReferenceProps: {
      onInsertExample: handleInsertApiExample,
      onReplaceWithExample: handleReplaceApiExample,
    },
    stagePanelProps: {
      code: effectiveCode,
      width: workspaceModel.previewSize.width,
      height: workspaceModel.previewSize.height,
      buffer: previewBuffer,
      onBufferChange: setPreviewBuffer,
      localCameraStream: camera.stream,
      onPresetLoad: handleLoadPreset,
      onPresetSend: orchestratorCapabilities.canSendGalleryPreset ? handleSendPreset : undefined,
      onRandomize: handleRandomize,
      visualizerMode: hydraSnapshot.previewHydraState.mode,
      visualizerEnabled: hydraSnapshot.previewHydraState.isEnabled,
      visualizerSensitivity: hydraSnapshot.previewHydraState.sensitivity,
      visualizerAllowCamera: hydraSnapshot.previewHydraState.allowCamera,
      cameraRelayStatus: camera.status,
    },
    codeEditorProps: {
      code: remoteState.userHasEdited ? remoteState.localCode : effectiveCode,
      onCodeChange: handleCodeChange,
      onSend: handleSendCode,
      canSend: orchestratorCapabilities.canLiveCode,
      sendStatus: sendState.status,
      onResend: handleResend,
      onRandomize: handleRandomize,
      cameraStatus: camera.status,
      onCameraToggle: handleCameraToggle,
    },
    activeDesktopPanel: workspaceModel.activeDesktopPanel,
    activeMobilePanel: workspaceModel.activeMobilePanel,
    setActiveDesktopPanel,
    setActiveMobilePanel: setActiveMobileTab,
    isKeyboardOpen,
    isMobile: workspaceModel.isMobile,
    isRefOpen: workspaceModel.isMobile && workspaceModel.activeMobilePanel === 'ref',
    isResizingPanel,
    startRefPanelResize: () => setIsResizingPanel(true),
    pendingRemoteCode: remoteState.pendingRemoteCode,
    pendingRemoteCount: remoteState.pendingRemoteCount,
    handleApplyRemote,
    handleDismissRemote,
    showUnsentMobileDot: shouldShowUnsentDot(
      workspaceModel.activeMobilePanel,
      remoteState.userHasEdited,
      sendState.status,
    ),
  }
}
