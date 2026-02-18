# Reliability Hardening Execution Plan and Re-entry Rubric

> Status: Active Draft v1
> Owner: Steph
> Last Updated: 2026-02-18

---

## 1. Intent

Define how the project moves from reliability hardening to feature and polish work without regressing core stability.

This document is the execution layer for:
- `docs/operations/reliability-release-playbook.md`
- `docs/operations/project-scope-live.md`

---

## 2. Operating Policy

The project runs in three phases:
1. Metric Hardening
2. SLO Validation Window
3. Feature and Polish Re-entry

Rule: do not optimize for feature throughput until measurement quality and baseline reliability are proven.

Default engineering allocation by phase:
- Phase 1: 85% reliability and security hardening, 15% break-fix
- Phase 2: 90% validation and incident response, 10% break-fix
- Phase 3: 60% features and polish, 25% reliability, 15% debt and tooling

---

## 3. Phase Plan and Exit Gates

| Phase | Duration Target | Objective | Required Exit Gates |
|---|---:|---|---|
| Phase 1: Metric Hardening | 2-4 weeks | Close known reliability and abuse gaps; complete instrumentation and CI baseline | G1, G2, G3, G4 all pass |
| Phase 2: SLO Validation Window | 7-14 days | Prove SLO attainment under normal production traffic | G5, G6, G7 all pass |
| Phase 3: Feature and Polish Re-entry | Ongoing | Resume roadmap while protecting reliability floor | G8 policy enforced weekly |

Gate definitions:

- G1: Instrumentation completeness
  - Required event families present and tested: hydra, video, queue, socket, auth
  - Correlation fields present where applicable: `session_id`, `room_id`, `user_id`
  - No raw PII and no raw tokens in emitted payloads

- G2: Reliability blockers closed
  - KI-1, KI-2, KI-3 marked fixed with regression tests
  - KI-4 mitigated with server-side socket action rate limiting

- G3: Abuse and safety controls in place
  - WebRTC relay payload validation (shape and size limits)
  - Hydra preset payload size cap on server
  - Proxy SSRF private IP block list enforced

- G4: CI and test gate minimums
  - Required checks on PRs: `typecheck`, `test`, Chromium smoke e2e
  - Nightly Firefox smoke running
  - Flake rate < 2% over rolling 20 runs

- G5: SLO attainment (rolling 7-day window)
  - All defined SLOs at or above target in release playbook
  - No Sev-1 incidents

- G6: Operational readiness
  - Rollback procedure tested at least once during validation window
  - Incident runbook updated with real telemetry field names and dashboards

- G7: Error budget stability
  - No pillar burns > 25% of monthly error budget during validation window

- G8: Re-entry guardrail
  - Weekly rubric score remains above threshold
  - Freeze triggers not activated

---

## 4. Weighted Reliability Rubric

Scoring scale for each category:
- 0: Missing
- 1: Ad hoc
- 2: Baseline
- 3: Strong
- 4: Production-grade

| Category | Weight | 0 | 2 | 3 | 4 |
|---|---:|---|---|---|---|
| Measurement Completeness | 20 | Most SLOs unknown | Core events exist but gaps remain | All pillars instrumented, low unknowns | Full coverage with dashboards and alerting |
| Reliability Outcomes | 25 | Frequent regressions | Mixed reliability, SLO misses | Meets most SLOs, no Sev-1 | Meets all SLOs with sustained margin |
| Test and CI Strength | 15 | No enforced gates | Basic gates exist | Required gates stable, low flakes | Gates stable plus chaos and soak tests |
| Security and Abuse Resistance | 15 | High-risk gaps open | Partial controls in place | Known critical controls enforced | Critical + defense-in-depth validated |
| Operability and Incident Readiness | 15 | No runbooks or drills | Runbooks exist, untested | Runbooks tested, rollback proven | Drill cadence + alert quality proven |
| Delivery Discipline | 10 | Unstructured merges | Basic PR hygiene | PR risk/test/rollback discipline | Consistent evidence-based release decisions |

Weighted score formula:

`Total Score (0-100) = SUM((CategoryScore / 4) * Weight)`

---

## 5. Decision Thresholds

Go/No-Go thresholds:
- Hardening completion: Total score >= 80
- Enter validation window: Total score >= 85 and no category below 2
- Enter feature re-entry: Total score >= 90 and no category below 3

Automatic No-Go conditions:
- Any open Sev-1 reliability or security incident
- Any unresolved P0/P1 red-team finding
- SLO validation window contains two consecutive days of SLO miss in same pillar
- Chromium smoke e2e fails for 3 consecutive required runs

---

## 6. Weekly Scorecard Template

Use this table every Monday in reliability review:

| Week Of | Measurement (20) | Outcomes (25) | CI/Test (15) | Security (15) | Operability (15) | Discipline (10) | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| YYYY-MM-DD |  |  |  |  |  |  |  | Stay in phase / Advance / Freeze |

