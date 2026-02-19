#!/usr/bin/env bash
# slo-snapshot.sh — Generate SLO status snapshot from telemetry events
#
# Usage:
#   ./scripts/slo-snapshot.sh                        # classification-only (no log data)
#   ./scripts/slo-snapshot.sh --log-dir /path/to/logs  # parse server log files
#   ./scripts/slo-snapshot.sh --input events.jsonl     # parse JSONL telemetry input
#   ./scripts/slo-snapshot.sh --input-ci-artifact URL  # fetch from CI artifact
#
# Output:
#   docs/analysis/slo_snapshot_YYYY_MM_DD.md   (human-readable)
#   docs/analysis/slo_snapshot_YYYY_MM_DD.json (machine-readable)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATE=$(date +%Y_%m_%d)
OUTPUT_DIR="$PROJECT_ROOT/docs/analysis"

LOG_DIR=""
INPUT_FILE=""
INPUT_CI_ARTIFACT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --log-dir)    LOG_DIR="$2"; shift 2 ;;
    --input)      INPUT_FILE="$2"; shift 2 ;;
    --input-ci-artifact) INPUT_CI_ARTIFACT="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--log-dir DIR] [--input FILE.jsonl] [--input-ci-artifact URL] [--output-dir DIR]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Compute output paths after arg parsing so --output-dir takes effect
OUTPUT_MD="$OUTPUT_DIR/slo_snapshot_${DATE}.md"
OUTPUT_JSON="$OUTPUT_DIR/slo_snapshot_${DATE}.json"

mkdir -p "$OUTPUT_DIR"

# Resolve input source
TELEMETRY_INPUT=""
if [[ -n "$INPUT_FILE" ]]; then
  if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Error: Input file not found: $INPUT_FILE" >&2
    exit 1
  fi
  TELEMETRY_INPUT="$INPUT_FILE"
elif [[ -n "$INPUT_CI_ARTIFACT" ]]; then
  ARTIFACT_TMP=$(mktemp)
  trap "rm -f '$ARTIFACT_TMP'" EXIT
  echo "Fetching CI artifact from: $INPUT_CI_ARTIFACT" >&2
  if ! curl -sfL "$INPUT_CI_ARTIFACT" -o "$ARTIFACT_TMP"; then
    echo "Error: Failed to fetch CI artifact from: $INPUT_CI_ARTIFACT" >&2
    exit 1
  fi
  TELEMETRY_INPUT="$ARTIFACT_TMP"
