import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import store from './store/store'
import socket from 'lib/socket'
import telemetry from 'lib/telemetry'
import { SOCKET_CONNECT, SOCKET_DISCONNECT, SOCKET_RECONNECT } from 'shared/telemetry'
import AppRouter from 'lib/AppRouter'
import { checkSession, connectSocket } from './store/modules/user'

// ALWAYS validate session against server - SSO is the source of truth
// This ensures the keToken cookie is set correctly before socket connects
store.dispatch(checkSession())

socket.on('connect', () => {
  telemetry.emit(SOCKET_CONNECT, { socket_id: socket.id ?? '', transport: socket.io?.engine?.transport?.name ?? '' })
})

socket.on('disconnect', (reason: string) => {
  telemetry.emit(SOCKET_DISCONNECT, { socket_id: socket.id ?? '', reason })
})

socket.on('reconnect_attempt', () => {
  telemetry.emit(SOCKET_RECONNECT, {})
  store.dispatch(connectSocket())
})

// ========================================================
// Go!
// ========================================================
createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <RouterProvider router={AppRouter} />
    </React.StrictMode>,
  )
