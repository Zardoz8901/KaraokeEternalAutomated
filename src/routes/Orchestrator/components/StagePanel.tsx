import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useResizeObserver from 'use-resize-observer'
import type { VisualizerMode } from 'shared/types'
import { detectCameraUsage } from 'lib/detectCameraUsage'
import HydraPreview from './HydraPreview'
import styles from './StagePanel.css'
import { BUFFER_OPTIONS, buildPreviewCode, type StageBuffer } from './stagePanelUtils'
import PresetPicker from './PresetPicker'
import { formatCameraPipelineLabel, getCameraPipelineState, type CameraRelayStatus } from './hydraPreviewUtils'
import type { PresetLeaf } from './presetTree'
import { fitPreviewToFrame, type PreviewSize } from '../views/orchestratorLayout'

interface StagePanelProps {
  code: string
  width: number
  height: number
  buffer: StageBuffer
  onBufferChange: (buffer: StageBuffer) => void
  localCameraStream?: MediaStream | null
  onPresetLoad?: (code: string) => void
  onPresetSend?: (preset: PresetLeaf) => void
  onRandomize?: () => void
  statusStrip?: React.ReactNode
  visualizerMode: VisualizerMode
  visualizerEnabled: boolean
  visualizerSensitivity: number
  visualizerAllowCamera: boolean
  cameraRelayStatus: CameraRelayStatus
}

const FRAME_RESIZE_DEBOUNCE_MS = 120

function getWindowDevicePixelRatio (): number {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio
}

function requestMeasureFrame (callback: FrameRequestCallback): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback)
  }
  return setTimeout(() => callback(Date.now()), 0) as unknown as number
}

function cancelMeasureFrame (id: number): void {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id)
    return
  }
  clearTimeout(id)
}

function StagePanel ({
  code,
  width,
  height,
  buffer,
  onBufferChange,
  localCameraStream,
  onPresetLoad,
  onPresetSend,
  onRandomize,
  statusStrip,
  visualizerMode,
  visualizerEnabled,
  visualizerSensitivity,
  visualizerAllowCamera,
  cameraRelayStatus,
}: StagePanelProps) {
  const stageFrameRef = useRef<HTMLDivElement | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestFrameSizeRef = useRef<{ width?: number, height?: number } | null>(null)
  const [measuredPreviewSize, setMeasuredPreviewSize] = useState<PreviewSize | null>(null)
  const previewCode = useMemo(() => buildPreviewCode(code, buffer), [code, buffer])
  const cameraUsage = useMemo(() => detectCameraUsage(previewCode), [previewCode])
  const [boundCameraSources, setBoundCameraSources] = useState<string[]>([])
  const previewSize = measuredPreviewSize ?? { width, height }

  const usesCameraSource = cameraUsage.sources.length > 0
  const boundSourceCount = usesCameraSource ? boundCameraSources.length : 0

  const cameraPipeline = useMemo(() => getCameraPipelineState({
    cameraStatus: cameraRelayStatus,
    usesCameraSource,
    boundSourceCount,
  }), [boundSourceCount, cameraRelayStatus, usesCameraSource])

  const showCameraPipeline = visualizerEnabled
    && visualizerMode === 'hydra'
    && (usesCameraSource || cameraRelayStatus !== 'idle')

  const cameraPipelineClass = cameraPipeline.level === 'live'
    ? styles.cameraPipelineLive
    : cameraPipeline.level === 'partial'
      ? styles.cameraPipelinePartial
      : styles.cameraPipelineOff

  const handleCameraBoundSourcesChange = useCallback((sources: string[]) => {
    setBoundCameraSources((prev) => {
      if (prev.length === sources.length && prev.every((value, index) => value === sources[index])) {
        return prev
      }
      return sources
    })
  }, [])

  const commitMeasuredPreviewSize = useCallback((frameWidth: number | undefined, frameHeight: number | undefined) => {
    const next = fitPreviewToFrame(frameWidth, frameHeight, {
      dpr: getWindowDevicePixelRatio(),
    })

    setMeasuredPreviewSize((current) => {
      const previous = current ?? { width, height }
      if (previous.width === next.width && previous.height === next.height) {
        return current
      }
      return next
    })
  }, [height, width])

  const scheduleMeasuredPreviewSize = useCallback(({ width: frameWidth, height: frameHeight }: { width?: number, height?: number }) => {
    latestFrameSizeRef.current = { width: frameWidth, height: frameHeight }

    if (resizeFrameRef.current !== null) {
      cancelMeasureFrame(resizeFrameRef.current)
    }

    resizeFrameRef.current = requestMeasureFrame(() => {
      resizeFrameRef.current = null

      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current)
      }

      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null
        const latest = latestFrameSizeRef.current
        commitMeasuredPreviewSize(latest?.width, latest?.height)
      }, FRAME_RESIZE_DEBOUNCE_MS)
    })
  }, [commitMeasuredPreviewSize])

  useResizeObserver<HTMLDivElement>({
    ref: stageFrameRef,
    box: 'content-box',
    onResize: scheduleMeasuredPreviewSize,
  })

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current !== null) {
        cancelMeasureFrame(resizeFrameRef.current)
      }
      if (resizeTimerRef.current !== null) {
        clearTimeout(resizeTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={styles.stage}>
      <div className={styles.stageHeader}>
        <div className={styles.stageHeaderLeft}>
          <div className={styles.stageTitle}>
            Stage
            <span className={styles.stageHint}>Preview</span>
          </div>
          {(onPresetLoad || onPresetSend || onRandomize) && (
            <PresetPicker
              onLoad={onPresetLoad}
              onSend={onPresetSend}
              onRandomize={onRandomize}
            />
          )}
        </div>
        {statusStrip && (
          <div className={styles.stageStatusSlot}>
            {statusStrip}
          </div>
        )}
        <div className={styles.stageHeaderRight}>
          {showCameraPipeline && (
            <div className={`${styles.cameraPipeline} ${cameraPipelineClass}`}>
              <span className={styles.cameraPipelineLabel}>{formatCameraPipelineLabel(cameraPipeline)}</span>
              {cameraPipeline.level === 'partial' && cameraPipeline.missing.length > 0 && (
                <span className={styles.cameraPipelineDetail}>{`Missing: ${cameraPipeline.missing.join(', ')}`}</span>
              )}
            </div>
          )}
          <div className={styles.bufferControls} role='radiogroup' aria-label='Preview output buffer'>
            {BUFFER_OPTIONS.map(option => (
              <button
                key={option.key}
                type='button'
                role='radio'
                aria-checked={buffer === option.key}
                aria-label={`Output buffer ${option.label}`}
                className={`${styles.bufferButton} ${buffer === option.key ? styles.bufferButtonActive : ''}`}
                onClick={() => onBufferChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.stageBody}>
        <div className={styles.stageFrame} ref={stageFrameRef}>
          <HydraPreview
            code={previewCode}
            width={previewSize.width}
            height={previewSize.height}
            localCameraStream={localCameraStream}
            mode={visualizerMode}
            isEnabled={visualizerEnabled}
            sensitivity={visualizerSensitivity}
            allowCamera={visualizerAllowCamera}
            onCameraBoundSourcesChange={handleCameraBoundSourcesChange}
          />
        </div>
      </div>
    </div>
  )
}

export default StagePanel
