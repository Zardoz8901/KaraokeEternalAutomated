import { detectFatalPatterns } from './hydraCodeGuard'
import telemetry from 'lib/telemetry'
import { HYDRA_GUARD_BLOCKED } from 'shared/telemetry'

export const DEFAULT_PATCH = `
;(function () {
var __H = globalThis.__hydraAudio
var __A = (__H && __H.fft) ? __H : (globalThis.a && globalThis.a.fft ? globalThis.a : null)
osc(20, 0.1, function () { return (__A && __A.fft && __A.fft[0] || 0) * 2 })
  .color(1, 0.5, function () { return 0.5 + (__A && __A.fft && __A.fft[2] || 0) * 0.5 })
  .modulate(noise(3), function () { return (__A && __A.fft && __A.fft[1] || 0) * 0.4 })
  .modulate(voronoi(5, function () { return 1 + (__A && __A.fft && __A.fft[0] || 0) * 2 }), function () { return (__A && __A.fft && __A.fft[1] || 0) * 0.2 })
  .rotate(function () { return (__A && __A.fft && __A.fft[1] || 0) * 0.5 })
  .kaleid(function () { return 2 + (__A && __A.fft && __A.fft[0] || 0) * 4 })
  .saturate(function () { return 0.6 + (__A && __A.fft && __A.fft[3] || 0) * 0.4 })
  .out()
})()
`.trim()

// Deduped guard logging: only warn once per unique code string
const guardWarnedCodes = new Set<string>()

export function getHydraEvalCode (code?: string): string {
  if (typeof code === 'string' && code.trim().length > 0) {
    const fatal = detectFatalPatterns(code)
    if (fatal) {
      if (!guardWarnedCodes.has(code)) {
        guardWarnedCodes.add(code)
        console.warn('[HydraGuard] Fatal pattern detected, using default patch:', fatal)
        telemetry.emit(HYDRA_GUARD_BLOCKED, { guard_reason: fatal })
      }
      return DEFAULT_PATCH
    }
    return code
  }
  return DEFAULT_PATCH
}

export function wrapWithTimerTracking (code: string): string {
  return `;(function(){
var __ids=(globalThis.__hydraUserTimers||(globalThis.__hydraUserTimers=new Set()));
var __nST=globalThis.setTimeout,__nSI=globalThis.setInterval;
var setTimeout=function(){var id=__nST.apply(globalThis,arguments);__ids.add(id);return id};
var setInterval=function(){var id=__nSI.apply(globalThis,arguments);__ids.add(id);return id};
${code}
})()`
}
