import { createAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import socket from 'lib/socket'
import telemetry from 'lib/telemetry'
import { AUTH_SESSION_CHECK, AUTH_SESSION_CHECK_FAILURE, AUTH_LOGIN_SUCCESS } from 'shared/telemetry'
import AppRouter from 'lib/AppRouter'
import { RootState } from 'store/store'
import HttpApi from 'lib/HttpApi'
import { fetchPrefs } from './prefs'
import {
  ACCOUNT_RECEIVE,
  ACCOUNT_REQUEST,
  ACCOUNT_CREATE,
  ACCOUNT_UPDATE,
  LOGIN,
  LOGOUT,
  SOCKET_AUTH_ERROR,
  SOCKET_REQUEST_CONNECT,
} from 'shared/actionTypes'

const api = new HttpApi('')
const basename = new URL(document.baseURI).pathname

// ------------------------------------
// State & Slice
// ------------------------------------
interface UserState {
  userId: number | null
  username: string | null
  name: string | null
  roomId: number | null
  ownRoomId: number | null // user's own ephemeral room (null if visiting)
  authProvider: 'local' | 'sso'
  isAdmin: boolean
  isGuest: boolean
  isBootstrapping: boolean
  isLoggingOut: boolean
  bootstrapError: string | null // 'timeout' | 'network' | null
  dateCreated: number
  dateUpdated: number
}

const initialState: UserState = {
  userId: null,
  username: null,
  name: null,
  roomId: null,
  ownRoomId: null,
  authProvider: 'local',
  isAdmin: false,
  isGuest: false,
  isBootstrapping: true,
  isLoggingOut: false,
  bootstrapError: null,
  dateCreated: 0,
  dateUpdated: 0,
}

// Action creators (defined before slice so they can be used in extraReducers)
const receiveAccount = createAction<Partial<UserState>>(ACCOUNT_RECEIVE)
export const bootstrapComplete = createAction('user/BOOTSTRAP_COMPLETE')
const setBootstrapError = createAction<string>('user/BOOTSTRAP_ERROR')
const requestSocketConnect = createAction<Record<string, unknown>>(SOCKET_REQUEST_CONNECT)
const logoutInternal = createAction(LOGOUT)
const socketAuthErrorInternal = createAction(SOCKET_AUTH_ERROR)

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    logoutStart: (state) => {
      state.isLoggingOut = true
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(receiveAccount, (state, action) => {
        Object.assign(state, action.payload)
        state.bootstrapError = null
      })
      .addCase(bootstrapComplete, (state) => {
        state.isBootstrapping = false
      })
      .addCase(setBootstrapError, (state, action) => {
        state.bootstrapError = action.payload
      })
      .addCase(logoutInternal, () => {
        return { ...initialState, isBootstrapping: false, isLoggingOut: false }
      })
      .addCase(socketAuthErrorInternal, () => {
        return { ...initialState, isBootstrapping: false }
      })
  },
})

// Extract internal actions from slice
const { logoutStart } = userSlice.actions

// ------------------------------------
// Async Thunks
// ------------------------------------
const SESSION_CHECK_TIMEOUT_MS = 5000 // 5 second timeout to prevent perpetual loading
const RETRY_DELAYS = [0, 1000, 2000] // backoff schedule for retryable errors

/** Classify checkSession errors into retryable and non-retryable categories. */
function classifySessionError (err: unknown): 'network' | 'timeout' | 'http' {
  if (err instanceof TypeError) return 'network' // fetch() DNS/connection failure
  if (err instanceof Error && err.message === 'Session check timeout') return 'timeout'
  return 'http' // 401/403/500 — deterministic, don't retry
}

