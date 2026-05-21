import { describe, expect, it } from 'vitest'
import {
  acknowledgeHydraRemote,
  clearHydraSendAfterEdit,
  expireHydraSend,
  rejectHydraSend,
  resetSyncedHydraSend,
  startHydraSend,
  type OrchestratorSendState,
} from './orchestratorSendState'

describe('orchestratorSendState', () => {
  it('starts a send and stores the normalized last-sent code for ack detection', () => {
    const state = startHydraSend({ status: 'idle', lastSentCode: null }, {
      code: 'osc(10)\r\n  .out()   ',
    })

    expect(state).toEqual({
      status: 'sending',
      lastSentCode: 'osc(10)\n  .out()',
    })
  })

  it('rejects an unauthorized send without keeping a pending ack target', () => {
    expect(rejectHydraSend()).toEqual({
      status: 'error',
      lastSentCode: null,
    })
  })

  it('marks a send as synced when the remote code matches the normalized last-sent code', () => {
    const sending = startHydraSend({ status: 'idle', lastSentCode: null }, {
      code: 'osc(10)\n  .out()',
    })

    expect(acknowledgeHydraRemote(sending, 'osc(10)\r\n  .out()')).toEqual({
      status: 'synced',
      lastSentCode: null,
    })
  })

  it('ignores unrelated remote updates while a send is pending', () => {
    const sending: OrchestratorSendState = {
      status: 'sending',
      lastSentCode: 'osc(10).out()',
    }

    expect(acknowledgeHydraRemote(sending, 'shape(4).out()')).toBe(sending)
  })

  it('moves a still-pending send to error when the four-second ack window expires', () => {
    const sending: OrchestratorSendState = {
      status: 'sending',
      lastSentCode: 'osc(10).out()',
    }

    expect(expireHydraSend(sending)).toEqual({
      status: 'error',
      lastSentCode: 'osc(10).out()',
    })
  })

  it('resets synced status back to idle after the success display window', () => {
    expect(resetSyncedHydraSend({ status: 'synced', lastSentCode: null })).toEqual({
      status: 'idle',
      lastSentCode: null,
    })
  })

  it('clears terminal send status when the user edits after synced or error states', () => {
    expect(clearHydraSendAfterEdit({ status: 'synced', lastSentCode: null })).toEqual({
      status: 'idle',
      lastSentCode: null,
    })
    expect(clearHydraSendAfterEdit({ status: 'error', lastSentCode: 'osc().out()' })).toEqual({
      status: 'idle',
      lastSentCode: null,
    })
  })
})
