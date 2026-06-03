import type { FftPayload } from 'shared/fftPayload'

export const FFT_STALE_MS = 1500

export type CameraRelayStatus = 'idle' | 'connecting' | 'active' | 'error'

export interface CameraPipelineState {
  level: 'off' | 'partial' | 'live'
  missing: Array<'publish/subscribe' | 'hydra source bind'>
}

const CAMERA_PIPELINE_LABEL_BY_LEVEL = {
  live: 'Source bound',
  partial: 'Source binding partial',
  off: 'Source: no camera',
} satisfies Record<CameraPipelineState['level'], string>

export function formatCameraPipelineLabel (state: Pick<CameraPipelineState, 'level'>): string {
  return CAMERA_PIPELINE_LABEL_BY_LEVEL[state.level]
}

export function isPreviewLive (
  fftData: FftPayload | null,
  isPlayerPresent: boolean,
  lastFftAt: number | null,
  now: number = Date.now(),
): boolean {
  if (!isPlayerPresent || !fftData || lastFftAt == null) return false
  return now - lastFftAt <= FFT_STALE_MS
}

export function selectPreviewVideoElement (
  local: HTMLVideoElement | null,
  remote: HTMLVideoElement | null,
): HTMLVideoElement | null {
  return local ?? remote ?? null
}

interface CameraPipelineInput {
  cameraStatus: CameraRelayStatus
  usesCameraSource: boolean
  boundSourceCount: number
}

export function getCameraPipelineState ({
  cameraStatus,
  usesCameraSource,
  boundSourceCount,
}: CameraPipelineInput): CameraPipelineState {
  if (cameraStatus === 'idle' && !usesCameraSource) {
    return {
      level: 'off',
      missing: [],
    }
  }

  const missing: CameraPipelineState['missing'] = []

  if (cameraStatus !== 'active') {
    missing.push('publish/subscribe')
  }

  if (usesCameraSource && boundSourceCount < 1) {
    missing.push('hydra source bind')
  }

  if (missing.length === 0) {
    return {
      level: 'live',
      missing: [],
    }
  }

  return {
    level: 'partial',
    missing,
  }
}