export const checkSession = createAsyncThunk<void, void, { state: RootState }>(
  'user/CHECK_SESSION',
  async (_, thunkAPI) => {
    let lastErrorType: 'network' | 'timeout' | 'http' = 'http'
    let attempts = 0

    try {
      for (const delay of RETRY_DELAYS) {
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
        attempts++

        try {
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            setTimeout(() => reject(new Error('Session check timeout')), SESSION_CHECK_TIMEOUT_MS)
          })

          const user = await Promise.race([
            api.get<Partial<UserState>>('user', { skipAuthRedirect: true }),
            timeoutPromise,
          ])

          thunkAPI.dispatch(receiveAccount(user))
          telemetry.setUserContext(user.userId ?? null, user.roomId ?? null)
          telemetry.emit(AUTH_SESSION_CHECK, { user_id: user.userId ?? null, is_admin: !!user.isAdmin, is_guest: !!user.isGuest, attempts })
          thunkAPI.dispatch(fetchPrefs())
          thunkAPI.dispatch(connectSocket())
          socket.open()

          // Consume ?redirect param (set by RequireAuth → /account?redirect=...)
          const redirect = new URLSearchParams(window.location.search).get('redirect')
          if (redirect) {
            AppRouter.navigate(basename.replace(/\/$/, '') + redirect)
          }
          return // success — exit retry loop
        } catch (err) {
          lastErrorType = classifySessionError(err)
          if (lastErrorType === 'http') break // deterministic failure, don't retry
        }
      }

      // All attempts exhausted or non-retryable error
      telemetry.emit(AUTH_SESSION_CHECK_FAILURE, { error_type: lastErrorType, attempts })
      // Only surface transient errors — HTTP errors (401/403) are normal for unauthenticated users
      if (lastErrorType !== 'http') {
        thunkAPI.dispatch(setBootstrapError(lastErrorType))
      }
    } finally {
      thunkAPI.dispatch(bootstrapComplete())
    }
  },
)

export const login = createAsyncThunk(
  LOGIN,
  async (creds: Record<string, unknown>, thunkAPI) => {
    const user = await api.post<Partial<UserState>>('login', { body: creds })

    thunkAPI.dispatch(receiveAccount(user))
    telemetry.setUserContext(user.userId ?? null, user.roomId ?? null)
    telemetry.emit(AUTH_LOGIN_SUCCESS, { user_id: user.userId ?? null, is_admin: !!user.isAdmin, is_guest: !!user.isGuest })
    thunkAPI.dispatch(fetchPrefs())
    thunkAPI.dispatch(connectSocket())
    socket.open()

    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) {
      AppRouter.navigate(basename.replace(/\/$/, '') + redirect)
    }
  },
)

export const requestLogout = createAsyncThunk(
  LOGOUT,
  async (_, thunkAPI) => {
    thunkAPI.dispatch(logoutStart())

    let ssoSignoutUrl: string | null = null

    try {
      const response = await api.post<{ ssoSignoutUrl: string | null }>('logout')
      ssoSignoutUrl = response.ssoSignoutUrl
    } catch {
      // ignore errors
    }

    socket.close()

    if (ssoSignoutUrl) {
      window.location.href = ssoSignoutUrl
    } else {
      window.location.href = '/'
    }
  },
)

export const createAccount = createAsyncThunk<void, FormData, { state: RootState }>(
  ACCOUNT_CREATE,
  async (data: FormData, thunkAPI) => {
    const isFirstRun = thunkAPI.getState().prefs.isFirstRun

    const user = await api.post(isFirstRun ? 'setup' : 'user', { body: data })

    thunkAPI.dispatch(receiveAccount(user))
    thunkAPI.dispatch(fetchPrefs())
    thunkAPI.dispatch(connectSocket())
    socket.open()

    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect) {
      AppRouter.navigate(basename.replace(/\/$/, '') + redirect)
    }
  },
)

export const updateAccount = createAsyncThunk<void, FormData, { state: RootState }>(
  ACCOUNT_UPDATE,
  async (data: FormData, thunkAPI) => {
    const { userId } = thunkAPI.getState().user

    const user = await api.put(`user/${userId}`, { body: data })

    thunkAPI.dispatch(receiveAccount(user))
    alert('Account updated successfully.')
  },
)

export const fetchAccount = createAsyncThunk(
  ACCOUNT_REQUEST,
  async (_, thunkAPI) => {
    try {
      const user = await api.get('user')
      thunkAPI.dispatch(receiveAccount(user))
    } catch {
      // ignore errors
    }
  },
)

export const connectSocket = createAsyncThunk<void, void, { state: RootState }>(
  'user/SOCKET_CONNECT',
  async (_, { dispatch, getState }) => {
    const query = {
      library: getState().library.version,
      stars: getState().starCounts.version,
      telemetrySessionId: telemetry.sessionId,
    }

    dispatch(requestSocketConnect(query))
    socket.io.opts.query = query
  },
)

// User state is NOT persisted - SSO is the source of truth
// checkSession always fetches fresh user state from server
export default userSlice.reducer
