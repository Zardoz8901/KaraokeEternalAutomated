import { describe, expect, it } from 'vitest'
import {
  isValidPayloadSize,
  isValidCameraOffer,
  isValidCameraAnswer,
  isValidCameraIce,
  isValidCameraStop,
  isValidHydraCode,
} from './payloadGuards.js'

describe('isValidPayloadSize', () => {
  it('accepts an object under the size limit', () => {
    expect(isValidPayloadSize({ sdp: 'x' })).toBe(true)
  })

  it('rejects an object over the size limit', () => {
    const huge = { data: 'x'.repeat(100_000) }
    expect(isValidPayloadSize(huge)).toBe(false)
  })

  it('respects a custom maxBytes argument', () => {
    const payload = { data: 'hello' }
    expect(isValidPayloadSize(payload, 5)).toBe(false)
    expect(isValidPayloadSize(payload, 500)).toBe(true)
  })

  it('rejects non-object payloads', () => {
    expect(isValidPayloadSize(null)).toBe(false)
    expect(isValidPayloadSize('string')).toBe(false)
    expect(isValidPayloadSize(42)).toBe(false)
    expect(isValidPayloadSize(undefined)).toBe(false)
  })

  it('rejects arrays', () => {
    expect(isValidPayloadSize([1, 2, 3])).toBe(false)
  })

  it('returns false for circular references instead of throwing', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(isValidPayloadSize(circular)).toBe(false)
  })
})

describe('isValidCameraOffer', () => {
  it('accepts a valid offer payload', () => {
    expect(isValidCameraOffer({ sdp: 'v=0...', type: 'offer' })).toBe(true)
  })

  it('rejects when sdp is missing', () => {
    expect(isValidCameraOffer({ type: 'offer' })).toBe(false)
  })

  it('rejects when type is missing', () => {
    expect(isValidCameraOffer({ sdp: 'v=0...' })).toBe(false)
  })

  it('rejects when type is not "offer"', () => {
    expect(isValidCameraOffer({ sdp: 'v=0...', type: 'answer' })).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidCameraOffer(null)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isValidCameraOffer('string')).toBe(false)
    expect(isValidCameraOffer(42)).toBe(false)
  })
})

describe('isValidCameraAnswer', () => {
  it('accepts a valid answer payload', () => {
    expect(isValidCameraAnswer({ sdp: 'v=0...', type: 'answer' })).toBe(true)
  })

  it('rejects when sdp is missing', () => {
    expect(isValidCameraAnswer({ type: 'answer' })).toBe(false)
  })

  it('rejects when type is not "answer"', () => {
    expect(isValidCameraAnswer({ sdp: 'v=0...', type: 'offer' })).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidCameraAnswer(null)).toBe(false)
  })
})

describe('isValidCameraIce', () => {
  it('accepts a payload with candidate field', () => {
    expect(isValidCameraIce({ candidate: 'candidate:...', sdpMid: '0', sdpMLineIndex: 0 })).toBe(true)
  })

  it('accepts a payload with null candidate (end-of-candidates)', () => {
    expect(isValidCameraIce({ candidate: null })).toBe(true)
  })

  it('rejects a payload without candidate field', () => {
    expect(isValidCameraIce({ sdpMid: '0' })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isValidCameraIce(null)).toBe(false)
    expect(isValidCameraIce('string')).toBe(false)
  })
})

describe('isValidCameraStop', () => {
  it('accepts an empty object', () => {
    expect(isValidCameraStop({})).toBe(true)
  })

  it('accepts an object with reason', () => {
    expect(isValidCameraStop({ reason: 'user stopped' })).toBe(true)
  })

  it('rejects null', () => {
    expect(isValidCameraStop(null)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isValidCameraStop('string')).toBe(false)
    expect(isValidCameraStop(42)).toBe(false)
  })
})

describe('isValidHydraCode', () => {
  it('accepts a payload with non-empty code string', () => {
    expect(isValidHydraCode({ code: 'osc(10).out()' })).toBe(true)
  })

  it('rejects when code is empty string', () => {
    expect(isValidHydraCode({ code: '' })).toBe(false)
  })

  it('rejects when code is missing', () => {
    expect(isValidHydraCode({})).toBe(false)
  })

  it('rejects when code is not a string', () => {
    expect(isValidHydraCode({ code: 42 })).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidHydraCode(null)).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isValidHydraCode('osc(10).out()')).toBe(false)
  })

  it('accepts payload with extra fields (e.g. hydraPresetFolderId)', () => {
    expect(isValidHydraCode({ code: 'osc(10).out()', hydraPresetFolderId: 2 })).toBe(true)
  })
})
