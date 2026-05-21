import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import Hydra from 'hydra-synth'
import throttle from 'lodash/throttle'
import { useDispatch } from 'react-redux'
import { PLAYER_EMIT_FFT, PLAYER_EMIT_VISUALIZER_APPLIED } from 'shared/actionTypes'
import type { HydraVideoSourceKey, PlayerInstanceId, PlayerMediaClockState, VisualizerRunId } from 'shared/types'
import { type AudioData } from './hooks/useAudioAnalyser'
import { useHydraAudio } from './hooks/useHydraAudio'
import { getHydraEvalCode, DEFAULT_PATCH } from './hydraEvalCode'
import { executeHydraCode } from './hydraCodeExecution'
import { installHydraTimerTracking, uninstallHydraTimerTracking, withHydraTimerOwner, type HydraTimerOwner } from './hydraUserTimers'
import { setMouseShims, clearMouseShims } from './mouseShims'
import { detectCameraUsage } from 'lib/detectCameraUsage'
import telemetry from 'lib/telemetry'
import { HYDRA_FALLBACK_APPLIED } from 'shared/telemetry'
import { applyRemoteCameraOverride, restoreRemoteCameraOverride } from 'lib/remoteCameraOverride'
import { applyVideoProxyOverride, restoreVideoProxyOverride, patchHydraSourceTick, HYDRA_VIDEO_READY_EVENT, protectVideoElement } from 'lib/videoProxyOverride'
import { shouldEmitFft } from './hooks/emitFftPolicy'
import type { HydraAudioCompat } from './hooks/hydraAudioCompat'
import styles from './HydraVisualizer.css'

const log = (...args: unknown[]) => console.log('[Hydra]', ...args)
const warn = (...args: unknown[]) => console.warn('[Hydra]', ...args)
const cameraDiag = (...args: unknown[]) => console.debug('[HydraCameraDiag]', ...args)

function snapshotVideoElement (videoEl: HTMLVideoElement | null) {
  if (!videoEl) return null
  return {
    readyState: videoEl.readyState,
    networkState: videoEl.networkState,
    paused: videoEl.paused,
    muted: videoEl.muted,
    videoWidth: videoEl.videoWidth,
    videoHeight: videoEl.videoHeight,
    hasSrcObject: videoEl.srcObject !== null,
  }
}

function isRemoteVideoRenderable (videoEl: HTMLVideoElement | null) {
  if (!videoEl) return false
  return videoEl.readyState >= 2
    && videoEl.videoWidth > 0
    && videoEl.videoHeight > 0
}

function isHydraVideoSourceKey (value: string): value is HydraVideoSourceKey {
  return value === 's0' || value === 's1' || value === 's2' || value === 's3'
}

// Audio globals exposed on window for Hydra code to reference.
// window.a is a plain writable property — gallery sketches may clobber it.
// __hydraAudio is a non-configurable getter backed by __hydraAudioRef,
// providing a stable fallback that survives clobbering and HMR.
function setAudioGlobals (compat: HydraAudioCompat) {
  const g = globalThis as unknown as Record<string, unknown>
  g.__hydraAudioRef = compat
  ;(window as unknown as Record<string, unknown>).a = compat

  // Define once — configurable: false means sketches cannot redefine it.
  // The getter reads __hydraAudioRef so it stays current across compat changes.
  if (!Object.getOwnPropertyDescriptor(window, '__hydraAudio')) {
    try {
      Object.defineProperty(window, '__hydraAudio', {
        get () { return (globalThis as unknown as Record<string, unknown>).__hydraAudioRef },
        configurable: false,
        enumerable: false,
      })
    } catch {
      // Already defined strangely from a previous session — skip
    }
  }
}

function clearAudioGlobals () {
  const w = window as unknown as Record<string, unknown>
  ;(globalThis as unknown as Record<string, unknown>).__hydraAudioRef = null
  Reflect.deleteProperty(w, 'a')
}

