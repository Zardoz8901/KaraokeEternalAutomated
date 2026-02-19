import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CAMERA_ANSWER,
  CAMERA_ANSWER_REQ,
  CAMERA_ICE,
  CAMERA_ICE_REQ,
  CAMERA_OFFER,
  CAMERA_OFFER_REQ,
  CAMERA_STOP,
  CAMERA_STOP_REQ,
  PLAYER_CMD_NEXT,
  PLAYER_REQ_NEXT,
  VISUALIZER_HYDRA_CODE,
  VISUALIZER_HYDRA_CODE_REQ,
  VISUALIZER_STATE_SYNC_REQ,
} from '../../shared/actionTypes.js'

vi.mock('../Rooms/Rooms.js', () => ({
  default: {
    get: vi.fn(),
    prefix: vi.fn((roomId: number) => `ROOM_ID_${roomId}`),
  },
}))

vi.mock('../lib/Log.js', () => ({
  default: () => ({
    verbose: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}))

import Rooms from '../Rooms/Rooms.js'
import handlers, { canManageRoom, cleanupCameraPublisher, cleanupCameraSubscriber, getLastVisualizerCode, clearVisualizerState } from './socket.js'

interface MockSocket {
  id: string
  user: {
    userId: number
    roomId: number
    isAdmin: boolean
  }
  to: ReturnType<typeof vi.fn>
  server: {
    to: ReturnType<typeof vi.fn>
  }
}

function createMockSocket (user: MockSocket['user'], socketId = 'sock-1') {
  const othersEmit = vi.fn()
  const broadcastEmit = vi.fn()
  const serverTo = vi.fn(() => ({ emit: broadcastEmit }))
  const socketTo = vi.fn(() => ({ emit: othersEmit }))
  const sock = {
    id: socketId,
    user,
    to: socketTo,
    server: { to: serverTo },
  }
  return { sock: sock as unknown as MockSocket, othersEmit, broadcastEmit, serverTo, socketTo }
}

function createMockIo () {
  const emit = vi.fn()
  const to = vi.fn(() => ({ emit }))
  return { io: { to }, emit, to }
}

describe('Player socket permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('canManageRoom allows admins without room owner lookup', async () => {
    const allowed = await canManageRoom({
      user: {
        userId: 10,
        roomId: 5,
        isAdmin: true,
      },
    } as unknown as MockSocket)

    expect(allowed).toBe(true)
    expect(Rooms.get).not.toHaveBeenCalled()
  })

  it('blocks hydra code broadcast when collaborator send is disabled', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [55],
      entities: {
        55: {
          ownerId: 999,
          prefs: {
            allowRoomCollaboratorsToSendVisualizer: false,
          },
        },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 55, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { code: 'osc(10).out()' } })

    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  it('allows hydra code broadcast when collaborator send is enabled', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [55],
      entities: {
        55: {
          ownerId: 999,
          prefs: {
            allowRoomCollaboratorsToSendVisualizer: true,
          },
        },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 55, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { code: 'osc(10).out()' } })

    expect(broadcastEmit).toHaveBeenCalledWith('action', {
      type: VISUALIZER_HYDRA_CODE,
      payload: { code: 'osc(10).out()' },
    })
  })

  it('blocks collaborator hydra send when room is restricted to a different party folder', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [55],
      entities: {
        55: {
          ownerId: 999,
          prefs: {
            allowRoomCollaboratorsToSendVisualizer: true,
            restrictCollaboratorsToPartyPresetFolder: true,
            partyPresetFolderId: 1,
          },
        },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 55, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { code: 'osc(10).out()', hydraPresetFolderId: 2 } })

    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  it('allows collaborator hydra send when room is restricted and payload folder matches', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [55],
      entities: {
        55: {
          ownerId: 999,
          prefs: {
            allowRoomCollaboratorsToSendVisualizer: true,
            restrictCollaboratorsToPartyPresetFolder: true,
            partyPresetFolderId: 2,
          },
        },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 55, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: {
        code: 'osc(10).out()',
        hydraPresetFolderId: 2,
        hydraPresetName: 'Working Standards / ws_a',
      },
    })

    expect(broadcastEmit).toHaveBeenCalledWith('action', {
      type: VISUALIZER_HYDRA_CODE,
      payload: {
        code: 'osc(10).out()',
        hydraPresetFolderId: 2,
        hydraPresetName: 'Working Standards / ws_a',
      },
    })
  })

  it('allows player next command for room owner', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [11],
      entities: {
        11: { ownerId: 42 },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 42, roomId: 11, isAdmin: false })

    await handlers[PLAYER_REQ_NEXT](sock)

    expect(broadcastEmit).toHaveBeenCalledWith('action', {
      type: PLAYER_CMD_NEXT,
    })
  })

  it('allows hydra code broadcast for room owner', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [77],
      entities: {
        77: { ownerId: 200 },
      },
    })

    const { sock, broadcastEmit } = createMockSocket({ userId: 200, roomId: 77, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { code: 'noise(4).out()' } })

    expect(broadcastEmit).toHaveBeenCalledWith('action', {
      type: VISUALIZER_HYDRA_CODE,
      payload: { code: 'noise(4).out()' },
    })
  })

  it('blocks camera offer when collaborator relay is disabled', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [88],
      entities: {
        88: {
          ownerId: 300,
          prefs: {
            allowGuestCameraRelay: false,
          },
        },
      },
    })

    const { sock, othersEmit, socketTo } = createMockSocket({ userId: 301, roomId: 88, isAdmin: false })

    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    expect(othersEmit).not.toHaveBeenCalled()
    expect(socketTo).not.toHaveBeenCalled()
  })

  it('allows camera offer when collaborator relay is enabled', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [88],
      entities: {
        88: {
          ownerId: 300,
          prefs: {
            allowGuestCameraRelay: true,
          },
        },
      },
    })

    const { sock, othersEmit, broadcastEmit, socketTo, serverTo } = createMockSocket({ userId: 301, roomId: 88, isAdmin: false })

    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    expect(othersEmit).toHaveBeenCalledWith('action', {
      type: CAMERA_OFFER,
      payload: { sdp: 'offer', type: 'offer' },
    })
    expect(socketTo).toHaveBeenCalledWith('ROOM_ID_88')
    expect(serverTo).not.toHaveBeenCalled()
    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  it('does not echo camera offer back to sender socket', async () => {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [88],
      entities: {
        88: {
          ownerId: 300,
          prefs: {
            allowGuestCameraRelay: true,
          },
        },
      },
    })

    const { sock, othersEmit, broadcastEmit } = createMockSocket({ userId: 301, roomId: 88, isAdmin: false })

    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    expect(othersEmit).toHaveBeenCalledWith('action', {
      type: CAMERA_OFFER,
      payload: { sdp: 'offer', type: 'offer' },
    })
    expect(broadcastEmit).not.toHaveBeenCalled()
  })
})

