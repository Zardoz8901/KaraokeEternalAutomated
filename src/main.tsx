import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import store from './store/store'
import socket from 'lib/socket'
import telemetry from 'lib/telemetry'
import {
  SOCKET_CONNECT,
  SOCKET_DISCONNECT,
  SOCKET_RECONNECT,
  SESSION_START,
  SESSION_ERROR,
  MEMORY_HEALTH_SAMPLE,
} from 'shared/telemetry'
import AppRouter from 'lib/AppRouter'
import { checkSession, connectSocket } from './store/modules/user'

// ALWAYS validate session against server - SSO is the source of truth
// This ensures the keToken cookie is set correctly before socket connects
store.dispatch(checkSession()).finally(() => {
  telemetry.emit(SESSION_START, {})
})

// --- Reconnect duration tracking ---
let _reconnectStartTime: number | null = null

socket.on('connect', () => {
  const reconnectDuration = _reconnectStartTime !== null
    ? Math.round(Date.now() - _reconnectStartTime)
    : undefined
  _reconnectStartTime = null

  telemetry.emit(SOCKET_CONNECT, {
    socket_id: socket.id ?? '',
    transport: socket.io?.engine?.transport?.name ?? '',
    ...(reconnectDuration !== undefined ? { reconnect_duration_ms: reconnectDuration } : {}),
  })
})

socket.on('disconnect', (reason: string) => {
  telemetry.emit(SOCKET_DISCONNECT, { socket_id: socket.id ?? '', reason })
})

socket.on('reconnect_attempt', () => {
  if (_reconnectStartTime === null) {
    _reconnectStartTime = Date.now()
  }
  telemetry.emit(SOCKET_RECONNECT, {})
  store.dispatch(connectSocket())
})

// --- Global error handlers ---
window.addEventListener('error', (event) => {
  telemetry.emit(SESSION_ERROR, {
    error_type: 'uncaught',
    message: event.message?.slice(0, 200) ?? 'unknown',
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const message = typeof reason === 'string'
    ? reason.slice(0, 200)
    : reason instanceof Error
      ? (reason.message ?? 'unknown').slice(0, 200)
      : 'unknown'
  telemetry.emit(SESSION_ERROR, { error_type: 'unhandled_rejection', message })
})

// --- Memory health sampler (Chrome only, graceful no-op) ---
if (typeof performance !== 'undefined' && 'memory' in performance) {
  setInterval(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
    if (mem) {
      telemetry.emit(MEMORY_HEALTH_SAMPLE, {
        used_js_heap_mb: Math.round(mem.usedJSHeapSize / 1_048_576),
        total_js_heap_mb: Math.round(mem.totalJSHeapSize / 1_048_576),
        heap_limit_mb: Math.round(mem.jsHeapSizeLimit / 1_048_576),
      })
    }
  }, 60_000)
}

// ========================================================
// Go!
// ========================================================
createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <RouterProvider router={AppRouter} />
    </React.StrictMode>,
  )
