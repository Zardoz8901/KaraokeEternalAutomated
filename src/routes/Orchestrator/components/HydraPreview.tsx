import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAppSelector } from 'store/hooks'
import { detectCameraUsage } from 'lib/detectCameraUsage'
import { ensureHydraVideoMountPoint } from 'lib/videoProxyOverride'
import { type AudioData } from 'routes/Player/components/Player/PlayerVisualizer/hooks/useAudioAnalyser'
import type { PlayerMediaClockState, VisualizerMode } from 'shared/types'
import HydraVisualizer from '../../Player/components/Player/PlayerVisualizer/HydraVisualizer'
import { getOrchestratorPresentationModel, getPreviewStatusClassKey } from './orchestratorPresentationModel'
import styles from './HydraPreview.css'

interface HydraPreviewProps {
  code: string
  width: number
  height: number
  localCameraStream?: MediaStream | null
  mode: VisualizerMode
  isEnabled: boolean
  sensitivity: number
  allowCamera: boolean
  onCameraBoundSourcesChange?: (sources: string[]) => void
}

const SHADOW_VIDEO_DRIFT_THRESHOLD_SECONDS = 0.75
const PLAYER_MEDIA_RENDERABLE_EVENTS = ['loadedmetadata', 'loadeddata', 'canplay', 'playing', 'timeupdate'] as const

function getPlayerMediaShadowVideoUrl (mediaId: number): string {
  return `/api/media/${mediaId}?type=video`
}

function isPlayerMediaVideoRenderable (video: HTMLVideoElement | null): boolean {
  return Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
}

function usePlayerMediaVideoRenderable (video: HTMLVideoElement | null): boolean {
  const [isRenderable, setIsRenderable] = useState(false)

  useEffect(() => {
    const update = () => {
      const next = isPlayerMediaVideoRenderable(video)
      setIsRenderable(current => current === next ? current : next)
    }

    update()
    if (!video) return

    for (const eventName of PLAYER_MEDIA_RENDERABLE_EVENTS) {
      video.addEventListener(eventName, update)
    }

    return () => {
      for (const eventName of PLAYER_MEDIA_RENDERABLE_EVENTS) {
        video.removeEventListener(eventName, update)
      }
    }
  }, [video])

  return isRenderable
}

function estimatePlayerMediaPosition (clock: PlayerMediaClockState, nowMs = Date.now()): number {
  if (!clock.isPlaying) return clock.position
  return clock.position + Math.max(0, nowMs - clock.statusAt) / 1000
}

function getPlayerMediaClockFromStatus (status: {
  mediaId?: number | null
  mediaType?: string | null
  queueId?: number
  position?: number
  isPlaying?: boolean
  statusAt?: number
}): PlayerMediaClockState | null {
  if (
    status.mediaType !== 'mp4'
    || typeof status.mediaId !== 'number'
    || status.mediaId <= 0
    || typeof status.queueId !== 'number'
    || status.queueId <= 0
    || typeof status.position !== 'number'
    || !Number.isFinite(status.position)
    || typeof status.statusAt !== 'number'
    || status.statusAt <= 0
  ) {
    return null
  }

  return {
    mediaId: status.mediaId,
    mediaType: 'mp4',
    queueId: status.queueId,
    position: status.position,
    isPlaying: status.isPlaying === true,
    statusAt: status.statusAt,
  }
}

function usePlayerMediaShadowVideo (clock: PlayerMediaClockState | null): HTMLVideoElement | null {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const mediaId = clock?.mediaId ?? null

  useEffect(() => {
    if (!clock || typeof mediaId !== 'number') {
      setVideo(null)
      return
    }

    const el = document.createElement('video')
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.loop = false
    el.setAttribute('src', getPlayerMediaShadowVideoUrl(mediaId))
    el.currentTime = estimatePlayerMediaPosition(clock)
    ensureHydraVideoMountPoint()?.appendChild(el)
    if (clock.isPlaying) {
      el.play()?.catch(() => {})
    }
    setVideo(el)

    return () => {
      setVideo(null)
      el.pause()
      el.removeAttribute('src')
      try {
        el.load()
      } catch {
        // Ignore jsdom/detached media cleanup failures.
      }
      el.remove()
    }
  // Recreate only when the media identity changes; clock drift is handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  useEffect(() => {
    if (!video || !clock) return

    const sync = () => {
      const target = estimatePlayerMediaPosition(clock)
      if (Math.abs(video.currentTime - target) > SHADOW_VIDEO_DRIFT_THRESHOLD_SECONDS) {
        video.currentTime = target
      }
      if (clock.isPlaying) {
        video.play()?.catch(() => {})
      } else {
        video.pause()
      }
    }

    sync()
    if (!clock.isPlaying) return
    const interval = window.setInterval(sync, 1000)
    return () => window.clearInterval(interval)
  }, [video, clock])

  return video
}

function mapFftToAudioData (fft: { fft: number[], bass: number, mid: number, treble: number, beat: number, energy: number, bpm: number, bright: number }): AudioData {
  return {
    rawFrequencyData: new Float32Array(fft.fft),
    frequencyData: new Float32Array(fft.fft),
    waveformData: new Float32Array(128),
    bass: fft.bass,
    mid: fft.mid,
    treble: fft.treble,
    isBeat: fft.beat > 0.8,
    beatIntensity: fft.beat,
    energy: fft.energy,
    energySmooth: fft.energy,
    spectralCentroid: fft.bright,
    beatFrequency: fft.bpm,
  }
}