describe('Camera publisher disconnect cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function allowCameraRelay (roomId: number) {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: { allowGuestCameraRelay: true },
        },
      },
    })
  }

  it('broadcasts CAMERA_STOP when publisher socket disconnects', async () => {
    allowCameraRelay(10)
    const { sock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')

    // Publisher sends offer → tracked
    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    // Simulate disconnect
    const { io, emit } = createMockIo()
    cleanupCameraPublisher(10, 'pub-sock', io)

    expect(emit).toHaveBeenCalledWith('action', { type: CAMERA_STOP })
  })

  it('does not broadcast CAMERA_STOP when non-publisher socket disconnects', async () => {
    allowCameraRelay(10)
    const { sock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')

    // Publisher sends offer → tracked
    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    // Different socket disconnects
    const { io, emit } = createMockIo()
    cleanupCameraPublisher(10, 'other-sock', io)

    expect(emit).not.toHaveBeenCalled()
  })

  it('clears publisher tracking on explicit CAMERA_STOP_REQ', async () => {
    allowCameraRelay(10)
    const { sock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')

    // Publisher sends offer → tracked
    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'offer', type: 'offer' } })

    // Publisher sends explicit stop
    await handlers[CAMERA_STOP_REQ](sock, { payload: {} })

    // Now disconnect should NOT broadcast again (already stopped)
    const { io, emit } = createMockIo()
    cleanupCameraPublisher(10, 'pub-sock', io)

    expect(emit).not.toHaveBeenCalled()
  })

  it('new publisher takeover replaces previous publisher for same room', async () => {
    allowCameraRelay(20)
    const { sock: sock1 } = createMockSocket({ userId: 50, roomId: 20, isAdmin: false }, 'pub-1')
    const { sock: sock2 } = createMockSocket({ userId: 60, roomId: 20, isAdmin: false }, 'pub-2')

    // First publisher sends offer
    await handlers[CAMERA_OFFER_REQ](sock1, { payload: { sdp: 'offer-1', type: 'offer' } })

    // Second publisher takes over
    await handlers[CAMERA_OFFER_REQ](sock2, { payload: { sdp: 'offer-2', type: 'offer' } })

    // Old publisher disconnects → should NOT trigger CAMERA_STOP (replaced)
    const { io: io1, emit: emit1 } = createMockIo()
    cleanupCameraPublisher(20, 'pub-1', io1)
    expect(emit1).not.toHaveBeenCalled()

    // New publisher disconnects → should trigger CAMERA_STOP
    const { io: io2, emit: emit2 } = createMockIo()
    cleanupCameraPublisher(20, 'pub-2', io2)
    expect(emit2).toHaveBeenCalledWith('action', { type: CAMERA_STOP })
  })

  it('cleanup is scoped to correct room in multi-room scenario', async () => {
    // Mock Rooms.get to allow camera relay for any room
    vi.mocked(Rooms.get).mockImplementation(async (roomId: number) => ({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: { allowGuestCameraRelay: true },
        },
      },
    }))

    const { sock: sockA } = createMockSocket({ userId: 50, roomId: 30, isAdmin: false }, 'pub-a')
    const { sock: sockB } = createMockSocket({ userId: 60, roomId: 40, isAdmin: false }, 'pub-b')

    // Publishers in different rooms
    await handlers[CAMERA_OFFER_REQ](sockA, { payload: { sdp: 'offer-a', type: 'offer' } })
    await handlers[CAMERA_OFFER_REQ](sockB, { payload: { sdp: 'offer-b', type: 'offer' } })

    // Disconnect publisher from room 30 → only room 30 gets CAMERA_STOP
    const { io, emit, to } = createMockIo()
    cleanupCameraPublisher(30, 'pub-a', io)

    expect(to).toHaveBeenCalledWith('ROOM_ID_30')
    expect(emit).toHaveBeenCalledWith('action', { type: CAMERA_STOP })

    // Room 40 publisher still tracked — disconnect triggers CAMERA_STOP for room 40
    const { io: io2, emit: emit2, to: to2 } = createMockIo()
    cleanupCameraPublisher(40, 'pub-b', io2)

    expect(to2).toHaveBeenCalledWith('ROOM_ID_40')
    expect(emit2).toHaveBeenCalledWith('action', { type: CAMERA_STOP })
  })
})

