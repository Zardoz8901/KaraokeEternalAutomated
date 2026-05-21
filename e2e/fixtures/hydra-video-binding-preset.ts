/**
 * Hydra preset for manual Player MP4 binding smoke checks.
 * The URLs are intentionally inert: when Player MP4 media is active, the
 * runtime should bind every source to the borrowed Player/shadow video instead.
 */
export const HYDRA_VIDEO_BINDING_SMOKE_PRESET_CODE = `
s0.initVideo('https://example.invalid/o0.mp4', { startTime: 'random' })
s1.initVideo('https://example.invalid/o1.mp4', { startTime: 'random' })
s2.initVideo('https://example.invalid/o2.mp4', { startTime: 'random' })
s3.initVideo('https://example.invalid/o3.mp4', { startTime: 'random' })

src(s0).out(o0)
src(s1).out(o1)
src(s2).out(o2)
src(s3).out(o3)

render()
`.trim()