// Clear render graph outputs without clearing sources (preserves WebRTC video tracks).
// Mirrors hydra.hush() output logic (solid black to all outputs) but skips
// source.clear() which calls track.stop() and kills WebRTC streams.
function softHush (hydra: Hydra) {
  const h = hydra as unknown as {
    o?: unknown[]
    synth?: { solid: (r: number, g: number, b: number, a: number) => { out: (o: unknown) => void }, render: (o: unknown) => void }
  }
  if (h.o && h.synth) {
    h.o.forEach(output => h.synth!.solid(0, 0, 0, 0).out(output))
    h.synth.render(h.o[0])
  }

  // Reset user-set globals so the next preset starts clean.
  // Presets that set fps=1 or speed=0.1 can make the next preset look frozen.
  const w = window as unknown as Record<string, unknown>
  if (typeof w.update === 'function') w.update = function () {}
  if (typeof w.afterUpdate === 'function') w.afterUpdate = function () {}
  // IMPORTANT: do not delete speed/bpm. Hydra's sandbox sync copies window.speed
  // into synth.speed every tick; deleting makes synth.speed=undefined, which
  // turns time into NaN and effectively kills rendering.
  if (typeof w.fps === 'number') w.fps = undefined
  w.speed = 1
  w.bpm = 30
}

function tickHydraOnce (hydra: Hydra, timerOwner: HydraTimerOwner): boolean {
  try {
    withHydraTimerOwner(timerOwner, () => hydra.tick(16.67))
    return true
  } catch (err) {
    warn('Initial tick error:', err)
    return false
  }
}

interface HydraVisualizerProps {
  audioSourceNode: MediaElementAudioSourceNode | null
  isPlaying: boolean
  sensitivity: number
  width: number
  height: number
  /** Hydra code to execute. If not provided, uses default patch. */
  code?: string
  /** Override container z-index for previews or overlays. */
  layer?: number
  /** When true, auto-init camera for detected source usage */
  allowCamera?: boolean
  /** When true, emit FFT data to server for remote preview */
  emitFft?: boolean
  /** Remote audio data to drive visualizer (replaces audioSourceNode) */
  overrideData?: AudioData | null
  /** Remote camera video element from WebRTC (replaces local initCam) */
  remoteVideoElement?: HTMLVideoElement | null
  /** Borrowed Player/shadow MP4 element used as the default initVideo source. */
  playerMediaVideoElement?: HTMLVideoElement | null
  /** Player media clock associated with playerMediaVideoElement. */
  playerMediaClock?: PlayerMediaClockState | null
  /** When true, initVideo must wait for playerMediaVideoElement instead of using fallback video. */
  requirePlayerMediaVideo?: boolean
  /** Emits currently bound camera sources (s0-s3) after init/rebind passes */
  onCameraSourcesBoundChange?: (sources: string[]) => void
  /** Player runtime identity; only Player instances provide this. */
  playerInstanceId?: PlayerInstanceId | null
  /** Server-generated accepted visualizer run id. */
  visualizerRunId?: VisualizerRunId | null
}