describe('Payload validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function allowAll (roomId: number) {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: {
            allowGuestCameraRelay: true,
            allowRoomCollaboratorsToSendVisualizer: true,
          },
        },
      },
    })
  }

  function createAdminSocket (roomId = 88) {
    return createMockSocket({ userId: 1, roomId, isAdmin: true })
  }

  // --- CAMERA_OFFER_REQ ---

  it('CAMERA_OFFER_REQ rejects non-object payload', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_OFFER_REQ](sock, { payload: 'not-an-object' })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  it('CAMERA_OFFER_REQ rejects payload missing type field', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'v=0...' } })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  it('CAMERA_OFFER_REQ rejects oversized payload', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_OFFER_REQ](sock, { payload: { sdp: 'x'.repeat(100_000), type: 'offer' } })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  // --- CAMERA_ANSWER_REQ ---

  it('CAMERA_ANSWER_REQ rejects payload missing type: "answer"', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_ANSWER_REQ](sock, { payload: { sdp: 'v=0...' } })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  // --- CAMERA_ICE_REQ ---

  it('CAMERA_ICE_REQ rejects non-object payload', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_ICE_REQ](sock, { payload: null })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  // --- CAMERA_STOP_REQ ---

  it('CAMERA_STOP_REQ rejects non-object payload', async () => {
    const { sock, othersEmit } = createAdminSocket()
    await handlers[CAMERA_STOP_REQ](sock, { payload: 'stop' })
    expect(othersEmit).not.toHaveBeenCalled()
  })

  // --- VISUALIZER_HYDRA_CODE_REQ ---

  it('VISUALIZER_HYDRA_CODE_REQ rejects payload without code string', async () => {
    allowAll(88)
    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 88, isAdmin: false })
    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { notCode: true } })
    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  it('VISUALIZER_HYDRA_CODE_REQ rejects oversized payload', async () => {
    allowAll(88)
    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 88, isAdmin: false })
    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, { payload: { code: 'x'.repeat(100_000) } })
    expect(broadcastEmit).not.toHaveBeenCalled()
  })

  // --- VISUALIZER_STATE_SYNC_REQ ---

  it('VISUALIZER_STATE_SYNC_REQ rejects oversized payload', async () => {
    allowAll(88)
    const { sock, broadcastEmit } = createMockSocket({ userId: 101, roomId: 88, isAdmin: false })
    await handlers[VISUALIZER_STATE_SYNC_REQ](sock, { payload: { data: 'x'.repeat(100_000) } })
    expect(broadcastEmit).not.toHaveBeenCalled()
  })
})

