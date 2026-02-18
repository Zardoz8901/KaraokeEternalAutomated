# Project Scope — Living Document

> Updated: 2026-02-17 | Review cadence: weekly (Monday)

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
| Hydra | Preset load success | >= 99.5% | Unknown (no telemetry) |
| Hydra | First frame p95 | <= 2.0s | Unknown |
| Hydra | Crash-free sessions | >= 99.9% | Unknown |
| Hydra | Memory growth (100 switches) | <= 150MB | Unknown |
| Queue | Command apply success | >= 99.99% | Unknown |
| Queue | Duplicate/lost commands | 0 | Unknown |
| Queue | Reconnect p95 | <= 2.0s | Unknown |
| Auth | Login success | >= 99.9% | Unknown |
| Auth | Token refresh success | >= 99.95% | Unknown |
| Auth | Role/permission incidents | 0 | Unknown |
| Streaming | Video init success | >= 99% | Unknown |
| Streaming | Video init (Firefox) | >= 97% now, 99% target | Unknown |
| Streaming | First frame p95 | <= 3.0s | Unknown |
| Streaming | Proxy 413 rate | < 0.1% | Unknown |

---

## 4. Active Epics

| Epic | Status | Risk | Target |
|------|--------|------|--------|
| CI baseline (typecheck + test) | In progress | Low | 2026-02-17 |
| Structured telemetry foundation | In progress | Medium | 2026-02-21 |
| Playwright smoke E2E | In progress | Medium | 2026-02-24 |
| Camera subscriber pinning (KI-3) | Not started | High | TBD |
| Socket rate limiting (KI-4) | Not started | Medium | TBD |
| Admin demotion fix (KI-1) | Not started | High | TBD |
| Bootstrap deadlock fix (KI-2) | Not started | High | TBD |

---

## 5. Known Issues and Mitigations

Source: CLAUDE.md Known Issues + security audit (2026-02-12).

| ID | Severity | Area | Description | Mitigation |
|----|----------|------|-------------|------------|
| KI-1 | HIGH | Auth | Admin demotion bug: group header parsing needs both `,` and `\|` separators | Pending fix in `server/serverWorker.ts` |
| KI-2 | HIGH | Bootstrap | Perpetual loading state: bootstrap deadlock in `src/main.tsx` | 5s timeout added; root cause TBD |
| KI-3 | HIGH | Camera | Subscriber pinning not implemented in `server/Player/socket.ts` | Specified in invariants; not yet coded |
| KI-4 | MEDIUM | Socket | No server-side rate limiting on socket actions | Guest HTTP rate limiting exists; socket layer unprotected |
| H-1 | HIGH | Socket | WebRTC relay payloads lack validation | Size cap + structure checks needed |
| H-2 | HIGH | Socket | Hydra code payload lacks server-side size limit | Match `MAX_PRESET_CODE_LENGTH` or 64KB cap |
| M-1 | MEDIUM | Proxy | SSRF prevention needs private IP block list | Partial implementation exists in `proxyValidator.ts` |

---

## 6. Roadmap (30/60/90 Day)

Execution rubric: [reliability-hardening-execution-rubric.md](reliability-hardening-execution-rubric.md)


### 30 days (by 2026-03-19)
- CI gates enforced on all PRs (typecheck, unit tests, smoke E2E)
- Telemetry foundation live: Hydra eval, socket lifecycle, auth, queue
- Playwright smoke test stable in Chromium
- Firefox nightly E2E running

### 60 days (by 2026-04-18)
- Camera subscriber pinning implemented (KI-3)
- Socket rate limiting for expensive operations (KI-4)
- Admin demotion fix (KI-1)
- Bootstrap deadlock root cause resolved (KI-2)
- WebRTC payload validation (H-1, H-2)
- All SLO dashboards populated from telemetry data

### 90 days (by 2026-05-18)
- All pillar SLOs met for 7 consecutive days
- Queue reconciliation chaos tests passing
- Hydra 2h soak tests passing
- Streaming fault-injection tests passing
- Video telemetry (init lifecycle, proxy response) instrumented

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
