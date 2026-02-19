# Project Scope — Living Document

> Updated: 2026-02-19 | Review cadence: weekly (Monday)

---

## 1. Mission and Product Scope

Karaoke Hydra is an open karaoke party system combining a queue/library manager with a live-coded Hydra video synth visualizer, WebRTC camera relay, and multi-user session management. Target users are karaoke hosts running private or small-venue events with browser-based players and mobile-friendly singer queues.

---

## 2. Four Pillars

| Pillar | DRI | Description |
|--------|-----|-------------|
| Hydra Synth | Steph | Preset eval, render loop, video proxy, audio reactivity |
| Queue & Library | Steph | Song queue CRUD, library scanning, star ratings, search |
| Auth & Session | Steph | SSO (Authentik), guest enrollment, JWT lifecycle, room access |
| Streaming & Video | Steph | Video proxy, camera relay (WebRTC), media playback (CDG/MP4) |

---

## 3. SLO Status

Targets from [reliability-release-playbook.md](reliability-release-playbook.md). Status will be updated as telemetry is instrumented.

| Pillar | SLO | Target | Current Status |
|--------|-----|--------|----------------|
| Hydra | Preset load success | >= 99.5% | Measurable (`hydra_preset_eval_success` / `_error` via client-relay; no dashboard yet) |
| Hydra | First frame p95 | <= 2.0s | Measurable (`hydra_preset_eval_success.duration_ms` via client-relay; no dashboard yet) |
| Hydra | Crash-free sessions | >= 99.9% | Measurable (`session_start` / `session_error` via client-relay) |
| Hydra | Memory growth (100 switches) | <= 150MB | Instrumented — needs soak (`memory_health_sample` via client-relay; needs extended data) |
| Queue | Command apply success | >= 99.99% | Measurable (`queue_cmd_ack` / `_error` server-side; no dashboard yet) |
| Queue | Duplicate/lost commands | 0 | Instrumented — needs soak (`queue_cmd_sent` with `cmd_id` via client-relay; needs correlation data) |
| Queue | Reconnect p95 | <= 2.0s | Measurable (`socket_connect.reconnect_duration_ms` via client-relay) |
| Auth | Login success | >= 99.9% | Measurable (`auth_guest_join_success` / `_failure` server-side + `auth_login_success` client-relay) |
| Auth | Token refresh success | >= 99.95% | Blocked (no refresh mechanism exists; needs formal SLO definition review) |
| Auth | Role/permission incidents | 0 | Measurable (`auth_permission_denied` server-side on 403 responses) |
| Streaming | Video init success | >= 99% | Measurable (`video_init_frame_ready` / `_error` via client-relay) |
| Streaming | Video init (Firefox) | >= 97% now, 99% target | Measurable (`video_init_frame_ready` / `_error` filtered by browser field) |
| Streaming | First frame p95 | <= 3.0s | Measurable (`video_init_frame_ready.time_to_ready_ms` via client-relay) |
| Streaming | Proxy 413 rate | < 0.1% | Measurable (`video_proxy_response` status field server-side; no dashboard yet) |

---

## 4. Active Epics

| Epic | Status | Risk | Target |
|------|--------|------|--------|
| CI baseline (typecheck + test) | Complete | — | 2026-02-19 |
| Structured telemetry foundation | Complete | — | 2026-02-19 |
| Playwright smoke E2E | In progress | Medium | 2026-02-24 |
| Payload validation (H-1, H-2) | Complete | — | 2026-02-18 |
| Socket rate limiting (KI-4) | Complete | — | 2026-02-18 |
| Video telemetry instrumentation | Complete | — | 2026-02-18 |
| Camera subscriber pinning (KI-3) | Complete | — | 2026-02-18 |
| Admin demotion fix (KI-1) | Complete | — | 2026-02-18 |
| Bootstrap hardening (KI-2) | Complete | — | 2026-02-18 |
| SSRF denylist completion (M-1) | Complete | — | 2026-02-18 |

---

## 5. Known Issues and Mitigations

Source: CLAUDE.md Known Issues + security audit (2026-02-12).

