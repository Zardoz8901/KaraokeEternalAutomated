import { Action, Middleware, UnknownAction } from '@reduxjs/toolkit'
import { BEGIN, COMMIT, REVERT } from 'redux-optimistic-ui'
import { Socket } from 'socket.io-client'
import { OptimisticAction } from './store'
import telemetry from 'lib/telemetry'
import { QUEUE_CMD_SENT } from 'shared/telemetry'
import { QUEUE_ADD, QUEUE_MOVE, QUEUE_REMOVE } from 'shared/actionTypes'

// Queue action types that get correlation IDs for end-to-end tracking
const QUEUE_ACTIONS = new Set([QUEUE_ADD, QUEUE_MOVE, QUEUE_REMOVE])

// optimistic actions need a transaction id to match BEGIN to COMMIT/REVERT
let transactionID = 0

export default function createSocketMiddleware (socket: Socket, prefix: string): Middleware {
  return (store) => {
    // attach handler for incoming actions (from server)
    socket.on('action', action => store.dispatch(action))

    return next => (action: Action | OptimisticAction) => {
      // dispatch normally if it's not a socket.io request
      if (!action.type || !action.type.startsWith(prefix)) {
        return next(action)
      }

      // Emit queue command telemetry with correlation ID
      if (QUEUE_ACTIONS.has(action.type)) {
        const cmdId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'cmd_' + Math.random().toString(36).slice(2)
        telemetry.emit(QUEUE_CMD_SENT, { cmd_type: action.type, cmd_id: cmdId })
      }

      const hasMeta = 'meta' in action
      const isOptimistic = hasMeta && (action.meta?.isOptimistic ?? false)

      socket.emit('action', action, (cbAction: UnknownAction) => {
        // make sure callback response is an action
        if (typeof cbAction !== 'object' || typeof cbAction.type !== 'string') {
          return
        }

        if (isOptimistic) {
          cbAction.meta = {
            ...('meta' in cbAction && typeof cbAction.meta === 'object' ? cbAction.meta : {}),
            optimistic: cbAction.error ? { type: REVERT, id: transactionID } : { type: COMMIT, id: transactionID },
          }
        }

        next(cbAction)
      })

      if (!isOptimistic) {
        return next(action)
      }

      // dispatch optimistically?
      transactionID++

      // don't mutate action because we don't need to
      // emit this meta info to the server
      next({
        ...action,
        meta: {
          ...action.meta,
          optimistic: { type: BEGIN, id: transactionID },
        },
      })
    }
  }
}
