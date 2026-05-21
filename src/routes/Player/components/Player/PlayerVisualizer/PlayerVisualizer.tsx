import React, { Suspense } from 'react'
import type { PlayerInstanceId, PlayerMediaClockState, VisualizerMode, VisualizerRunId } from 'shared/types'
import styles from './PlayerVisualizer.css'

// Lazy load visualizer to reduce initial bundle
const HydraVisualizer = React.lazy(() => import('./HydraVisualizer'))

interface PlayerVisualizerProps {
  audioSourceNode: MediaElementAudioSourceNode
  isPlaying: boolean
  sensitivity: number
  width: number
  height: number
  mode: VisualizerMode
  hydraCode?: string
  allowCamera?: boolean
  remoteVideoElement?: HTMLVideoElement | null
  playerMediaVideoElement?: HTMLVideoElement | null
  playerMediaClock?: PlayerMediaClockState | null
  playerInstanceId?: PlayerInstanceId | null
  visualizerRunId?: VisualizerRunId | null
}

function PlayerVisualizer ({
  audioSourceNode,
  isPlaying,
  sensitivity,
  width,
  height,
  mode,
  hydraCode,
  allowCamera,
  remoteVideoElement,
  playerMediaVideoElement,
  playerMediaClock,
  playerInstanceId,
  visualizerRunId,
}: PlayerVisualizerProps) {
  if (mode !== 'hydra') {
    return null
  }

  return (
    <div style={{ width, height }} className={styles.container}>
      <Suspense fallback={null}>
        <HydraVisualizer
          audioSourceNode={audioSourceNode}
          isPlaying={isPlaying}
          sensitivity={sensitivity}
          width={width}
          height={height}
          code={hydraCode}
          allowCamera={allowCamera}
          remoteVideoElement={remoteVideoElement}
          playerMediaVideoElement={playerMediaVideoElement}
          playerMediaClock={playerMediaClock}
          emitFft={true}
          playerInstanceId={playerInstanceId}
          visualizerRunId={visualizerRunId}
        />
      </Suspense>
    </div>
  )
}

export default PlayerVisualizer