| ID | Severity | Area | Description | Mitigation |
|----|----------|------|-------------|------------|
| KI-1 | CLOSED | Auth | ~~Admin demotion bug: group header parsing~~ | Closed — regex `/[,|]/` in `server/Auth/oidc.ts`; edge-case tests added |
| KI-2 | CLOSED | Bootstrap | ~~Perpetual loading state: bootstrap deadlock~~ | Closed — retry/backoff + error classification in `src/store/modules/user.ts`; `bootstrapError` state + telemetry |
| KI-3 | CLOSED | Camera | ~~Subscriber pinning not implemented in `server/Player/socket.ts`~~ | Closed — directed relay with subscriber pinning in `server/Player/socket.ts` |
| KI-4 | CLOSED | Socket | ~~No server-side rate limiting on socket actions~~ | Closed — token bucket rate limiter in `server/lib/socketRateLimit.ts` |
| H-1 | CLOSED | Socket | ~~WebRTC relay payloads lack validation~~ | Closed — payload guards in `server/lib/payloadGuards.ts` |
| H-2 | CLOSED | Socket | ~~Hydra code payload lacks server-side size limit~~ | Closed — payload guards in `server/lib/payloadGuards.ts` |
| M-1 | CLOSED | Proxy | ~~SSRF prevention needs private IP block list~~ | Closed — full denylist in `server/VideoProxy/router.ts`: 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, fe80::/10, ::1, localhost |

---

## 6. Roadmap (30/60/90 Day)

Execution rubric: [reliability-hardening-execution-rubric.md](reliability-hardening-execution-rubric.md)


### 30 days (by 2026-03-19)
- CI gates enforced on all PRs (typecheck, unit tests, smoke E2E)
- Telemetry foundation live: Hydra eval, socket lifecycle, auth, queue
- Playwright smoke test stable in Chromium
- Firefox nightly E2E running

### Completed (moved from 60/90-day targets)
- Socket rate limiting for expensive operations (KI-4) — 2026-02-18
- WebRTC payload validation (H-1, H-2) — 2026-02-18
- Video telemetry (init lifecycle, proxy response) instrumented — 2026-02-18
- Camera subscriber pinning (KI-3) — 2026-02-18
- Admin demotion fix (KI-1) — 2026-02-18
- Bootstrap hardening with retry/backoff (KI-2) — 2026-02-18
- SSRF denylist completion (M-1) — 2026-02-18

### 60 days (by 2026-04-18)
- All SLO dashboards populated from telemetry data

### 90 days (by 2026-05-18)
- All pillar SLOs met for 7 consecutive days
- Queue reconciliation chaos tests passing
- Hydra 2h soak tests passing
- Streaming fault-injection tests passing

---

## 7. Release Gates and Rollback

From [reliability-release-playbook.md](reliability-release-playbook.md) section 6.

**Go/No-Go checklist:**
1. CI gates pass (typecheck, tests, smoke E2E)
2. No Sev-1 open regression in any pillar
3. Firefox video init smoke passes on production-like environment
4. Proxy logs show no unexplained spike in 413 or idle-timeout aborts
5. Rollback plan documented and tested

**Rollback:** `git revert <sha>` for single-commit changes. For multi-commit features, revert the merge commit. Document rollback SHA in analysis notes.

---

## 8. Changelog

| Date | Change |
|------|--------|
| 2026-02-19 | Client telemetry sink (POST /api/telemetry/ingest) operational; 5 new event types; SLO pipeline extended to 13 computed ratios; 12/15 SLOs now measurable; validation window runbook created |
| 2026-02-19 | G4 flake rate proven (0.0%/20 runs); SLO evidence pipeline scripts added; all Phase 1 gates (G1-G4) pass |
| 2026-02-18 | Week 3 scorecard (68.75/100); rollback drill completed; SLO dashboard wiring plan created; SLO status table updated with instrumented pillars |
| 2026-02-18 | Closed KI-1 (admin demotion parser), KI-2 (bootstrap retry/backoff), M-1 (SSRF denylist completion); all Phase 1 reliability blockers now closed |
| 2026-02-18 | Closed KI-3/KI-4 (camera subscriber pinning, socket rate limiting), H-1/H-2 (payload validation); added video telemetry; updated KI-2 status (root cause fixed, hardening deferred) |
| 2026-02-17 | Added reliability hardening execution rubric and scoring model |
| 2026-02-17 | Initial living scope doc created |

---

## 9. Update Cadence

This document is reviewed and updated every Monday. Updates include:
- SLO status changes (once telemetry is live)
- Epic status transitions
- New known issues or mitigations
- Roadmap adjustments
- Changelog entries for merged work