function HydraVisualizer ({
  audioSourceNode,
  isPlaying,
  sensitivity,
  width,
  height,
  code,
  layer,
  allowCamera,
  emitFft,
  overrideData,
  remoteVideoElement,
  playerMediaVideoElement,
  playerMediaClock,
  requirePlayerMediaVideo,
  onCameraSourcesBoundChange,
  playerInstanceId,
  visualizerRunId,
}: HydraVisualizerProps) {
  const dispatch = useDispatch()
  const dispatchRef = useRef(dispatch)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hydraRef = useRef<Hydra | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const errorCountRef = useRef<number>(0)
  const frameCountRef = useRef<number>(0)
  const widthRef = useRef(width)
  const heightRef = useRef(height)
  const codeRef = useRef(code)
  const cameraInitRef = useRef<Set<string>>(new Set())
  const cameraOverrideRef = useRef<Map<string, unknown>>(new Map())
  const videoProxyOverrideRef = useRef<Map<string, unknown>>(new Map())
  const prevRemoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const playerMediaVideoElementRef = useRef<HTMLVideoElement | null>(playerMediaVideoElement ?? null)
  const playerMediaClockRef = useRef<PlayerMediaClockState | null>(playerMediaClock ?? null)
  const requirePlayerMediaVideoRef = useRef(requirePlayerMediaVideo === true)
  const playerMediaSourceKeysRef = useRef<Set<HydraVideoSourceKey>>(new Set())
  const fallbackVideoSourceKeysRef = useRef<Set<HydraVideoSourceKey>>(new Set())
  const compatRef = useRef<HydraAudioCompat | null>(null)
  const timerOwnerRef = useRef<HydraTimerOwner>(Symbol('hydraTimers'))
  const appliedBindingKeysRef = useRef<Set<string>>(new Set())
  const playerMediaElementIdsRef = useRef<WeakMap<HTMLVideoElement, number>>(new WeakMap())
  const nextPlayerMediaElementIdRef = useRef(1)
  const lastEvalIdentityRef = useRef<{
    code: string
    visualizerRunId: VisualizerRunId | null
    requirePlayerMediaVideo: boolean
    playerMediaVideoElement: HTMLVideoElement | null
    mediaId: number | null
    queueId: number | null
  } | null>(null)
  const playerInstanceIdRef = useRef<PlayerInstanceId | null | undefined>(playerInstanceId)
  const [remoteVideoEpoch, setRemoteVideoEpoch] = useState(0)

  const getPlayerMediaElementId = useCallback((element: HTMLVideoElement | null) => {
    if (!element) return 'no-provider'
    let id = playerMediaElementIdsRef.current.get(element)
    if (typeof id !== 'number') {
      id = nextPlayerMediaElementIdRef.current++
      playerMediaElementIdsRef.current.set(element, id)
    }
    return `provider-${id}`
  }, [])

  const getCurrentEvalIdentity = useCallback((nextCode: string, runId?: VisualizerRunId | null) => {
    const clock = playerMediaClockRef.current
    return {
      code: nextCode,
      visualizerRunId: runId ?? null,
      requirePlayerMediaVideo: requirePlayerMediaVideoRef.current,
      playerMediaVideoElement: playerMediaVideoElementRef.current,
      mediaId: typeof clock?.mediaId === 'number' ? clock.mediaId : null,
      queueId: typeof clock?.queueId === 'number' ? clock.queueId : null,
    }
  }, [])

  const isSameEvalIdentity = useCallback((
    a: ReturnType<typeof getCurrentEvalIdentity> | null,
    b: ReturnType<typeof getCurrentEvalIdentity>,
  ) => {
    return a?.code === b.code
      && a.visualizerRunId === b.visualizerRunId
      && a.requirePlayerMediaVideo === b.requirePlayerMediaVideo
      && a.playerMediaVideoElement === b.playerMediaVideoElement
      && a.mediaId === b.mediaId
      && a.queueId === b.queueId
  }, [])

  const emitAppliedForRun = useCallback((runId?: VisualizerRunId | null) => {
    const currentPlayerInstanceId = playerInstanceIdRef.current
    if (!runId || !currentPlayerInstanceId) return
    if (requirePlayerMediaVideoRef.current && !playerMediaVideoElementRef.current) return
    const playerMediaKeys = Array.from(playerMediaSourceKeysRef.current).sort()
    const fallbackVideoKeys = Array.from(fallbackVideoSourceKeysRef.current).sort()
    const clock = playerMediaClockRef.current
    const appliedBindingKey = [
      runId,
      requirePlayerMediaVideoRef.current ? 'required-player-media' : 'optional-video',
      getPlayerMediaElementId(playerMediaVideoElementRef.current),
      typeof clock?.mediaId === 'number' ? clock.mediaId : 'no-media',
      typeof clock?.queueId === 'number' ? clock.queueId : 'no-queue',
      playerMediaKeys.join(','),
      fallbackVideoKeys.join(','),
    ].join(':')
    if (appliedBindingKeysRef.current.has(appliedBindingKey)) return
    appliedBindingKeysRef.current.add(appliedBindingKey)
    const sourceBindingPayload = playerMediaKeys.length > 0
      && clock?.mediaType === 'mp4'
      && typeof clock.mediaId === 'number'
      && clock.mediaId > 0
      && typeof clock.queueId === 'number'
      && clock.queueId > 0
      && Number.isFinite(clock.position)
      && typeof clock.statusAt === 'number'
      && clock.statusAt > 0
      ? {
          sourceBindingStatus: 'player-media',
          sourceBindingMediaId: clock.mediaId,
          sourceBindingQueueId: clock.queueId,
          sourceBindingPosition: clock.position,
          sourceBindingStatusAt: clock.statusAt,
          sourceBindingSourceKeys: playerMediaKeys,
        }
      : fallbackVideoKeys.length > 0
        ? {
            sourceBindingStatus: 'fallback-external',
            sourceBindingSourceKeys: fallbackVideoKeys,
          }
        : {
            sourceBindingStatus: 'not-tracked',
          }

    dispatchRef.current({
      type: PLAYER_EMIT_VISUALIZER_APPLIED,
      payload: {
        visualizerRunId: runId,
        playerInstanceId: currentPlayerInstanceId,
        ...sourceBindingPayload,
      },
    })
  }, [getPlayerMediaElementId])

  const reportCameraSourcesBound = useCallback(() => {
    if (!onCameraSourcesBoundChange) return
    const bound = Array.from(cameraInitRef.current).sort()
    onCameraSourcesBoundChange(bound)
  }, [onCameraSourcesBoundChange])

  const pruneStaleCameraBindings = useCallback((sources: string[]) => {
    const activeSources = new Set(sources)
    for (const src of Array.from(cameraInitRef.current)) {
      if (!activeSources.has(src)) {
        cameraInitRef.current.delete(src)
      }
    }
  }, [])

  const { update: updateAudio, compat, audioRef } = useHydraAudio(
    audioSourceNode,
    sensitivity,
    overrideData,
  )
  // Throttle FFT emission to ~20Hz (50ms)
  const emitFftData = useMemo(() => throttle((data: AudioData) => {
    // Send a condensed payload to save bandwidth
    const payload = {
      fft: Array.from(compat.fft), // Use the downsampled/smoothed FFT from compat
      bass: data.bass,
      mid: data.mid,
      treble: data.treble,
      beat: data.beatIntensity,
      energy: data.energy,
      bpm: data.beatFrequency,
      bright: data.spectralCentroid,
    }

    dispatch({
      type: PLAYER_EMIT_FFT,
      payload,
      meta: { throttle: { wait: 50, leading: false } },
    })
  }, 50, { leading: false, trailing: true }), [dispatch, compat])

  useEffect(() => {
    return () => {
      emitFftData.cancel()
    }
  }, [emitFftData])

  useEffect(() => {
    widthRef.current = width
    heightRef.current = height
    codeRef.current = code
  }, [width, height, code])

  useEffect(() => {
    dispatchRef.current = dispatch
    playerInstanceIdRef.current = playerInstanceId
    playerMediaVideoElementRef.current = playerMediaVideoElement ?? null
    playerMediaClockRef.current = playerMediaClock ?? null
    requirePlayerMediaVideoRef.current = requirePlayerMediaVideo === true
  }, [dispatch, playerInstanceId, playerMediaVideoElement, playerMediaClock, requirePlayerMediaVideo])

  // Override initCam() to use remote video when present
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    const sources = ['s0', 's1', 's2', 's3']
    const previousRemote = prevRemoteVideoRef.current
    const nextRemote = remoteVideoElement ?? null

    if (previousRemote !== nextRemote) {
      cameraDiag('remote video element changed', {
        hadPreviousRemote: Boolean(previousRemote),
        hasNextRemote: Boolean(nextRemote),
        nextRemote: snapshotVideoElement(nextRemote),
      })
      cameraInitRef.current.clear()
      reportCameraSourcesBound()
    }

    if (nextRemote) {
      protectVideoElement(nextRemote)
      cameraDiag('applyRemoteCameraOverride', snapshotVideoElement(nextRemote))
      applyRemoteCameraOverride(sources, nextRemote, w, cameraOverrideRef.current)
    } else {
      cameraDiag('restoreRemoteCameraOverride')
      restoreRemoteCameraOverride(w, cameraOverrideRef.current)
    }

    prevRemoteVideoRef.current = nextRemote
  }, [remoteVideoElement, reportCameraSourcesBound])

  // Remote video lifecycle diagnostics to chase black-screen conditions.
  useEffect(() => {
    if (!remoteVideoElement) return

    const events = ['loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'ended', 'error'] as const
    const handlers = events.map((eventName) => {
      const handler = () => {
        cameraDiag('remote video event', { eventName, video: snapshotVideoElement(remoteVideoElement) })
        setRemoteVideoEpoch(prev => prev + 1)
      }
      remoteVideoElement.addEventListener(eventName, handler)
      return { eventName, handler }
    })

    cameraDiag('attached remote video diagnostics', snapshotVideoElement(remoteVideoElement))

    return () => {
      for (const { eventName, handler } of handlers) {
        remoteVideoElement.removeEventListener(eventName, handler)
      }
    }
  }, [remoteVideoElement])

  // Keep compatRef in sync via effect (cannot assign ref during render)
  useEffect(() => {
    compatRef.current = compat
  }, [compat])

  // Set window.a compat and mouse shims so Hydra code can reference a.fft, controls, and legacy mouse globals
  useEffect(() => {
    setAudioGlobals(compat)
    setMouseShims()
    return () => {
      clearAudioGlobals()
      clearMouseShims()
    }
  }, [compat])

  // Initialize Hydra (mount-only)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    log('Initializing')

    let hydra: Hydra
    try {
      hydra = new Hydra({
        canvas,
        width: widthRef.current,
        height: heightRef.current,
        detectAudio: false,
        makeGlobal: true,
        autoLoop: false,
        precision: 'mediump',
      })
    } catch (err) {
      warn('Failed to initialize:', err)
      return
    }

    hydraRef.current = hydra
    installHydraTimerTracking(timerOwnerRef.current, (errorOwner) => {
      if (errorOwner === timerOwnerRef.current) {
        warn('Timer error threshold reached, cleared broken timers (render graph continues)')
      }
    })
    errorCountRef.current = 0

    // Override initVideo() before first code execution so proxy is active immediately
    const w = window as unknown as Record<string, unknown>
    const videoSources = ['s0', 's1', 's2', 's3']
    const videoProxyOverrides = videoProxyOverrideRef.current
    applyVideoProxyOverride(videoSources, w, videoProxyOverrides, {
      getPlayerMediaVideoElement: () => playerMediaVideoElementRef.current,
      shouldRequirePlayerMediaVideo: () => requirePlayerMediaVideoRef.current,
      onPlayerMediaSourceBound: (sourceKey) => {
        if (!isHydraVideoSourceKey(sourceKey)) return
        playerMediaSourceKeysRef.current.add(sourceKey)
        fallbackVideoSourceKeysRef.current.delete(sourceKey)
      },
      onPlayerMediaSourceWaiting: (sourceKey) => {
        if (!isHydraVideoSourceKey(sourceKey)) return
        playerMediaSourceKeysRef.current.delete(sourceKey)
        fallbackVideoSourceKeysRef.current.delete(sourceKey)
      },
      onFallbackVideoSourceBound: (sourceKey) => {
        if (!isHydraVideoSourceKey(sourceKey)) return
        fallbackVideoSourceKeysRef.current.add(sourceKey)
        playerMediaSourceKeysRef.current.delete(sourceKey)
      },
    })
    patchHydraSourceTick(videoSources, w)

    // If remote camera is already attached before Hydra init, apply override now.
    if (remoteVideoElement) {
      cameraDiag('applyRemoteCameraOverride after hydra init', snapshotVideoElement(remoteVideoElement))
      applyRemoteCameraOverride(videoSources, remoteVideoElement, w, cameraOverrideRef.current)
    }

    // Execute initial patch and render first frame immediately
    playerMediaSourceKeysRef.current.clear()
    fallbackVideoSourceKeysRef.current.clear()
    const timerOwner = timerOwnerRef.current
    const initialCode = codeRef.current ?? ''
    lastEvalIdentityRef.current = getCurrentEvalIdentity(initialCode, visualizerRunId)
    const evalResult = executeHydraCode(hydra, initialCode, compatRef.current ?? undefined, timerOwner)
    if (evalResult.ok && tickHydraOnce(hydra, timerOwner)) {
      emitAppliedForRun(visualizerRunId)
    }

    const cameraOverrides = cameraOverrideRef.current
    return () => {
      log('Destroying')
      uninstallHydraTimerTracking(timerOwner)
      restoreRemoteCameraOverride(w, cameraOverrides)
      restoreVideoProxyOverride(w, videoProxyOverrides)
      cancelAnimationFrame(rafRef.current)
      try {
        hydra.regl.destroy()
      } catch {
        // WebGL context may already be lost
      }
      hydraRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only — resize handled separately; remoteVideoElement deliberately omitted

  // Tick once when a video source finishes loading so the frame renders even
  // when paused (isPlaying=false).  Uses rAF to coalesce rapid events.
  useEffect(() => {
    let rafId = 0
    const onVideoReady = () => {
      if (rafId) return // already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const hydra = hydraRef.current
        if (!hydra) return
        try {
          withHydraTimerOwner(timerOwnerRef.current, () => hydra.tick(16.67))
        } catch {
          // Bad user code — swallow so it doesn't cascade
        }
      })
    }
    window.addEventListener(HYDRA_VIDEO_READY_EVENT, onVideoReady)
    return () => {
      window.removeEventListener(HYDRA_VIDEO_READY_EVENT, onVideoReady)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // Resize without recreating WebGL context
  useEffect(() => {
    const hydra = hydraRef.current
    if (!hydra) return
    hydra.setResolution(width, height)
  }, [width, height])

  // Camera auto-init: when allowCamera flips true, init camera for detected sources
  // Uses remote WebRTC video when available, falls back to local initCam()
  useEffect(() => {
    if (!allowCamera && !remoteVideoElement) {
      cameraDiag('camera auto-init disabled (no allowCamera + no remote video)')
      cameraInitRef.current.clear()
      reportCameraSourcesBound()
      return
    }

    const currentCode = getHydraEvalCode(codeRef.current)
    const { sources, sourceInitMap } = detectCameraUsage(currentCode)
    const w = window as unknown as Record<string, unknown>
    const remoteVideoReady = isRemoteVideoRenderable(remoteVideoElement ?? null)

    cameraDiag('camera auto-init pass', {
      sourceCount: sources.length,
      sources,
      sourceInitMap,
      allowCamera: Boolean(allowCamera),
      hasRemoteVideo: Boolean(remoteVideoElement),
      remoteVideoReady,
      remoteVideo: snapshotVideoElement(remoteVideoElement ?? null),
    })

    pruneStaleCameraBindings(sources)

    for (const src of sources) {
      // Skip sources that manage their own video/image/screen init — check FIRST
      // so we also clear stale camera tracking for sources that switched to explicit init
      if (sourceInitMap[src]?.hasExplicitInit) {
        if (cameraInitRef.current.has(src)) {
          cameraInitRef.current.delete(src)
        }
        cameraDiag('source has explicit init; skipping camera auto-bind', { src })
        continue
      }

      if (cameraInitRef.current.has(src)) {
        cameraDiag('camera source already initialized; skipping', { src })
        continue
      }

      const extSrc = w[src] as { initCam?: (index?: number) => void, init?: (opts: { src: HTMLVideoElement }) => void } | undefined
      if (!extSrc) {
        cameraDiag('hydra source missing on window', { src })
        continue
      }

      try {
        if (remoteVideoElement && !remoteVideoReady) {
          cameraDiag('remote video not renderable yet; skipping source bind', {
            src,
            video: snapshotVideoElement(remoteVideoElement),
          })
          continue
        }

        if (remoteVideoElement && extSrc.init) {
          cameraDiag('binding remote video to hydra source', { src, video: snapshotVideoElement(remoteVideoElement) })
          extSrc.init.call(extSrc, { src: remoteVideoElement })
          cameraInitRef.current.add(src)
        } else if (allowCamera && extSrc.initCam) {
          cameraDiag('calling extSrc.initCam()', { src })
          extSrc.initCam()
          cameraInitRef.current.add(src)
        } else {
          cameraDiag('source had no compatible init method for current mode', {
            src,
            hasInit: typeof extSrc.init === 'function',
            hasInitCam: typeof extSrc.initCam === 'function',
            allowCamera: Boolean(allowCamera),
            hasRemoteVideo: Boolean(remoteVideoElement),
          })
        }
      } catch (err) {
        warn('Camera init failed for', src, err)
      }
    }

    reportCameraSourcesBound()
  }, [allowCamera, remoteVideoElement, remoteVideoEpoch, reportCameraSourcesBound, pruneStaleCameraBindings])

  // Re-execute code when it changes
  useEffect(() => {
    const hydra = hydraRef.current
    if (!hydra) return

    // Re-check camera init when code changes with camera enabled
    if (allowCamera || remoteVideoElement) {
      const { sources, sourceInitMap } = detectCameraUsage(getHydraEvalCode(code))
      const w = window as unknown as Record<string, unknown>
      const remoteVideoReady = isRemoteVideoRenderable(remoteVideoElement ?? null)

      cameraDiag('camera rebind on code change', {
        sourceCount: sources.length,
        sources,
        sourceInitMap,
        allowCamera: Boolean(allowCamera),
        hasRemoteVideo: Boolean(remoteVideoElement),
        remoteVideoReady,
        remoteVideo: snapshotVideoElement(remoteVideoElement ?? null),
      })

      pruneStaleCameraBindings(sources)

      for (const src of sources) {
        // Skip sources that manage their own video/image/screen init — check FIRST
        if (sourceInitMap[src]?.hasExplicitInit) {
          if (cameraInitRef.current.has(src)) {
            cameraInitRef.current.delete(src)
          }
          cameraDiag('source has explicit init on code change; skipping camera auto-bind', { src })
          continue
        }

        if (cameraInitRef.current.has(src)) {
          cameraDiag('camera source already initialized on code change; skipping', { src })
          continue
        }

        const extSrc = w[src] as { initCam?: (index?: number) => void, init?: (opts: { src: HTMLVideoElement }) => void } | undefined
        if (!extSrc) {
          cameraDiag('hydra source missing on window during code-change rebind', { src })
          continue
        }

        try {
          if (remoteVideoElement && !remoteVideoReady) {
            cameraDiag('remote video not renderable yet on code change; skipping source rebind', {
              src,
              video: snapshotVideoElement(remoteVideoElement),
            })
            continue
          }

          if (remoteVideoElement && extSrc.init) {
            cameraDiag('rebind remote video to source on code change', { src, video: snapshotVideoElement(remoteVideoElement) })
            extSrc.init.call(extSrc, { src: remoteVideoElement })
            cameraInitRef.current.add(src)
          } else if (allowCamera && extSrc.initCam) {
            cameraDiag('re-run initCam on code change', { src })
            extSrc.initCam()
            cameraInitRef.current.add(src)
          } else {
            cameraDiag('no compatible init method during code-change rebind', {
              src,
              hasInit: typeof extSrc.init === 'function',
              hasInitCam: typeof extSrc.initCam === 'function',
              allowCamera: Boolean(allowCamera),
              hasRemoteVideo: Boolean(remoteVideoElement),
            })
          }
        } catch (err) {
          warn('Camera init failed for', src, err)
        }
      }
    }

    reportCameraSourcesBound()

    const nextCode = code ?? ''
    const nextIdentity = getCurrentEvalIdentity(nextCode, visualizerRunId)
    if (isSameEvalIdentity(lastEvalIdentityRef.current, nextIdentity)) return
    lastEvalIdentityRef.current = nextIdentity

    // Clear previous render graph to prevent oscillator bleed between presets.
    // Always use softHush — hydra.hush() calls source.clear() which destroys
    // WebRTC tracks AND in-flight video elements (initVideo sets s0.src async
    // on loadeddata; hush nulls it before the video loads, causing 10 tick
    // errors and fallback to DEFAULT_PATCH).
    softHush(hydra)
    playerMediaSourceKeysRef.current.clear()
    fallbackVideoSourceKeysRef.current.clear()

    const evalResult = executeHydraCode(hydra, nextCode, compatRef.current ?? undefined, timerOwnerRef.current)
    errorCountRef.current = 0

    // Render one frame immediately so the new graph is visible even when the
    // RAF loop is stopped (isPlaying=false). Matches the mount-only effect.
    if (evalResult.ok && tickHydraOnce(hydra, timerOwnerRef.current)) {
      emitAppliedForRun(visualizerRunId)
    }
  }, [
    code,
    allowCamera,
    remoteVideoElement,
    reportCameraSourcesBound,
    pruneStaleCameraBindings,
    emitAppliedForRun,
    visualizerRunId,
    getCurrentEvalIdentity,
    isSameEvalIdentity,
    playerMediaVideoElement,
    playerMediaClock?.mediaId,
    playerMediaClock?.queueId,
    requirePlayerMediaVideo,
  ])

  // Animation tick
  const tick = useCallback((time: number) => {
    const hydra = hydraRef.current
    if (!hydra) return

    // Update audio data from analyser
    updateAudio()

    // Emit FFT if enabled (always emit while Hydra is running)
    if (emitFft && shouldEmitFft(isPlaying)) {
      emitFftData(audioRef.current)
    }

    // Calculate delta time in milliseconds
    const dt = lastTimeRef.current ? time - lastTimeRef.current : 16.67
    lastTimeRef.current = time

    try {
      withHydraTimerOwner(timerOwnerRef.current, () => hydra.tick(dt))
    } catch (err) {
      errorCountRef.current++
      if (errorCountRef.current <= 3) {
        warn('Tick error:', err)
      }
      if (errorCountRef.current === 10) {
        warn('Too many errors, re-applying default patch')
        telemetry.emit(HYDRA_FALLBACK_APPLIED, { reason: 'tick_error_threshold' })
        executeHydraCode(hydra, DEFAULT_PATCH, compatRef.current ?? undefined, timerOwnerRef.current)
        errorCountRef.current = 0
      }
    }

    frameCountRef.current += 1
    if (process.env.NODE_ENV !== 'production' && frameCountRef.current % 120 === 1) {
      const w = window as unknown as Record<string, unknown>
      const bassFn = w.bass
      const bassValue = typeof bassFn === 'function' ? (bassFn as () => number)() : 'unset'
      console.log('[Hydra] audio sample:', { bass: bassValue })
    }
  }, [updateAudio, emitFft, isPlaying, emitFftData, audioRef])

  // Start/stop animation based on isPlaying
  useEffect(() => {
    if (isPlaying && hydraRef.current) {
      lastTimeRef.current = 0
      const frame = (time: number) => {
        tick(time)
        rafRef.current = requestAnimationFrame(frame)
      }
      rafRef.current = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(rafRef.current)
    }

    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, tick])

  const containerStyle: React.CSSProperties = { width, height }
  if (typeof layer === 'number') {
    containerStyle.zIndex = layer
  }

  return (
    <div className={styles.container} style={containerStyle}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={width}
        height={height}
      />
    </div>
  )
}

// Error boundary wrapper
interface ErrorBoundaryState {
  hasError: boolean
}

class HydraErrorBoundary extends React.Component<
  { children: React.ReactNode, width: number, height: number, layer?: number },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError (): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch (error: Error) {
    warn('Error boundary caught:', error.message)
    // Auto-recover after 2 seconds
    this.recoveryTimer = setTimeout(() => {
      this.setState({ hasError: false })
    }, 2000)
  }

  componentWillUnmount () {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer)
  }

  render () {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: this.props.width,
            height: this.props.height,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: typeof this.props.layer === 'number' ? this.props.layer : -1,
          }}
        />
      )
    }
    return this.props.children
  }
}

// Wrapped export with error boundary
function HydraVisualizerWithBoundary (props: HydraVisualizerProps) {
  return (
    <HydraErrorBoundary width={props.width} height={props.height} layer={props.layer}>
      <HydraVisualizer {...props} />
    </HydraErrorBoundary>
  )
}

export default HydraVisualizerWithBoundary
