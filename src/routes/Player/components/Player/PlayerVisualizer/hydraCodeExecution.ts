import Hydra from 'hydra-synth'
import telemetry from 'lib/telemetry'
import { HYDRA_PRESET_EVAL_ERROR, HYDRA_PRESET_EVAL_START, HYDRA_PRESET_EVAL_SUCCESS } from 'shared/telemetry'
import { getHydraEvalCode } from './hydraEvalCode'
import { clearHydraTimers, withHydraTimerOwner, type HydraTimerOwner } from './hydraUserTimers'
import type { HydraAudioCompat } from './hooks/hydraAudioCompat'

const warn = (...args: unknown[]) => console.warn('[Hydra]', ...args)

function clearTrackedTimers (timerOwner?: HydraTimerOwner) {
  if (timerOwner) {
    clearHydraTimers(timerOwner)
    return
  }
  const g = globalThis as unknown as Record<string, unknown>
  const ids = g.__hydraUserTimers
  if (!(ids instanceof Set) || ids.size === 0) return
  for (const id of ids) {
    clearTimeout(id as ReturnType<typeof setTimeout>)
    clearInterval(id as ReturnType<typeof setInterval>)
  }
  ids.clear()
}

export type HydraEvalResult = { ok: true, durationMs: number } | { ok: false, durationMs: number, error: string }

export function executeHydraCode (
  hydra: Hydra,
  code: string,
  compat?: HydraAudioCompat,
  timerOwner?: HydraTimerOwner,
): HydraEvalResult {
  const t0 = performance.now()
  telemetry.emit(HYDRA_PRESET_EVAL_START, { code_length: code?.length ?? 0 })

  try {
    // Reseed audio at each preset boundary so audio is available
    // even if a previous sketch clobbered window.a or __hydraAudioRef.
    if (compat) {
      ;(globalThis as unknown as Record<string, unknown>).__hydraAudioRef = compat
      ;(window as unknown as Record<string, unknown>).a = compat
    }
    const w = window as unknown as Record<string, unknown>
    if (typeof w.speed !== 'number' || !Number.isFinite(w.speed)) w.speed = 1
    if (typeof w.bpm !== 'number' || !Number.isFinite(w.bpm)) w.bpm = 30
    if (typeof w.fps === 'number' && !Number.isFinite(w.fps)) w.fps = undefined

    clearTrackedTimers(timerOwner)
    const evalCode = getHydraEvalCode(code)
    if (timerOwner) {
      withHydraTimerOwner(timerOwner, () => hydra.eval(evalCode))
    } else {
      hydra.eval(evalCode)
    }

    const durationMs = Math.round(performance.now() - t0)
    telemetry.emit(HYDRA_PRESET_EVAL_SUCCESS, { duration_ms: durationMs })
    return { ok: true, durationMs }
  } catch (err) {
    warn('Code execution error:', err)
    const durationMs = Math.round(performance.now() - t0)
    const error = err instanceof Error ? err.message : String(err)
    telemetry.emit(HYDRA_PRESET_EVAL_ERROR, {
      duration_ms: durationMs,
      error,
    })
    return { ok: false, durationMs, error }
  }
}
