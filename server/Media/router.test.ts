import { describe, it, expect } from 'vitest'
import path from 'path'
import { isWithinBasePath } from './router.js'

describe('isWithinBasePath', () => {
  const basePath = '/media/karaoke'

  it('allows a normal relPath within basePath', () => {
    const file = path.join(basePath, 'Artist/Song.mp3')
    expect(isWithinBasePath(file, basePath)).toBe(true)
  })

  it('allows deeply nested relPath within basePath', () => {
    const file = path.join(basePath, 'Genre/Artist/Album/Song.cdg')
    expect(isWithinBasePath(file, basePath)).toBe(true)
  })

  it('rejects relPath escaping basePath via ../', () => {
    const file = path.join(basePath, '../../etc/passwd')
    expect(isWithinBasePath(file, basePath)).toBe(false)
  })

  it('rejects relPath escaping basePath via intermediate ../', () => {
    const file = path.join(basePath, 'Artist/../../etc/shadow')
    expect(isWithinBasePath(file, basePath)).toBe(false)
  })

  it('rejects prefix collision (basePath-other)', () => {
    // /media/karaoke-other/file should NOT match /media/karaoke
    const file = '/media/karaoke-other/Song.mp3'
    expect(isWithinBasePath(file, basePath)).toBe(false)
  })

  it('allows basePath itself (edge case)', () => {
    expect(isWithinBasePath(basePath, basePath)).toBe(true)
  })
})