const HydraPreview = ({
  code,
  width,
  height,
  localCameraStream,
  mode,
  isEnabled,
  sensitivity,
  allowCamera,
  onCameraBoundSourcesChange,
}: HydraPreviewProps) => {
  const status = useAppSelector(state => state.status)
  const isHydraActive = isEnabled && mode === 'hydra'
  const playerMediaClock = useMemo(() => getPlayerMediaClockFromStatus(status), [status])
  const codeUsage = useMemo(() => detectCameraUsage(code), [code])
  const shouldCreatePlayerMediaShadowVideo = Boolean(playerMediaClock && codeUsage.hasInitVideo)
  const playerMediaVideoElement = usePlayerMediaShadowVideo(
    shouldCreatePlayerMediaShadowVideo ? playerMediaClock : null,
  )
  const hasRenderablePlayerMediaVideoElement = usePlayerMediaVideoRenderable(playerMediaVideoElement)
  const requirePlayerMediaVideo = Boolean(playerMediaClock && codeUsage.hasInitVideo)

  const hasPlayerAudioData = status.isPlayerPresent && status.fftData !== null
  const overrideData = hasPlayerAudioData && status.fftData ? mapFftToAudioData(status.fftData) : null

  const previewVideoElement = useMemo(() => {
    if (!allowCamera || !localCameraStream) {
      return null
    }

    const el = document.createElement('video')
    el.autoplay = true
    el.playsInline = true
    el.muted = true
    el.srcObject = localCameraStream

    return el
  }, [allowCamera, localCameraStream])

  // Use only local camera stream in orchestrator preview.
  // Player owns remote camera subscription to avoid WebRTC answer races.
  useEffect(() => {
    if (!previewVideoElement) {
      return
    }

    const playPromise = previewVideoElement.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: unknown): void => {
        console.debug('[HydraPreview] camera preview play() failed', err)
      })
    }

    return () => {
      previewVideoElement.srcObject = null
    }
  }, [previewVideoElement])

  const audioStoreRef = useRef<{
    source: MediaElementAudioSourceNode | null
    listeners: Set<() => void>
  }>({
    source: null,
    listeners: new Set(),
  })

  const getSnapshot = useCallback(
    () => audioStoreRef.current.source,
    [],
  )
  const getServerSnapshot = useCallback(
    () => null as MediaElementAudioSourceNode | null,
    [],
  )
  const subscribe = useCallback((listener: () => void) => {
    const store = audioStoreRef.current
    store.listeners.add(listener)
    return () => store.listeners.delete(listener)
  }, [])

  const audioSource = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const presentation = useMemo(() => getOrchestratorPresentationModel({
    isHydraActive,
    hasInitVideo: codeUsage.hasInitVideo,
    hasPlayerMediaClock: Boolean(playerMediaClock),
    hasPlayerMediaVideoElement: hasRenderablePlayerMediaVideoElement,
    isPlayerPresent: status.isPlayerPresent,
    hasFftData: status.fftData !== null,
    hasSimulatedAudioSource: Boolean(audioSource),
  }), [
    audioSource,
    codeUsage.hasInitVideo,
    hasRenderablePlayerMediaVideoElement,
    isHydraActive,
    playerMediaClock,
    status.fftData,
    status.isPlayerPresent,
  ])

  useEffect(() => {
    const store = audioStoreRef.current

    if (!isHydraActive) {
      store.source = null
      store.listeners.forEach(listener => listener())
      return
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 2

    const oscGain = ctx.createGain()
    oscGain.gain.value = 1.0

    osc.connect(oscGain)
    oscGain.connect(masterGain)
    osc.start()

    store.source = oscGain as unknown as MediaElementAudioSourceNode
    store.listeners.forEach(listener => listener())

    return () => {
      osc.stop()
      store.source = null
      store.listeners.forEach(listener => listener())
      ctx.close()
    }
  }, [isHydraActive])

  const shouldMountHydra = isHydraActive
    && (audioSource || hasPlayerAudioData)
    && presentation.preview !== 'waitingForPlayerMedia'

  return (
    <div className={styles.container} style={{ width, height }}>
      <div
        className={`${styles.status} ${styles[getPreviewStatusClassKey(presentation.preview)] ?? ''}`}
        data-testid='hydra-preview-status'
        role='status'
        aria-live='polite'
      >
        <span className={styles.statusPrimary}>{presentation.primaryLabel}</span>
        {presentation.secondaryLabels.length > 0 && (
          <span className={styles.statusSecondary}>
            {presentation.secondaryLabels.join(' / ')}
          </span>
        )}
      </div>
      {shouldMountHydra && (
        <HydraVisualizer
          audioSourceNode={hasPlayerAudioData ? null : audioSource}
          isPlaying={true}
          sensitivity={sensitivity}
          width={width}
          height={height}
          code={code}
          layer={0}
          allowCamera={allowCamera}
          overrideData={overrideData}
          remoteVideoElement={previewVideoElement}
          playerMediaVideoElement={playerMediaVideoElement}
          playerMediaClock={playerMediaClock}
          requirePlayerMediaVideo={requirePlayerMediaVideo}
          onCameraSourcesBoundChange={onCameraBoundSourcesChange}
        />
      )}
    </div>
  )
}

export default HydraPreview