describe('Camera subscriber pinning (KI-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function allowCameraRelay (roomId: number) {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: { allowGuestCameraRelay: true },
        },
      },
    })
  }

  it('first CAMERA_ANSWER_REQ pins subscriber and relays answer to publisher only', async () => {
    allowCameraRelay(10)

    // Publisher sends offer
    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    // Subscriber sends answer
    const { sock: subSock, serverTo } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    const subEmit = vi.fn()
    subSock.server.to = vi.fn(() => ({ emit: subEmit }))

    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Answer should be directed to publisher socket, not room broadcast
    expect(subSock.server.to).toHaveBeenCalledWith('pub-sock')
    expect(subEmit).toHaveBeenCalledWith('action', {
      type: CAMERA_ANSWER,
      payload: { sdp: 'answer', type: 'answer' },
    })
  })

  it('second CAMERA_ANSWER_REQ from different socket is rejected', async () => {
    allowCameraRelay(10)

    // Publisher sends offer
    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    // First subscriber pins
    const { sock: sub1 } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-1')
    sub1.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](sub1, { payload: { sdp: 'answer1', type: 'answer' } })

    // Second subscriber should be rejected
    const { sock: sub2 } = createMockSocket({ userId: 70, roomId: 10, isAdmin: false }, 'sub-2')
    const sub2Emit = vi.fn()
    sub2.server.to = vi.fn(() => ({ emit: sub2Emit }))
    await handlers[CAMERA_ANSWER_REQ](sub2, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(sub2Emit).not.toHaveBeenCalled()
  })

  it('pinned subscriber can send multiple answers (renegotiation)', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    const subEmit = vi.fn()
    subSock.server.to = vi.fn(() => ({ emit: subEmit }))

    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer1', type: 'answer' } })
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(subEmit).toHaveBeenCalledTimes(2)
  })

  it('CAMERA_ICE_REQ from publisher routes to pinned subscriber', async () => {
    allowCameraRelay(10)

    // Setup publisher and subscriber
    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Publisher sends ICE → should route to subscriber
    const pubEmit = vi.fn()
    pubSock.server.to = vi.fn(() => ({ emit: pubEmit }))
    await handlers[CAMERA_ICE_REQ](pubSock, { payload: { candidate: 'ice-pub' } })

    expect(pubSock.server.to).toHaveBeenCalledWith('sub-sock')
    expect(pubEmit).toHaveBeenCalledWith('action', {
      type: CAMERA_ICE,
      payload: { candidate: 'ice-pub' },
    })
  })

  it('CAMERA_ICE_REQ from pinned subscriber routes to publisher', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Subscriber sends ICE → should route to publisher
    const subIceEmit = vi.fn()
    subSock.server.to = vi.fn(() => ({ emit: subIceEmit }))
    await handlers[CAMERA_ICE_REQ](subSock, { payload: { candidate: 'ice-sub' } })

    expect(subSock.server.to).toHaveBeenCalledWith('pub-sock')
    expect(subIceEmit).toHaveBeenCalledWith('action', {
      type: CAMERA_ICE,
      payload: { candidate: 'ice-sub' },
    })
  })

  it('CAMERA_ICE_REQ from unauthorized socket is rejected', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Unauthorized third party sends ICE
    const { sock: rogue } = createMockSocket({ userId: 70, roomId: 10, isAdmin: false }, 'rogue-sock')
    const rogueEmit = vi.fn()
    rogue.server.to = vi.fn(() => ({ emit: rogueEmit }))
    await handlers[CAMERA_ICE_REQ](rogue, { payload: { candidate: 'rogue-ice' } })

    expect(rogueEmit).not.toHaveBeenCalled()
  })

  it('new CAMERA_OFFER_REQ clears stale subscriber pin', async () => {
    allowCameraRelay(10)

    // First session: publish + subscribe
    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer1', type: 'offer' } })

    const { sock: sub1 } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-1')
    sub1.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](sub1, { payload: { sdp: 'answer1', type: 'answer' } })

    // New offer clears old subscriber pin
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer2', type: 'offer' } })

    // New subscriber should be able to pin
    const { sock: sub2 } = createMockSocket({ userId: 70, roomId: 10, isAdmin: false }, 'sub-2')
    const sub2Emit = vi.fn()
    sub2.server.to = vi.fn(() => ({ emit: sub2Emit }))
    await handlers[CAMERA_ANSWER_REQ](sub2, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(sub2.server.to).toHaveBeenCalledWith('pub-sock')
    expect(sub2Emit).toHaveBeenCalledWith('action', {
      type: CAMERA_ANSWER,
      payload: { sdp: 'answer2', type: 'answer' },
    })
  })

  it('CAMERA_STOP_REQ clears subscriber pin', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Stop the relay
    await handlers[CAMERA_STOP_REQ](pubSock, { payload: {} })

    // After new offer, a different subscriber should be able to pin
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer2', type: 'offer' } })
    const { sock: newSub } = createMockSocket({ userId: 70, roomId: 10, isAdmin: false }, 'new-sub')
    const newSubEmit = vi.fn()
    newSub.server.to = vi.fn(() => ({ emit: newSubEmit }))
    await handlers[CAMERA_ANSWER_REQ](newSub, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(newSubEmit).toHaveBeenCalled()
  })

  it('cleanupCameraPublisher clears subscriber pin', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Publisher disconnects → cleanup should clear subscriber pin too
    const { io } = createMockIo()
    cleanupCameraPublisher(10, 'pub-sock', io)

    // After new offer, a different subscriber should pin
    const { sock: pub2 } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-2')
    await handlers[CAMERA_OFFER_REQ](pub2, { payload: { sdp: 'offer2', type: 'offer' } })

    const { sock: newSub } = createMockSocket({ userId: 80, roomId: 10, isAdmin: false }, 'new-sub')
    const newSubEmit = vi.fn()
    newSub.server.to = vi.fn(() => ({ emit: newSubEmit }))
    await handlers[CAMERA_ANSWER_REQ](newSub, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(newSub.server.to).toHaveBeenCalledWith('pub-2')
    expect(newSubEmit).toHaveBeenCalled()
  })

  it('cleanupCameraSubscriber clears pin when pinned subscriber disconnects', async () => {
    allowCameraRelay(10)

    const { sock: pubSock } = createMockSocket({ userId: 50, roomId: 10, isAdmin: false }, 'pub-sock')
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer', type: 'offer' } })

    const { sock: subSock } = createMockSocket({ userId: 60, roomId: 10, isAdmin: false }, 'sub-sock')
    subSock.server.to = vi.fn(() => ({ emit: vi.fn() }))
    await handlers[CAMERA_ANSWER_REQ](subSock, { payload: { sdp: 'answer', type: 'answer' } })

    // Subscriber disconnects
    cleanupCameraSubscriber(10, 'sub-sock')

    // New subscriber should be able to pin on next offer cycle
    await handlers[CAMERA_OFFER_REQ](pubSock, { payload: { sdp: 'offer2', type: 'offer' } })
    const { sock: newSub } = createMockSocket({ userId: 70, roomId: 10, isAdmin: false }, 'new-sub')
    const newSubEmit = vi.fn()
    newSub.server.to = vi.fn(() => ({ emit: newSubEmit }))
    await handlers[CAMERA_ANSWER_REQ](newSub, { payload: { sdp: 'answer2', type: 'answer' } })

    expect(newSubEmit).toHaveBeenCalled()
  })
})

