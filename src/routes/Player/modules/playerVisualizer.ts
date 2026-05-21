import { createAction, createReducer } from '@reduxjs/toolkit'
import {
  PLAYER_CMD_OPTIONS,
  PLAYER_LOAD,
  PLAYER_VISUALIZER_ERROR,
  VISUALIZER_HYDRA_CODE,
} from 'shared/actionTypes'
import type { PlaybackOptions, VisualizerMode } from 'shared/types'
import type { HydraPresetSource, VisualizerRunId } from 'shared/types'
import { getPresetLabel } from 'routes/Orchestrator/components/hydraPresets'
import type { InjectionLevel } from 'routes/Player/components/Player/PlayerVisualizer/hooks/audioInjectProfiles'
import type { PresetCategory } from 'routes/Player/components/Player/PlayerVisualizer/hooks/presetClassifier'

// ------------------------------------
// Actions
// ------------------------------------
const playerCmdOptions = createAction<{ visualizer: PlaybackOptions['visualizer'] }>(PLAYER_CMD_OPTIONS)
const hydraCodeReceived = createAction<{
  code: string
  hydraPresetIndex?: number
  hydraPresetName?: string
  hydraPresetId?: number | null
  hydraPresetFolderId?: number | null
  hydraPresetSource?: HydraPresetSource
  hydraGalleryId?: string
  visualizerRunId?: VisualizerRunId
  visualizerCodeHash?: string
  visualizerAcceptedAt?: number
  injectionLevel?: InjectionLevel
}>(VISUALIZER_HYDRA_CODE)
export const playerLoad = createAction(PLAYER_LOAD)
export const playerVisualizerError = createAction<string>(PLAYER_VISUALIZER_ERROR)

// ------------------------------------
// Reducer
// ------------------------------------
export interface PlayerVisualizerState {
  isEnabled: boolean
  isSupported: boolean
  sensitivity: number
  mode: VisualizerMode
  hydraCode?: string
  hydraPresetIndex: number
  hydraPresetName: string
  hydraPresetId?: number | null
  hydraPresetFolderId?: number | null
  hydraPresetSource?: HydraPresetSource
  hydraGalleryId?: string
  visualizerRunId?: VisualizerRunId
  visualizerCodeHash?: string
  visualizerAcceptedAt?: number
  hasHydraUpdate: boolean
  allowCamera: boolean
  cycleOnSongTransition: boolean
  injectionLevel: InjectionLevel
  presetCategory: PresetCategory
}

const initialState: PlayerVisualizerState = {
  isEnabled: true,
  isSupported: true,
  sensitivity: 1,
  mode: 'hydra',
  hydraCode: undefined,
  hydraPresetIndex: 0,
  hydraPresetName: '',
  hydraPresetId: null,
  hydraPresetFolderId: null,
  hydraPresetSource: undefined,
  hydraGalleryId: undefined,
  visualizerRunId: undefined,
  visualizerCodeHash: undefined,
  visualizerAcceptedAt: undefined,
  hasHydraUpdate: false,
  allowCamera: false,
  cycleOnSongTransition: false,
  injectionLevel: 'med',
  presetCategory: 'default',
}

/** Guard: only allow valid modes */
function validMode (mode: VisualizerMode | undefined, fallback: VisualizerMode): VisualizerMode {
  if (mode === 'hydra' || mode === 'off') return mode
  return fallback
}

const playerVisualizerReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(playerLoad, state => ({
      ...state,
      hasHydraUpdate: false,
    }))
    .addCase(playerCmdOptions, (state, { payload }) => {
      const { visualizer } = payload
      if (typeof visualizer !== 'object') return state

      return {
        ...state,
        isEnabled: typeof visualizer.isEnabled === 'boolean' ? visualizer.isEnabled : state.isEnabled,
        sensitivity: typeof visualizer.sensitivity === 'number' ? visualizer.sensitivity : state.sensitivity,
        mode: validMode(visualizer.mode, state.mode),
        allowCamera: typeof visualizer.allowCamera === 'boolean' ? visualizer.allowCamera : state.allowCamera,
        cycleOnSongTransition: typeof visualizer.cycleOnSongTransition === 'boolean'
          ? visualizer.cycleOnSongTransition
          : state.cycleOnSongTransition,
      }
    })
    .addCase(hydraCodeReceived, (state, { payload }) => {
      state.hydraCode = payload.code
      state.hasHydraUpdate = true
      if (typeof payload.hydraPresetIndex === 'number') {
        state.hydraPresetIndex = payload.hydraPresetIndex
        state.hydraPresetName = getPresetLabel(payload.hydraPresetIndex)
      }
      if (typeof payload.hydraPresetName === 'string' && payload.hydraPresetName.trim()) {
        state.hydraPresetName = payload.hydraPresetName
      }
      if ('hydraPresetId' in payload) {
        state.hydraPresetId = typeof payload.hydraPresetId === 'number' ? payload.hydraPresetId : null
      }
      if ('hydraPresetFolderId' in payload) {
        state.hydraPresetFolderId = typeof payload.hydraPresetFolderId === 'number' ? payload.hydraPresetFolderId : null
      }
      if (payload.hydraPresetSource === 'gallery' || payload.hydraPresetSource === 'folder' || payload.hydraPresetSource === 'raw') {
        state.hydraPresetSource = payload.hydraPresetSource
      }
      if (typeof payload.hydraGalleryId === 'string' && payload.hydraGalleryId.trim()) {
        state.hydraGalleryId = payload.hydraGalleryId
      }
      if (typeof payload.visualizerRunId === 'string' && payload.visualizerRunId.trim()) {
        state.visualizerRunId = payload.visualizerRunId
      }
      if (typeof payload.visualizerCodeHash === 'string' && payload.visualizerCodeHash.trim()) {
        state.visualizerCodeHash = payload.visualizerCodeHash
      }
      if (typeof payload.visualizerAcceptedAt === 'number') {
        state.visualizerAcceptedAt = payload.visualizerAcceptedAt
      }
      if (payload.injectionLevel) {
        state.injectionLevel = payload.injectionLevel
      }
    })
    .addCase(playerVisualizerError, (state) => {
      state.isSupported = false
    })
})

export default playerVisualizerReducer

declare module 'store/reducers' {
  export interface LazyLoadedSlices {
    playerVisualizer: typeof initialState
  }
}
