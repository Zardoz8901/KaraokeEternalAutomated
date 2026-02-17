# Reliability Release Playbook

## Purpose

Define hard reliability targets and release gates for the four core pillars:

1. Hydra synth player and orchestrator
2. Queue and library manager
3. User integration (auth/session/roles)
4. Streaming and video initialization

This document is the operational baseline for production deploy decisions.

---

## 1. Git and Release Safety (Required)

### Protect remotes

Run once in each local clone:

```bash
git remote -v
git remote set-url --push upstream no_push
```

### Protect main

Enable branch protection on `main`:

1. Require pull request before merge
2. Require passing status checks (`typecheck`, `test`, smoke e2e)
3. Restrict direct pushes
4. Optional: require linear history

---

## 2. SLOs by Pillar

## Hydra synth player and orchestrator

- Preset load success rate: `>= 99.5%`
- Time to first visualizer frame (p95): `<= 2.0s`
- Client crash-free sessions: `>= 99.9%`
- Console runtime error budget: `<= 0.1 errors/min/session`
- Memory growth after 100 preset switches (same session): `<= 150MB`

## Queue and library manager

- Queue command apply success: `>= 99.99%`
- Duplicate command application: `0` tolerated
- Lost command rate: `0` tolerated
- Reconnect reconciliation time (p95): `<= 2.0s`
- Library browse/search response (p95): `<= 300ms` (server-side)

## User integration

- Login success rate: `>= 99.9%`
- Token refresh success rate: `>= 99.95%`
- Join-room flow success rate: `>= 99.9%`
- Role/permission correctness incidents: `0`

## Streaming and video init

- Video visualizer init success (overall): `>= 99%`
- Video visualizer init success (Firefox): `>= 97%` now, target `>= 99%`
- Time to first decoded video frame (p95): `<= 3.0s`
- Proxy 413 rate: `< 0.1%`
- Playback stalls > 3s per 10 minutes: `<= 1`

---

## 3. Mandatory CI Gates

All PRs to `main` must pass:

```bash
npm run typecheck
npm test
```

Add and enforce smoke e2e (Playwright):

1. Load Player route
2. Start audio/reactive Hydra preset
3. Switch presets repeatedly (e.g. 10 times)
4. Initialize video visualizer
5. Assert first frame renders
6. Run in Chromium on PR, Firefox on release/nightly

---

## 4. Required Instrumentation

Emit structured events with correlation IDs:

- `hydra_preset_eval_start|success|error`
- `hydra_fallback_applied`
- `video_init_start|bound|frame_ready|error`
- `video_proxy_response` (status, range, content-range, content-length, timings)
- `queue_cmd_sent|ack|applied|rejected`
- `socket_connect|disconnect|reconnect|resync`
- `auth_login_start|success|failure|refresh`

Minimum fields:

- `session_id`
- `room_id`
- `user_id` (if authenticated)
- `preset_id` or media URL hash
- `browser`, `platform`
- `timestamp`

---

## 5. Current Streaming Notes

Recent reliability direction:

1. Archive.org direct bypass is disabled because CORS is not reliable on CDN 206 responses.
2. Proxy path remains primary for cross-origin video textures.
3. Idle timeout on proxied streams is increased to reduce mid-stream truncation risk.
4. Proxy diagnostics include timing and explicit proxy headers for troubleshooting.

If Firefox decode failures continue after timeout tuning:

1. Implement cache-first serving for affected large MP4 classes (moov-at-end heavy assets)
2. Add stream integrity tracing for failing URLs (bytes sent vs bytes consumed)
3. Add fail classification: codec unsupported vs truncated stream vs upstream response violation

---

## 6. Deploy Checklist (Go/No-Go)

Release is `NO-GO` unless all are true:

1. CI gates pass (`typecheck`, tests, smoke e2e)
2. No Sev-1 open regression in any pillar
3. Firefox video init smoke passes on production-like environment
4. Proxy logs show no unexplained spike in 413 or idle-timeout aborts
5. Rollback plan is documented and tested

---

## 7. 14-Day Hardening Plan

1. Week 1: Instrumentation completeness + Firefox video telemetry dashboard
2. Week 1: Playwright smoke stabilized and required for merge
3. Week 2: Queue reconciliation chaos tests (disconnect/reconnect storm)
4. Week 2: Hydra long-run soak tests (2h sessions, repeated preset churn)
5. Week 2: Streaming fault-injection tests (slow upstream, missing range, intermittent stalls)

Success criterion: all pillar SLOs are met for 7 consecutive days.