Supporting checklist per week:
- Which SLOs are still `Unknown`?
- Which gates failed?
- Which incident classes repeated?
- Which regression tests were added?
- What was rolled back and why?

---

## 7. Workstream Backlog (Phase 1)

| Workstream | Priority | Done Evidence |
|---|---|---|
| KI-1 admin demotion parser fix | P0 | Unit tests for comma and pipe group parsing; manual role-change verification |
| KI-2 bootstrap deadlock root cause fix | P0 | Repro test plus fix; no perpetual loading under network delay/failure |
| KI-3 camera subscriber pinning | P0 | Integration test proving correct subscriber binding and recovery |
| KI-4 socket action rate limiting | P1 | **Done** — token bucket limiter in `server/lib/socketRateLimit.ts`; integration in `server/socket.ts`; tests in `socketRateLimit.test.ts` |
| H-1 WebRTC payload validation | P0 | **Done** — guards in `server/lib/payloadGuards.ts`; rejection tests in `socket.test.ts` Payload validation describe block |
| H-2 Hydra payload size cap | P0 | **Done** — `isValidHydraCode` + `isValidPayloadSize` guards; rejection tests in `socket.test.ts` |
| M-1 proxy private IP denylist | P1 | Proxy validator test matrix includes local/private ranges |
| Video telemetry completion | P1 | **Done** — 5 video events (`video_init_start/success/error`, `video_proxy_response`, `video_stall`) in `src/lib/telemetry.ts`; tests in `telemetry.test.ts` |
| Playwright stability pass | P1 | Chromium required stable, Firefox nightly stable trend |

---

## 8. Re-entry Policy (Features and Polish)

Once Phase 3 begins:
- Every feature PR must include:
  - SLO impact statement
  - New failure modes
  - Regression test coverage
  - Rollback note

- Reliability budget remains reserved:
  - 25% of sprint capacity for reliability items
  - 15% for debt/tooling

- Feature freeze triggers:
  - Total rubric score drops below 85
  - Any category drops below 2
  - Any Sev-1 or unresolved P0 finding

---

## 9. Cadence and Ownership

- Daily: reliability triage (15 minutes)
- Weekly (Monday): rubric scoring and phase decision
- Bi-weekly: red-team spot check on telemetry, proxy, and socket controls
- Monthly: rollback drill and release-gate rehearsal

Primary owner: Steph  
Review participants: maintainers owning each pillar

---

## 10. Changelog

| Date | Change |
|---|---|
| 2026-02-18 | Added Week 2 scorecard (55.00); updated backlog done evidence for KI-4, H-1, H-2, video telemetry |
| 2026-02-17 | Added Week 1 baseline scoring and context |
| 2026-02-17 | Initial execution rubric and phase-gate plan created |

---

## 11. Week 1 Baseline (2026-02-17)

This baseline is intentionally conservative. Unknown SLOs and open P0/P1 reliability items suppress the score even where tooling has improved.

### 11.1 Score Snapshot

| Category | Weight | Score (0-4) | Weighted Points | Rationale |
|---|---:|---:|---:|---|
| Measurement Completeness | 20 | 2 | 10.00 | Core telemetry exists for hydra/queue/socket/auth, but video lifecycle and proxy response coverage are incomplete; many SLOs remain unknown. |
| Reliability Outcomes | 25 | 1 | 6.25 | SLO outcomes are mostly unknown in current reporting; no validated 7-day reliability window yet. |
| Test and CI Strength | 15 | 3 | 11.25 | Required CI checks exist (`typecheck`, `test`, Chromium smoke e2e) plus Firefox nightly workflow. |
| Security and Abuse Resistance | 15 | 1 | 3.75 | Telemetry hardening improved, but high-risk gaps remain open (socket abuse controls, WebRTC validation, Hydra payload cap, proxy hardening). |
| Operability and Incident Readiness | 15 | 2 | 7.50 | Runbooks and release gates exist, but rollback drills and alert-quality validation are not yet demonstrated. |
| Delivery Discipline | 10 | 3 | 7.50 | Work is increasingly evidence-based (red-team, targeted tests, docs updates), but reliability gating is not yet fully institutionalized in practice. |

**Total Score:** **46.25 / 100**

**Phase Decision:** **Stay in Phase 1 (Metric Hardening)**

### 11.2 Weekly Scorecard Entry

| Week Of | Measurement (20) | Outcomes (25) | CI/Test (15) | Security (15) | Operability (15) | Discipline (10) | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-02-17 | 10.00 | 6.25 | 11.25 | 3.75 | 7.50 | 7.50 | 46.25 | Stay in Phase 1 |

### 11.3 Evidence Used