describe('Visualizer state tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear any stored visualizer state between tests
    clearVisualizerState(10)
    clearVisualizerState(20)
  })

  function allowHydraCode (roomId: number) {
    vi.mocked(Rooms.get).mockResolvedValue({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: {
            allowRoomCollaboratorsToSendVisualizer: true,
          },
        },
      },
    })
  }

  it('VISUALIZER_HYDRA_CODE_REQ stores last payload for the room', async () => {
    allowHydraCode(10)
    const { sock } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { code: 'osc(10).out()', hydraPresetName: 'test' },
    })

    const stored = getLastVisualizerCode(10)
    expect(stored).toEqual({ code: 'osc(10).out()', hydraPresetName: 'test' })
  })

  it('getLastVisualizerCode returns undefined for room with no state', () => {
    expect(getLastVisualizerCode(999)).toBeUndefined()
  })

  it('successive broadcasts overwrite stored payload', async () => {
    allowHydraCode(10)
    const { sock } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { code: 'osc(10).out()' },
    })
    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { code: 'noise(4).out()' },
    })

    expect(getLastVisualizerCode(10)).toEqual({ code: 'noise(4).out()' })
  })

  it('clearVisualizerState removes entry for room', async () => {
    allowHydraCode(10)
    const { sock } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { code: 'osc(10).out()' },
    })

    clearVisualizerState(10)
    expect(getLastVisualizerCode(10)).toBeUndefined()
  })

  it('state is scoped per room', async () => {
    vi.mocked(Rooms.get).mockImplementation(async (roomId: number) => ({
      result: [roomId],
      entities: {
        [roomId]: {
          ownerId: 999,
          prefs: { allowRoomCollaboratorsToSendVisualizer: true },
        },
      },
    }))

    const { sock: sockA } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })
    const { sock: sockB } = createMockSocket({ userId: 102, roomId: 20, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sockA, {
      payload: { code: 'osc(10).out()' },
    })
    await handlers[VISUALIZER_HYDRA_CODE_REQ](sockB, {
      payload: { code: 'noise(4).out()' },
    })

    expect(getLastVisualizerCode(10)).toEqual({ code: 'osc(10).out()' })
    expect(getLastVisualizerCode(20)).toEqual({ code: 'noise(4).out()' })

    clearVisualizerState(10)
    expect(getLastVisualizerCode(10)).toBeUndefined()
    expect(getLastVisualizerCode(20)).toEqual({ code: 'noise(4).out()' })
  })

  it('does not store payload when validation rejects it', async () => {
    allowHydraCode(10)
    const { sock } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })

    // Missing code field — isValidHydraCode rejects
    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { notCode: true },
    })

    expect(getLastVisualizerCode(10)).toBeUndefined()
  })

  it('does not store oversized payload', async () => {
    allowHydraCode(10)
    const { sock } = createMockSocket({ userId: 101, roomId: 10, isAdmin: false })

    await handlers[VISUALIZER_HYDRA_CODE_REQ](sock, {
      payload: { code: 'x'.repeat(100_000) },
    })

    expect(getLastVisualizerCode(10)).toBeUndefined()
  })
})
