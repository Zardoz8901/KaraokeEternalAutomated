import Rooms from '../Rooms/Rooms.js'
import HydraPresets from '../HydraPresets/HydraPresets.js'
import { resolveRoomAccessPrefs } from '../../shared/roomAccess.js'
import getLogger from '../lib/Log.js'
import {
  isValidPayloadSize,
  isValidCameraOffer,
  isValidCameraAnswer,
  isValidCameraIce,
  isValidCameraStop,
  isValidHydraCode,
} from '../lib/payloadGuards.js'

import {
  PLAYER_CMD_NEXT,
  PLAYER_CMD_OPTIONS,
  PLAYER_CMD_PAUSE,
  PLAYER_CMD_PLAY,
  PLAYER_CMD_REPLAY,
  PLAYER_CMD_VOLUME,
  PLAYER_REQ_NEXT,
  PLAYER_REQ_OPTIONS,
  PLAYER_REQ_PAUSE,
  PLAYER_REQ_PLAY,
  PLAYER_REQ_REPLAY,
  PLAYER_REQ_VOLUME,
  PLAYER_EMIT_STATUS,
  PLAYER_EMIT_FFT,
  PLAYER_EMIT_LEAVE,
  PLAYER_STATUS,
  PLAYER_FFT,
  PLAYER_LEAVE,
  VISUALIZER_HYDRA_CODE_REQ,
  VISUALIZER_HYDRA_CODE,
  CAMERA_OFFER_REQ,
  CAMERA_OFFER,
  CAMERA_ANSWER_REQ,
  CAMERA_ANSWER,
  CAMERA_ICE_REQ,
  CAMERA_ICE,
  CAMERA_STOP_REQ,
  CAMERA_STOP,
} from '../../shared/actionTypes.js'

const log = getLogger('PlayerSocket')

// Track which socket is the active camera publisher per room
const roomCameraPublishers = new Map<number, string>() // roomId → publisherSocketId

// Track which socket is the pinned camera subscriber per room (KI-3)
const roomCameraSubscribers = new Map<number, string>() // roomId → subscriberSocketId

interface HydraBroadcastPayload extends Record<string, unknown> {
  code: string
}

export interface RoomVisualizerState {
  roomId: number
  authorUserId: number | null
  authorName: string
  updatedAt: number
  payload: HydraBroadcastPayload
}

// Track last visualizer state per room for replay to new connections
const roomVisualizerStates = new Map<number, RoomVisualizerState>() // roomId → state

interface RoomControlSocket {
  id?: string
  user?: {
    userId?: number
    roomId?: number
    isAdmin?: boolean
    isGuest?: boolean
    name?: string
    username?: string
  }
}

interface RoomControlAccess {
  hasRoom: boolean
  canManage: boolean
  accessPrefs: ReturnType<typeof resolveRoomAccessPrefs>
}

async function getRoomControlAccess (sock: RoomControlSocket): Promise<RoomControlAccess> {
  const roomId = sock.user?.roomId
  if (typeof roomId !== 'number') {
    return {
      hasRoom: false,
      canManage: false,
      accessPrefs: resolveRoomAccessPrefs(undefined),
    }
  }

  if (sock.user?.isAdmin) {
    return {
      hasRoom: true,
      canManage: true,
      accessPrefs: resolveRoomAccessPrefs(undefined),
    }
  }

  const userId = sock.user?.userId
  if (typeof userId !== 'number') {
    return {
      hasRoom: false,
      canManage: false,
      accessPrefs: resolveRoomAccessPrefs(undefined),
    }
  }

  const res = await Rooms.get(roomId, { status: ['open', 'closed'] })
  const room = res?.entities?.[roomId]
  if (!room) {
    return {
      hasRoom: false,
      canManage: false,
      accessPrefs: resolveRoomAccessPrefs(undefined),
    }
  }

  return {
    hasRoom: true,
    canManage: room.ownerId === userId,
    accessPrefs: resolveRoomAccessPrefs(room.prefs),
  }
}

export async function canManageRoom (sock: RoomControlSocket): Promise<boolean> {
  const access = await getRoomControlAccess(sock)
  return access.hasRoom && access.canManage
}

async function canRelayCamera (sock: RoomControlSocket): Promise<boolean> {
  const access = await getRoomControlAccess(sock)
  return access.hasRoom && (access.canManage || access.accessPrefs.allowGuestCameraRelay)
}

function getSocketUserName (sock: RoomControlSocket): string {
  return sock.user?.name ?? sock.user?.username ?? 'Unknown'
}

function toVisualizerBroadcastPayload (state: RoomVisualizerState): Record<string, unknown> {
  return {
    ...state.payload,
    visualizerAuthorUserId: state.authorUserId,
    visualizerAuthorName: state.authorName,
    visualizerUpdatedAt: state.updatedAt,
  }
}

function storeVisualizerState (
  roomId: number,
  sock: RoomControlSocket,
  payload: HydraBroadcastPayload,
): void {
  roomVisualizerStates.set(roomId, {
    roomId,
    authorUserId: typeof sock.user?.userId === 'number' ? sock.user.userId : null,
    authorName: getSocketUserName(sock),
    updatedAt: Math.floor(Date.now() / 1000),
    payload,
  })
}

