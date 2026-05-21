import { describe, expect, it } from 'vitest'
import { shouldMountPlayerVisualizer } from './playerVisualizerMountPolicy'

describe('playerVisualizerMountPolicy', () => {
  const base = {
    isWebGLSupported: true,
    isVisualizerEnabled: true,
    hasVisualizerAudioSource: true,
  }

  it('mounts Hydra for CDG playback', () => {
    expect(shouldMountPlayerVisualizer({
      ...base,
      mediaType: 'cdg',
      isVideoKeyingEnabled: false,
    })).toBe(true)
  })

  it('mounts Hydra for video-keyed MP4 playback', () => {
    expect(shouldMountPlayerVisualizer({
      ...base,
      mediaType: 'mp4',
      isVideoKeyingEnabled: true,
    })).toBe(true)
  })

  it('does not mount Hydra for plain MP4 playback', () => {
    expect(shouldMountPlayerVisualizer({
      ...base,
      mediaType: 'mp4',
      isVideoKeyingEnabled: false,
    })).toBe(false)
  })
})
