/**
 * Socket payload validation guards for WebRTC relay and Hydra code handlers.
 * Mirrors client-side guards in src/lib/webrtc/CameraSignaling.ts but
 * enforces server-side size caps before broadcast.
 *
 * Security: H-1 (WebRTC payload validation), H-2 (Hydra code size limit)
 */

const MAX_PAYLOAD_BYTES = 65_536 // 64 KB

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reject payloads that exceed the byte-size cap when JSON-serialized.
 * Also rejects non-plain-objects (null, arrays, primitives).
 */
export function isValidPayloadSize (payload: unknown, maxBytes = MAX_PAYLOAD_BYTES): boolean {
  if (!isPlainObject(payload)) return false
  try {
    return Buffer.byteLength(JSON.stringify(payload), 'utf8') <= maxBytes
  } catch {
    // Circular references or other stringify failures
    return false
  }
}

/** Requires { sdp: string, type: 'offer' } — matches CameraOfferPayload */
export function isValidCameraOffer (payload: unknown): boolean {
  if (!isPlainObject(payload)) return false
  return typeof payload.sdp === 'string' && payload.type === 'offer'
}

/** Requires { sdp: string, type: 'answer' } — matches CameraAnswerPayload */
export function isValidCameraAnswer (payload: unknown): boolean {
  if (!isPlainObject(payload)) return false
  return typeof payload.sdp === 'string' && payload.type === 'answer'
}

/** Requires 'candidate' in payload — matches CameraIcePayload */
export function isValidCameraIce (payload: unknown): boolean {
  if (!isPlainObject(payload)) return false
  return 'candidate' in payload
}

/** Accepts any plain object — matches CameraStopPayload */
export function isValidCameraStop (payload: unknown): boolean {
  return isPlainObject(payload)
}

/** Requires { code: string } with code.length > 0 */
export function isValidHydraCode (payload: unknown): boolean {
  if (!isPlainObject(payload)) return false
  return typeof payload.code === 'string' && payload.code.length > 0
}