async function resolveHydraBroadcastPayload (
  access: RoomControlAccess,
  payload: Record<string, unknown>,
): Promise<HydraBroadcastPayload | null> {
  if (!access.hasRoom) return null

  if (access.canManage) {
    if (!isValidHydraCode(payload)) return null
    return { ...payload, code: payload.code as string }
  }

  if (!access.accessPrefs.allowGuestOrchestrator) return null
  if (!access.accessPrefs.allowRoomCollaboratorsToSendVisualizer) return null

  const presetId = payload.hydraPresetId
  if (!Number.isInteger(presetId)) return null

  const preset = await HydraPresets.getById(presetId as number)
  if (!preset?.code?.trim()) return null

  if (access.accessPrefs.restrictCollaboratorsToPartyPresetFolder === true) {
    const allowedFolderId = access.accessPrefs.partyPresetFolderId
    if (typeof allowedFolderId !== 'number' || preset.folderId !== allowedFolderId) {
      return null
    }
  }

  return {
    code: preset.code,
    hydraPresetId: preset.presetId,
    hydraPresetFolderId: preset.folderId,
    hydraPresetName: preset.name,
    hydraPresetSource: 'folder',
  }
}

function emitCameraRelay (sock: RoomControlSocket, type: string, payload: unknown): void {
  const roomId = sock.user?.roomId
  if (typeof roomId !== 'number') return

  const relaySock = sock as RoomControlSocket & {
    to?: (room: string) => { emit: (event: string, payload: unknown) => void }
    server?: { to: (room: string) => { emit: (event: string, payload: unknown) => void } }
  }

  const roomPrefix = Rooms.prefix(roomId)
  const userName = sock.user?.name ?? 'unknown'
  log.verbose('camera relay %s room=%s sender=%s socket=%s', type, roomId, userName, sock.id)

  // Keep signaling directional: do not echo back to sender.
  if (typeof relaySock.to === 'function') {
    relaySock.to(roomPrefix).emit('action', { type, payload })
    return
  }

  // Fallback for tests/mocks that do not expose sock.to
  relaySock.server?.to(roomPrefix).emit('action', { type, payload })
}

/**
 * If the disconnecting socket was the camera publisher for this room,
 * broadcast CAMERA_STOP and clear the tracking entry.
 */
export function cleanupCameraPublisher (
  roomId: number,
  socketId: string,
  io: { to: (room: string) => { emit: (event: string, payload: unknown) => void } },
): void {
  if (roomCameraPublishers.get(roomId) !== socketId) return

  roomCameraPublishers.delete(roomId)
  roomCameraSubscribers.delete(roomId)
  const roomPrefix = Rooms.prefix(roomId)
  io.to(roomPrefix).emit('action', { type: CAMERA_STOP })
  log.verbose('auto-broadcast CAMERA_STOP room=%s (publisher %s disconnected)', roomId, socketId)
}

/**
 * Get the last visualizer code payload for a room (for state replay to new connections).
 */
export function getLastVisualizerCode (roomId: number): Record<string, unknown> | undefined {
  const state = roomVisualizerStates.get(roomId)
  return state ? toVisualizerBroadcastPayload(state) : undefined
}

/**
 * Get the full attributed visualizer state for a room.
 */
export function getVisualizerState (roomId: number): RoomVisualizerState | undefined {
  return roomVisualizerStates.get(roomId)
}

/**
 * Clear stored visualizer state for a room (called when room empties).
 */
export function clearVisualizerState (roomId: number): void {
  roomVisualizerStates.delete(roomId)
}

/**
 * If the disconnecting socket was the pinned camera subscriber for this room,
 * clear the pin so a new subscriber can take over on the next offer cycle.
 */