- CI workflows present and active: `.github/workflows/ci.yml`, `.github/workflows/e2e-nightly.yml`
- Playwright and e2e wiring present: `config/playwright.config.ts`, `e2e/smoke.spec.ts`, `package.json`
- Test suite footprint: 83 test files in repo
- Telemetry hardening test pass: 45/45 in targeted telemetry test run
- Typecheck pass on current branch
- Scope doc still marks most SLOs as `Unknown`: `docs/operations/project-scope-live.md`
- Open high-risk items still listed in active scope: KI-1/KI-2/KI-3, H-1/H-2, M-1

### 11.4 Quality Context (Not Just Numbers)

- What is strong now:
  - Reliability work is becoming systematic rather than reactive.
  - Verification depth improved (targeted tests and red-team remediations with code evidence).
  - Operational artifacts exist and are being maintained.

- What is limiting readiness:
  - Measurement is still incomplete where it matters most for streaming/video outcomes.
  - Critical abuse-resistance items are not closed yet.
  - SLO attainment cannot be asserted until a real validation window is run.

### 11.5 Next-Week Uplift Targets (set 2026-02-17)

To raise score into the 55-65 range next week:

1. Close one P0 blocker from Phase 1 backlog (preferred: KI-2 or H-2) with regression tests.
2. Add missing video telemetry event family (`video_init_*`, `video_proxy_response`) and test coverage.
3. Implement server-side socket action rate limiting (KI-4) and prove with abuse simulation tests.
4. Run one rollback drill and document the result in operations docs.

**Outcome:** Items 1-3 completed on 2026-02-18. H-1/H-2 closed, KI-4 closed, video telemetry shipped. Rollback drill still pending.

---

## 12. Week 2 Scorecard (2026-02-18)

### 12.1 Score Snapshot

| Category | Weight | Score (0-4) | Weighted Points | Rationale |
|---|---:|---:|---:|---|
| Measurement Completeness | 20 | 3 | 15.00 | Video telemetry added (5 events covering init lifecycle, proxy response, stalls). All four pillars now instrumented. Dashboards still missing. |
| Reliability Outcomes | 25 | 1 | 6.25 | No SLO validation window yet. KI-1, KI-2 (hardening), KI-3 still open. |
| Test and CI Strength | 15 | 3 | 11.25 | 85 test files, 1014 tests. CI gates active (typecheck, test, Chromium smoke e2e). |
| Security and Abuse Resistance | 15 | 2 | 7.50 | KI-4 closed (socket rate limiting). H-1/H-2 closed (payload validation). KI-3 still open (subscriber pinning). |
| Operability and Incident Readiness | 15 | 2 | 7.50 | No change from Week 1. Rollback drill still pending. |
| Delivery Discipline | 10 | 3 | 7.50 | No change from Week 1. |

**Total Score:** **55.00 / 100** (up from 46.25)

**Phase Decision:** **Stay in Phase 1 (Metric Hardening)**

### 12.2 Weekly Scorecard Entry

| Week Of | Measurement (20) | Outcomes (25) | CI/Test (15) | Security (15) | Operability (15) | Discipline (10) | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2026-02-17 | 10.00 | 6.25 | 11.25 | 3.75 | 7.50 | 7.50 | 46.25 | Stay in Phase 1 |
| 2026-02-18 | 15.00 | 6.25 | 11.25 | 7.50 | 7.50 | 7.50 | 55.00 | Stay in Phase 1 |

### 12.3 Evidence Used

- KI-4 closed: `server/lib/socketRateLimit.ts` (token bucket limiter), integrated in `server/socket.ts`
- H-1/H-2 closed: `server/lib/payloadGuards.ts` (type guards + 64KB size cap), rejection tests in `server/Player/socket.test.ts`
- Video telemetry: 5 events (`video_init_start`, `video_init_success`, `video_init_error`, `video_proxy_response`, `video_stall`) in `src/lib/telemetry.ts`
- Test suite: 85 test files (up from 83)
- KI-2 root cause identified as fixed in commit `d538fc04` (PersistGate removal); hardening deferred due to vitest alias resolution blockers
- Open: KI-1 (admin demotion parser), KI-3 (subscriber pinning — in progress), M-1 (proxy SSRF hardening)

### 12.4 Delta from Week 1

- **Measurement** 2→3: All four pillars now have telemetry event families. Video was the last gap.
- **Security** 1→2: Three high-priority socket abuse controls closed (KI-4, H-1, H-2). KI-3 prevents full score increase.
- **Outcomes, CI, Operability, Discipline:** No change — blocked on SLO validation window and rollback drill.

### 12.5 Next-Week Uplift Targets

To raise score into the 65-70 range:

1. Close KI-3 (camera subscriber pinning) with regression tests → Security 2→3.
2. Close KI-1 (admin demotion parser) with unit tests → Outcomes stays at 1 but removes a P0 blocker.
3. Run one rollback drill and document the result → Operability 2→3.
4. Begin SLO dashboard wiring to move Measurement toward 4.

