# Validation Window Runbook

> Created: 2026-02-19
> Status: IN_PROGRESS (window not yet started)

## Purpose

This runbook defines the 7-day validation window process for Phase 2 readiness. The goal is to collect production telemetry evidence proving SLO targets are met (or identifying gaps) before claiming Phase 2 gate passage.

**This sprint does NOT claim Outcomes 2→3 or score 80.** The validation window must produce actual data before those claims can be made.

## Prerequisites

Before starting the validation window:

- [ ] PR1 merged: Client telemetry sink + server ingest endpoint operational
- [ ] PR2 merged: SLO computation pipeline tested with fixtures
- [ ] Server logging captures telemetry to extractable files
- [ ] At least 2 active rooms with regular usage
- [ ] `scripts/slo-snapshot.sh` runs without errors against live data

## Daily Tasks

1. **Extract telemetry** from server logs:
   ```bash
   ./scripts/slo-snapshot.sh --log-dir /path/to/server/logs
   ```

2. **Review computed SLO ratios** in the generated JSON:
   ```bash
   cat docs/analysis/slo_snapshot_YYYY_MM_DD.json | node -e "
     const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
     console.table(j.log_analysis?.computed_slos || {});
   "
   ```

3. **Check for incidents** — any SLO below target:
   - Queue command success < 99.99%
   - Hydra preset load < 99.5%
   - Video init success < 99%
   - Auth login success < 99.9%
   - Reconnect p95 > 2000ms

4. **Document incidents** in `docs/analysis/validation_incident_YYYY_MM_DD.md`

5. **Archive daily snapshot** — the script auto-generates dated files

## Incident Severity

| Severity | Definition | Response |
|----------|-----------|----------|
| Sev-1 | SLO miss > 5% for > 1 hour | Investigate root cause, file bug, extend window if fix required |
| Sev-2 | Single-window SLO miss (one snapshot below target) | Document, monitor next window |
| Sev-3 | SLO at target but margin < 1% | Note in daily review, no action required |

## Window Completion Criteria

The validation window is complete when ALL of the following are true:

1. **Duration**: 7 consecutive days of snapshots collected
2. **Coverage**: All `measurable_now` SLOs have non-zero sample counts
3. **Incidents**: 0 Sev-1 incidents during the window
4. **Targets**: All `measurable_now` SLOs meet their defined targets across the window
5. **Soak SLOs**: `instrumented_needs_soak` SLOs have initial data (may not meet targets yet)

## Event Field Reference

### Client-relay events (via POST /api/telemetry/ingest)

| Event | Key Fields | SLO |
|-------|-----------|-----|
| `session_start` | `session_id` | Crash-free sessions (denominator) |
| `session_error` | `session_id`, `error_type`, `message` | Crash-free sessions (numerator subtraction) |
| `hydra_preset_eval_success` | `duration_ms` | Preset load success, First frame p95 |
| `hydra_preset_eval_error` | `error` | Preset load success |
| `video_init_frame_ready` | `time_to_ready_ms`, `browser` | Video init success, Firefox, TTFF p95 |
| `video_init_error` | `error`, `browser` | Video init success, Firefox |
| `socket_connect` | `reconnect_duration_ms` (optional) | Reconnect p95 |
| `queue_cmd_sent` | `cmd_type`, `cmd_id` | Duplicate/lost commands |
| `memory_health_sample` | `used_js_heap_mb`, `total_js_heap_mb`, `heap_limit_mb` | Memory growth |

### Server-side events

| Event | Key Fields | SLO |
|-------|-----------|-----|
| `queue_cmd_ack` | `cmd_type` | Command apply success |
| `queue_cmd_error` | `cmd_type`, `error` | Command apply success |
| `video_proxy_response` | `status` | Proxy 413 rate |
| `auth_guest_join_success` | `room_id`, `user_id` | Login success |
| `auth_guest_join_failure` | `room_id` | Login success |
| `auth_permission_denied` | `user_id`, `path` | Permission incidents |

## Command Reference

```bash
# Classification-only snapshot (no data)
./scripts/slo-snapshot.sh

# From JSONL file
./scripts/slo-snapshot.sh --input events.jsonl

# From server log directory
./scripts/slo-snapshot.sh --log-dir /var/log/karaoke-eternal/

# Custom output directory
./scripts/slo-snapshot.sh --input data.jsonl --output-dir /tmp/slo-check

# Run pipeline tests
./scripts/test-slo-snapshot.sh

# Kill switch for ingest endpoint (runtime toggle)
export KES_TELEMETRY_INGEST_DISABLED=true
```

## Blocked/Deferred SLOs

| SLO | Status | Reason |
|-----|--------|--------|
| Token refresh success | `blocked` | No refresh mechanism exists; needs formal SLO definition review |
| Duplicate/lost commands | `instrumented_needs_soak` | cmd_id correlation IDs now exist; needs soak window data |
| Memory growth (100 switches) | `instrumented_needs_soak` | Sampling active; meaningful only with extended soak test |
