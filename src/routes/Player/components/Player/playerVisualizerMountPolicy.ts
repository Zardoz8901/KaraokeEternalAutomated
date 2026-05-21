interface PlayerVisualizerMountInput {
  mediaType?: string | null
  isVideoKeyingEnabled: boolean
  isWebGLSupported: boolean
  isVisualizerEnabled?: boolean
  hasVisualizerAudioSource: boolean
}

export function shouldMountPlayerVisualizer ({
  mediaType,
  isVideoKeyingEnabled,
  isWebGLSupported,
  isVisualizerEnabled,
  hasVisualizerAudioSource,
}: PlayerVisualizerMountInput): boolean {
  return (mediaType === 'cdg' || (mediaType === 'mp4' && isVideoKeyingEnabled))
    && isWebGLSupported
    && Boolean(isVisualizerEnabled)
    && hasVisualizerAudioSource
}