elif [[ -n "$LOG_DIR" ]]; then
  if [[ ! -d "$LOG_DIR" ]]; then
    echo "Warning: Log directory not found: $LOG_DIR (classification-only mode)" >&2
  else
    # Extract telemetry lines from server log files into temp JSONL
    LOG_TMP=$(mktemp)
    trap "rm -f '$LOG_TMP'" EXIT
    # Server logs contain JSON telemetry lines from getLogger('telemetry').info()
    for f in "$LOG_DIR"/*.log; do
      [[ -f "$f" ]] || continue
      grep -o '{.*}' "$f" 2>/dev/null >> "$LOG_TMP" || true
    done
    if [[ -s "$LOG_TMP" ]]; then
      TELEMETRY_INPUT="$LOG_TMP"
    fi
  fi
fi

# Generate snapshot via Node.js
TELEMETRY_INPUT="$TELEMETRY_INPUT" node -e "
const fs = require('fs');

// ── Utilities ────────────────────────────────────────────────────
function p95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

// ── SLO Registry ──────────────────────────────────────────────────
// Source of truth: docs/operations/project-scope-live.md SLO Status table
// Event names verified against: shared/telemetry.ts, server + client emitters
//
// Status transitions (PR1 telemetry sink):
//   6 instrumented_not_computable → measurable_now (client-relay active)
//   crash_free_sessions, role_permission_incidents → measurable_now
//   memory_growth, duplicate_lost_commands → instrumented_needs_soak
//   token_refresh → stays blocked (no refresh mechanism, per rubric review)
const slos = [
  // Hydra Synth
  {
    pillar: 'Hydra', name: 'Preset load success', target: '>= 99.5%',
    server_events: [],
    client_events: ['hydra_preset_eval_success', 'hydra_preset_eval_error'],
    formula: 'success / (success + error)',
    status: 'measurable_now',
    reason: 'Client-relay events now ingested server-side via POST /api/telemetry/ingest'
  },
  {
    pillar: 'Hydra', name: 'First frame p95', target: '<= 2.0s',
    server_events: [],
    client_events: ['hydra_preset_eval_start', 'hydra_preset_eval_success'],
    formula: 'p95(success.duration_ms)',
    status: 'measurable_now',
    reason: 'Client-relay events with duration_ms now available server-side'
  },
  {
    pillar: 'Hydra', name: 'Crash-free sessions', target: '>= 99.9%',
    server_events: [],
    client_events: ['session_start', 'session_error'],
    formula: 'sessions_without_crash / total_sessions',
    status: 'measurable_now',
    reason: 'SESSION_START and SESSION_ERROR events now emitted and relayed'
  },
  {
    pillar: 'Hydra', name: 'Memory growth (100 switches)', target: '<= 150MB',
    server_events: [],
    client_events: ['memory_health_sample'],
    formula: 'max_heap_after_100_switches - baseline_heap',
    status: 'instrumented_needs_soak',
    reason: 'MEMORY_HEALTH_SAMPLE events available; needs soak test window for meaningful data'
  },
  // Queue & Library
  {
    pillar: 'Queue', name: 'Command apply success', target: '>= 99.99%',
    server_events: ['queue_cmd_ack', 'queue_cmd_error'],
    client_events: [],
    formula: 'ack / (ack + error)',
    status: 'measurable_now'
  },
  {
    pillar: 'Queue', name: 'Duplicate/lost commands', target: '0',
    server_events: ['queue_cmd_ack', 'queue_cmd_error'],
    client_events: ['queue_cmd_sent'],
    formula: 'delta(sent_count - ack_count) over correlation IDs',
    status: 'instrumented_needs_soak',
    reason: 'cmd_id correlation IDs now emitted; needs soak window to validate end-to-end'
  },
  {
    pillar: 'Queue', name: 'Reconnect p95', target: '<= 2.0s',
    server_events: [],
    client_events: ['socket_connect'],
    formula: 'p95(reconnect_duration_ms)',
    status: 'measurable_now',
    reason: 'socket_connect events with reconnect_duration_ms now relayed server-side'
  },
  // Auth & Session
  {
    pillar: 'Auth', name: 'Login success', target: '>= 99.9%',
    server_events: ['auth_guest_join_success', 'auth_guest_join_failure'],
    client_events: ['auth_login_success', 'auth_session_check_failure'],
    formula: 'success / (success + failure)',
    status: 'measurable_now',
    reason: 'Server guest join events are measurable; OIDC login is client-only'
  },
  {
    pillar: 'Auth', name: 'Token refresh success', target: '>= 99.95%',
    server_events: [],
    client_events: [],
    formula: 'refresh_success / (refresh_success + refresh_failure)',
    status: 'blocked',
    reason: 'No token refresh mechanism exists; needs formal SLO definition review'
  },
  {
    pillar: 'Auth', name: 'Role/permission incidents', target: '0',
    server_events: ['auth_permission_denied'],
    client_events: [],
    formula: 'count(auth_permission_denied)',
    status: 'measurable_now',
    reason: 'AUTH_PERMISSION_DENIED events now emitted server-side on 403 responses'
  },
  // Streaming & Video
  {
    pillar: 'Streaming', name: 'Video init success', target: '>= 99%',
    server_events: [],
    client_events: ['video_init_frame_ready', 'video_init_error'],
    formula: 'frame_ready / (frame_ready + error)',
    status: 'measurable_now',
    reason: 'Client-relay events now ingested server-side'
  },
  {
    pillar: 'Streaming', name: 'Video init (Firefox)', target: '>= 97%',
    server_events: [],
    client_events: ['video_init_frame_ready', 'video_init_error'],
    formula: 'frame_ready / (frame_ready + error) WHERE browser contains firefox',
    status: 'measurable_now',
    reason: 'Client-relay events with browser field now available'
  },
  {
    pillar: 'Streaming', name: 'First frame p95', target: '<= 3.0s',
    server_events: [],
    client_events: ['video_init_frame_ready'],
    formula: 'p95(frame_ready.time_to_ready_ms)',
    status: 'measurable_now',
    reason: 'Client-relay events with time_to_ready_ms now available'
  },
  {
    pillar: 'Streaming', name: 'Proxy 413 rate', target: '< 0.1%',
    server_events: ['video_proxy_response'],
    client_events: [],
    formula: 'count(status=413) / total_responses',
    status: 'measurable_now'
  },
  // Socket lifecycle (cross-cutting, used by multiple SLOs)
  {
    pillar: 'Socket', name: 'Connection lifecycle', target: 'monitoring',
    server_events: ['socket_connect', 'socket_disconnect'],
    client_events: ['socket_connect', 'socket_disconnect', 'socket_reconnect'],
    formula: 'monitoring (no pass/fail target)',
    status: 'measurable_now',
    reason: 'Server-side connect/disconnect events available for analysis'
  },
];

// ── Classification summary ────────────────────────────────────────
const summary = {
  measurable_now: slos.filter(s => s.status === 'measurable_now'),
  instrumented_not_computable: slos.filter(s => s.status === 'instrumented_not_computable'),
  instrumented_needs_soak: slos.filter(s => s.status === 'instrumented_needs_soak'),
  blocked: slos.filter(s => s.status === 'blocked'),
};

// ── Log analysis (if input provided) ──────────────────────────────
let logAnalysis = null;
const inputFile = process.env.TELEMETRY_INPUT;

if (inputFile && fs.existsSync(inputFile)) {
  const lines = fs.readFileSync(inputFile, 'utf8').split('\\n').filter(Boolean);
  const events = {};
  let parseErrors = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const evt = entry.event || entry.name || entry.type;
      if (evt) {
        events[evt] = events[evt] || [];
        events[evt].push(entry);
      }
    } catch {
      parseErrors++;
    }
  }

  logAnalysis = {
    total_lines: lines.length,
    parse_errors: parseErrors,
    event_counts: {},
    computed_slos: {},
  };

  for (const [evt, entries] of Object.entries(events)) {
    logAnalysis.event_counts[evt] = entries.length;
  }

  // ── Compute ratios for all SLOs ──────────────────────────────

  // Queue: Command apply success
  const queueAck = (events['queue_cmd_ack'] || []).length;
  const queueErr = (events['queue_cmd_error'] || []).length;
  if (queueAck + queueErr > 0) {
    logAnalysis.computed_slos['queue_command_apply_success'] = {
      value: (queueAck / (queueAck + queueErr) * 100).toFixed(3) + '%',
      numerator: queueAck, denominator: queueAck + queueErr,
    };
  }

  // Streaming: Proxy 413 rate
  const proxyResponses = events['video_proxy_response'] || [];
  const proxy413 = proxyResponses.filter(e => e.status === 413).length;
  if (proxyResponses.length > 0) {
    logAnalysis.computed_slos['streaming_proxy_413_rate'] = {
      value: (proxy413 / proxyResponses.length * 100).toFixed(3) + '%',
      numerator: proxy413, denominator: proxyResponses.length,
    };
  }

  // Auth: Guest join success
  const guestSuccess = (events['auth_guest_join_success'] || []).length;
  const guestFailure = (events['auth_guest_join_failure'] || []).length;
  if (guestSuccess + guestFailure > 0) {
    logAnalysis.computed_slos['auth_guest_join_success'] = {
      value: (guestSuccess / (guestSuccess + guestFailure) * 100).toFixed(3) + '%',
      numerator: guestSuccess, denominator: guestSuccess + guestFailure,
    };
  }

  // Hydra: Preset load success
  const hydraSuccess = (events['hydra_preset_eval_success'] || []).length;
  const hydraError = (events['hydra_preset_eval_error'] || []).length;
  if (hydraSuccess + hydraError > 0) {
    logAnalysis.computed_slos['hydra_preset_load_success'] = {
      value: (hydraSuccess / (hydraSuccess + hydraError) * 100).toFixed(3) + '%',
      numerator: hydraSuccess, denominator: hydraSuccess + hydraError,
    };
  }

  // Hydra: First frame p95 (TTFF)
  const hydraDurations = (events['hydra_preset_eval_success'] || [])
    .map(e => e.duration_ms)
    .filter(d => typeof d === 'number');
  if (hydraDurations.length > 0) {
    const hydraP95 = p95(hydraDurations);
    logAnalysis.computed_slos['hydra_first_frame_p95_ms'] = {
      value: hydraP95 + 'ms',
      p95: hydraP95,
      sample_count: hydraDurations.length,
    };
  }

  // Streaming: Video init success
  const videoReady = (events['video_init_frame_ready'] || []).length;
  const videoError = (events['video_init_error'] || []).length;
  if (videoReady + videoError > 0) {
    logAnalysis.computed_slos['video_init_success'] = {
      value: (videoReady / (videoReady + videoError) * 100).toFixed(3) + '%',
      numerator: videoReady, denominator: videoReady + videoError,
    };
  }

  // Streaming: Video init (Firefox)
  const firefoxReady = (events['video_init_frame_ready'] || [])
    .filter(e => typeof e.browser === 'string' && e.browser.toLowerCase().includes('firefox')).length;
  const firefoxError = (events['video_init_error'] || [])
    .filter(e => typeof e.browser === 'string' && e.browser.toLowerCase().includes('firefox')).length;
  if (firefoxReady + firefoxError > 0) {
    logAnalysis.computed_slos['video_init_firefox'] = {
      value: (firefoxReady / (firefoxReady + firefoxError) * 100).toFixed(3) + '%',
      numerator: firefoxReady, denominator: firefoxReady + firefoxError,
    };
  }

  // Streaming: Video TTFF p95
  const videoTTFF = (events['video_init_frame_ready'] || [])
    .map(e => e.time_to_ready_ms)
    .filter(d => typeof d === 'number');
  if (videoTTFF.length > 0) {
    const videoP95 = p95(videoTTFF);
    logAnalysis.computed_slos['video_first_frame_p95_ms'] = {
      value: videoP95 + 'ms',
      p95: videoP95,
      sample_count: videoTTFF.length,
    };
  }

  // Queue: Reconnect p95
  const reconnectDurations = (events['socket_connect'] || [])
    .map(e => e.reconnect_duration_ms)
    .filter(d => typeof d === 'number');
  if (reconnectDurations.length > 0) {
    const reconnectP95 = p95(reconnectDurations);
    logAnalysis.computed_slos['reconnect_p95_ms'] = {
      value: reconnectP95 + 'ms',
      p95: reconnectP95,
      sample_count: reconnectDurations.length,
    };
  }

  // Hydra: Crash-free sessions
  const sessionStarts = events['session_start'] || [];
  const sessionErrors = events['session_error'] || [];
  const totalSessions = new Set(sessionStarts.map(e => e.session_id)).size;
  const crashedSessions = new Set(sessionErrors.map(e => e.session_id)).size;
  if (totalSessions > 0) {
    const crashFree = totalSessions - crashedSessions;
    logAnalysis.computed_slos['crash_free_sessions'] = {
      value: (crashFree / totalSessions * 100).toFixed(3) + '%',
      numerator: crashFree, denominator: totalSessions,
    };
  }

  // Queue: Sent vs acked delta (correlation)
  const queueSent = (events['queue_cmd_sent'] || []).length;
  if (queueSent > 0 || queueAck > 0) {
    logAnalysis.computed_slos['queue_sent_vs_acked'] = {
      sent: queueSent,
      acked: queueAck,
      errored: queueErr,
      delta: queueSent - queueAck - queueErr,
    };
  }

  // Performance: Memory max observed
  const memSamples = (events['memory_health_sample'] || [])
    .map(e => e.used_js_heap_mb)
    .filter(d => typeof d === 'number');
  if (memSamples.length > 0) {
    logAnalysis.computed_slos['memory_max_observed_mb'] = {
      value: Math.max(...memSamples) + 'MB',
      max: Math.max(...memSamples),
      sample_count: memSamples.length,
    };
  }

  // Auth: Permission denied count
  const permDenied = (events['auth_permission_denied'] || []).length;
  logAnalysis.computed_slos['auth_permission_denied_count'] = {
    value: permDenied.toString(),
    count: permDenied,
  };
}

// ── Output JSON ───────────────────────────────────────────────────
const output = {
  generated: new Date().toISOString(),
  date: '${DATE}'.replace(/_/g, '-'),
  mode: inputFile ? 'analysis' : 'classification_only',
  slo_count: slos.length,
  classification: {
    measurable_now: summary.measurable_now.length,
    instrumented_not_computable: summary.instrumented_not_computable.length,
    instrumented_needs_soak: summary.instrumented_needs_soak.length,
    blocked: summary.blocked.length,
  },
  slos: slos,
  log_analysis: logAnalysis,
};

fs.writeFileSync('$OUTPUT_JSON', JSON.stringify(output, null, 2));

// ── Output Markdown ───────────────────────────────────────────────
let md = '# SLO Status Snapshot: ${DATE}\\n\\n';
md += '> Generated: ' + output.generated + '\\n';
md += '> Mode: ' + output.mode + '\\n\\n';
md += '---\\n\\n';
md += '## Classification Summary\\n\\n';
md += '| Status | Count | Description |\\n';
md += '|--------|------:|-------------|\\n';
md += '| measurable_now | ' + summary.measurable_now.length + ' | Events available for ratio computation |\\n';
md += '| instrumented_needs_soak | ' + summary.instrumented_needs_soak.length + ' | Events exist but need soak test window |\\n';
md += '| instrumented_not_computable | ' + summary.instrumented_not_computable.length + ' | Events exist but not yet computable |\\n';
md += '| blocked | ' + summary.blocked.length + ' | No events defined yet |\\n\\n';

md += '## SLO Detail\\n\\n';
md += '| Pillar | SLO | Target | Status | Events |\\n';
md += '|--------|-----|--------|--------|--------|\\n';
for (const s of slos) {
  const events = [...s.server_events.map(e => e + ' (S)'), ...s.client_events.map(e => e + ' (C)')];
  md += '| ' + s.pillar + ' | ' + s.name + ' | ' + s.target + ' | ' + s.status + ' | ' + (events.join(', ') || 'none') + ' |\\n';
}

if (logAnalysis) {
  md += '\\n## Log Analysis\\n\\n';
  md += '- Total lines parsed: ' + logAnalysis.total_lines + '\\n';
  md += '- Parse errors: ' + logAnalysis.parse_errors + '\\n\\n';

  if (Object.keys(logAnalysis.event_counts).length > 0) {
    md += '### Event Counts\\n\\n';
    md += '| Event | Count |\\n|-------|------:|\\n';
    for (const [evt, count] of Object.entries(logAnalysis.event_counts)) {
      md += '| ' + evt + ' | ' + count + ' |\\n';
    }
  }

  if (Object.keys(logAnalysis.computed_slos).length > 0) {
    md += '\\n### Computed SLO Values\\n\\n';
    md += '| SLO Key | Value | Detail |\\n|---------|-------|--------|\\n';
    for (const [slo, data] of Object.entries(logAnalysis.computed_slos)) {
      const detail = data.numerator !== undefined
        ? data.numerator + '/' + data.denominator
        : data.sample_count !== undefined
          ? 'n=' + data.sample_count
          : data.sent !== undefined
            ? 'sent=' + data.sent + ' ack=' + data.acked + ' err=' + data.errored + ' delta=' + data.delta
            : data.count !== undefined
              ? 'count=' + data.count
              : '';
      md += '| ' + slo + ' | ' + data.value + ' | ' + detail + ' |\\n';
    }
  }
} else {
  md += '\\n## Log Analysis\\n\\nNo telemetry input provided. Run with \\\`--input <file.jsonl>\\\` or \\\`--log-dir <path>\\\` to compute SLO ratios.\\n';
}

md += '\\n---\\n\\n';
md += '## Next Steps\\n\\n';
md += '1. Start 7-day validation window with production telemetry\\n';
md += '2. Run daily SLO snapshots to collect evidence\\n';
md += '3. Review soak-test SLOs (memory growth, duplicate commands) after window\\n';
md += '4. Token refresh SLO requires formal definition review\\n';

fs.writeFileSync('$OUTPUT_MD', md);

console.log('SLO snapshot generated:');
console.log('  Markdown: $OUTPUT_MD');
console.log('  JSON:     $OUTPUT_JSON');
console.log('');
console.log('Classification:');
console.log('  measurable_now:              ' + summary.measurable_now.length);
console.log('  instrumented_needs_soak:     ' + summary.instrumented_needs_soak.length);
console.log('  instrumented_not_computable: ' + summary.instrumented_not_computable.length);
console.log('  blocked:                     ' + summary.blocked.length);
"

echo ""
echo "Done. Output: $OUTPUT_MD, $OUTPUT_JSON"
