# SLO Evidence Summary: 2026-02-19

## Context

SLO snapshot pipeline (`scripts/slo-snapshot.sh`) classifies all 15 SLOs from `project-scope-live.md` against actual telemetry event coverage. This summary commits the stable classification; raw JSON snapshots are generated on demand and uploaded as CI artifacts.

## Classification Summary

| Status | Count | Description |
|--------|------:|-------------|
| measurable_now | 4 | Server-side events available for ratio computation |
| instrumented_not_computable | 6 | Events exist but client-only (needs telemetry sink) |
| blocked | 5 | No events defined yet |

## SLO Detail

| Pillar | SLO | Target | Status | Events |
|--------|-----|--------|--------|--------|
| Hydra | Preset load success | >= 99.5% | instrumented_not_computable | hydra_preset_eval_success (C), hydra_preset_eval_error (C) |
| Hydra | First frame p95 | <= 2.0s | instrumented_not_computable | hydra_preset_eval_start (C), hydra_preset_eval_success (C) |
| Hydra | Crash-free sessions | >= 99.9% | blocked | none |
| Hydra | Memory growth (100 switches) | <= 150MB | blocked | none |
| Queue | Command apply success | >= 99.99% | measurable_now | queue_cmd_ack (S), queue_cmd_error (S) |
| Queue | Duplicate/lost commands | 0 | blocked | none |
| Queue | Reconnect p95 | <= 2.0s | instrumented_not_computable | socket_reconnect (C) |
| Auth | Login success | >= 99.9% | measurable_now | auth_guest_join_success (S), auth_guest_join_failure (S), auth_login_success (C), auth_session_check_failure (C) |
| Auth | Token refresh success | >= 99.95% | blocked | none |
| Auth | Role/permission incidents | 0 | blocked | none |
| Streaming | Video init success | >= 99% | instrumented_not_computable | video_init_start (C), video_init_frame_ready (C), video_init_error (C) |
| Streaming | Video init (Firefox) | >= 97% | instrumented_not_computable | video_init_start (C), video_init_frame_ready (C), video_init_error (C) |
| Streaming | First frame p95 | <= 3.0s | instrumented_not_computable | video_init_start (C), video_init_frame_ready (C) |
| Streaming | Proxy 413 rate | < 0.1% | measurable_now | video_proxy_response (S) |
| Socket | Connection lifecycle | monitoring | measurable_now | socket_connect (S/C), socket_disconnect (S/C), socket_reconnect (C) |

**(S)** = server-side event, **(C)** = client-side event

## Key Findings

1. **4 SLOs are measurable now** with server-side events: Queue command success, Auth guest join, Proxy 413 rate, Socket lifecycle. These can produce ratios from server logs or JSONL input.

2. **6 SLOs are instrumented but not computable** because their events are client-only. The main blocker is a **client-side telemetry sink** (beacon API or socket relay) to persist these events server-side.

3. **5 SLOs are blocked** with no events defined: crash-free sessions, memory growth, duplicate/lost commands, token refresh, role/permission incidents. These need new instrumentation.

## Arch Overlap

These evidence scripts affect release-gate behavior:
- `scripts/slo-snapshot.sh` produces the SLO classification that feeds Gate G1 (instrumentation completeness) and future Gate G5 (SLO attainment).
- `scripts/flake-check.sh` produces the flake rate evidence that feeds Gate G4 (CI and test gate minimums).
- CI artifact upload (commit 4) creates the data pipeline for ongoing SLO ratio computation.

## Next Steps

1. Implement client-side telemetry sink to move 6 SLOs from `instrumented_not_computable` to `measurable_now`
2. Enable server file logging or wire periodic SLO computation for `measurable_now` SLOs
3. Define events for 5 blocked SLOs
4. Build dashboards for Measurement score 3 -> 4

## Reproducibility

```bash
# Classification only
./scripts/slo-snapshot.sh

# With JSONL input
./scripts/slo-snapshot.sh --input events.jsonl

# With CI artifact
./scripts/slo-snapshot.sh --input-ci-artifact <URL>
```