export function cleanupCameraSubscriber (
  roomId: number,
  socketId: string,
): void {
  if (roomCameraSubscribers.get(roomId) !== socketId) return
  roomCameraSubscribers.delete(roomId)
  log.verbose('cleared subscriber pin room=%s (subscriber %s disconnected)', roomId, socketId)
}

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [PLAYER_REQ_OPTIONS]: async (sock, { payload }) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_OPTIONS,
      payload,
    })
  },
  [PLAYER_REQ_NEXT]: async (sock) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_NEXT,
    })
  },
  [PLAYER_REQ_PAUSE]: async (sock) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_PAUSE,
    })
  },
  [PLAYER_REQ_PLAY]: async (sock) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_PLAY,
    })
  },
  [PLAYER_REQ_REPLAY]: async (sock, { payload }) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_REPLAY,
      payload,
    })
  },
  [PLAYER_REQ_VOLUME]: async (sock, { payload }) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_CMD_VOLUME,
      payload,
    })
  },
  [PLAYER_EMIT_FFT]: async (sock, { payload }) => {
    if (!(await canManageRoom(sock))) return

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_FFT,
      payload,
    })
  },
  [PLAYER_EMIT_STATUS]: async (sock, { payload }) => {
    if (!(await canManageRoom(sock))) return

    // so we can tell the room when players leave and
    // relay last known player status on client join
    sock._lastPlayerStatus = payload

    sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
      type: PLAYER_STATUS,
      payload,
    })
  },
  [VISUALIZER_HYDRA_CODE_REQ]: async (sock, { payload }) => {
    if (!isValidPayloadSize(payload)) return
    const payloadObject = payload as Record<string, unknown>
    const access = await getRoomControlAccess(sock)
    const broadcastPayload = await resolveHydraBroadcastPayload(access, payloadObject)
    if (!broadcastPayload) return

    const roomId = sock.user.roomId
    if (typeof roomId === 'number') {
      storeVisualizerState(roomId, sock, broadcastPayload)
    }

    sock.server.to(Rooms.prefix(roomId)).emit('action', {
      type: VISUALIZER_HYDRA_CODE,
      payload: typeof roomId === 'number'
        ? getLastVisualizerCode(roomId)
        : broadcastPayload,
    })
  },
  [CAMERA_OFFER_REQ]: async (sock, { payload }) => {
    if (!isValidCameraOffer(payload) || !isValidPayloadSize(payload)) return
    if (!(await canRelayCamera(sock))) {
      log.verbose('camera relay denied %s room=%s socket=%s', CAMERA_OFFER_REQ, sock.user?.roomId, sock.id)
      return
    }

    const roomId = sock.user?.roomId
    if (typeof roomId === 'number') {
      roomCameraPublishers.set(roomId, sock.id)
      roomCameraSubscribers.delete(roomId) // clear stale subscriber pin for new offer cycle
    }

    emitCameraRelay(sock, CAMERA_OFFER, payload)
  },
  [CAMERA_ANSWER_REQ]: async (sock, { payload }) => {
    if (!isValidCameraAnswer(payload) || !isValidPayloadSize(payload)) return
    if (!(await canRelayCamera(sock))) {
      log.verbose('camera relay denied %s room=%s socket=%s', CAMERA_ANSWER_REQ, sock.user?.roomId, sock.id)
      return
    }

    const roomId = sock.user?.roomId
    if (typeof roomId !== 'number') return

    const publisherSocketId = roomCameraPublishers.get(roomId)
    if (!publisherSocketId) {
      log.verbose('camera answer rejected: no publisher for room=%s socket=%s', roomId, sock.id)
      return
    }

    // Subscriber pinning: first valid answer pins, reject others
    const pinnedSubscriber = roomCameraSubscribers.get(roomId)
    if (pinnedSubscriber && pinnedSubscriber !== sock.id) {
      log.verbose('camera answer rejected: subscriber already pinned room=%s pinned=%s sender=%s', roomId, pinnedSubscriber, sock.id)
      return
    }

    if (!pinnedSubscriber) {
      roomCameraSubscribers.set(roomId, sock.id)
    }

    // Directed relay: send answer to publisher only
    sock.server.to(publisherSocketId).emit('action', { type: CAMERA_ANSWER, payload })
  },
  [CAMERA_ICE_REQ]: async (sock, { payload }) => {
    if (!isValidCameraIce(payload) || !isValidPayloadSize(payload)) return
    if (!(await canRelayCamera(sock))) {
      log.verbose('camera relay denied %s room=%s socket=%s', CAMERA_ICE_REQ, sock.user?.roomId, sock.id)
      return
    }

    const roomId = sock.user?.roomId
    if (typeof roomId !== 'number') return

    const publisherSocketId = roomCameraPublishers.get(roomId)
    const subscriberSocketId = roomCameraSubscribers.get(roomId)

    // Determine target: publisher↔subscriber directed relay
    let targetSocketId: string | undefined
    if (sock.id === publisherSocketId) {
      targetSocketId = subscriberSocketId
    } else if (sock.id === subscriberSocketId) {
      targetSocketId = publisherSocketId
    }

    if (!targetSocketId) {
      log.verbose('camera ICE rejected: sender is neither publisher nor pinned subscriber room=%s socket=%s', roomId, sock.id)
      return
    }

    sock.server.to(targetSocketId).emit('action', { type: CAMERA_ICE, payload })
  },
  [CAMERA_STOP_REQ]: async (sock, { payload }) => {
    if (!isValidCameraStop(payload) || !isValidPayloadSize(payload)) return
    if (!(await canRelayCamera(sock))) {
      log.verbose('camera relay denied %s room=%s socket=%s', CAMERA_STOP_REQ, sock.user?.roomId, sock.id)
      return
    }

    const roomId = sock.user?.roomId
    if (typeof roomId === 'number') {
      roomCameraPublishers.delete(roomId)
      roomCameraSubscribers.delete(roomId)
    }

    emitCameraRelay(sock, CAMERA_STOP, payload)
  },
  [PLAYER_EMIT_LEAVE]: async (sock) => {
    sock._lastPlayerStatus = null

    // any players left in room?
    if (!Rooms.isPlayerPresent(sock.server, sock.user.roomId)) {
      sock.server.to(Rooms.prefix(sock.user.roomId)).emit('action', {
        type: PLAYER_LEAVE,
        payload: { socketId: sock.id },
      })
    }
  },
}

export default ACTION_HANDLERS
