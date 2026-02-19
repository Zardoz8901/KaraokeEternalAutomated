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

// ── SLO Registry ──────────────────────────────────────────────────
// Source of truth: docs/operations/project-scope-live.md SLO Status table
// Event names verified against: shared/telemetry.ts, server + client emitters
const slos = [
  // Hydra Synth
  {
    pillar: 'Hydra', name: 'Preset load success', target: '>= 99.5%',
    server_events: [],
    client_events: ['hydra_preset_eval_success', 'hydra_preset_eval_error'],
    formula: 'success / (success + error)',
    status: 'instrumented_not_computable',
    reason: 'Client-only events; no server-side persistence yet'
  },
  {
    pillar: 'Hydra', name: 'First frame p95', target: '<= 2.0s',
    server_events: [],
    client_events: ['hydra_preset_eval_start', 'hydra_preset_eval_success'],
    formula: 'p95(success.duration_ms)',
    status: 'instrumented_not_computable',
    reason: 'Client-only events; needs telemetry sink for server-side collection'
  },
  {
    pillar: 'Hydra', name: 'Crash-free sessions', target: '>= 99.9%',
    server_events: [],
    client_events: [],
    formula: 'sessions_without_crash / total_sessions',
    status: 'blocked',
    reason: 'No session lifecycle events defined'
  },
  {
    pillar: 'Hydra', name: 'Memory growth (100 switches)', target: '<= 150MB',
    server_events: [],
    client_events: [],
    formula: 'max_heap_after_100_switches - baseline_heap',
    status: 'blocked',
    reason: 'Needs soak test instrumentation'
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
    server_events: [],
    client_events: [],
    formula: 'count(duplicate_or_lost)',
    status: 'blocked',
    reason: 'No reconciliation events defined'
  },
  {
    pillar: 'Queue', name: 'Reconnect p95', target: '<= 2.0s',
    server_events: [],
    client_events: ['socket_reconnect'],
    formula: 'p95(reconnect_duration_ms)',
    status: 'instrumented_not_computable',
    reason: 'Client-only event; no duration field yet'
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
    reason: 'No token refresh events defined'
  },
  {
    pillar: 'Auth', name: 'Role/permission incidents', target: '0',
    server_events: [],
    client_events: [],
    formula: 'count(permission_violation)',
    status: 'blocked',
    reason: 'No permission incident events defined'
  },
  // Streaming & Video
  {
    pillar: 'Streaming', name: 'Video init success', target: '>= 99%',
    server_events: [],
    client_events: ['video_init_start', 'video_init_frame_ready', 'video_init_error'],
    formula: 'frame_ready / (frame_ready + error)',
    status: 'instrumented_not_computable',
    reason: 'Client-only events; needs telemetry sink'
  },
  {
    pillar: 'Streaming', name: 'Video init (Firefox)', target: '>= 97%',
    server_events: [],
    client_events: ['video_init_start', 'video_init_frame_ready', 'video_init_error'],
    formula: 'frame_ready / (frame_ready + error) WHERE browser=firefox',
    status: 'instrumented_not_computable',
    reason: 'Client-only events; needs browser field + telemetry sink'
  },
  {
    pillar: 'Streaming', name: 'First frame p95', target: '<= 3.0s',
    server_events: [],
    client_events: ['video_init_start', 'video_init_frame_ready'],
    formula: 'p95(frame_ready.duration_ms)',
    status: 'instrumented_not_computable',
    reason: 'Client-only events; needs telemetry sink'
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

  // Compute ratios for measurable SLOs
  const queueAck = (events['queue_cmd_ack'] || []).length;
  const queueErr = (events['queue_cmd_error'] || []).length;
  if (queueAck + queueErr > 0) {
    logAnalysis.computed_slos['Queue: Command apply success'] = {
      value: (queueAck / (queueAck + queueErr) * 100).toFixed(3) + '%',
      numerator: queueAck, denominator: queueAck + queueErr,
    };
  }

  const proxyResponses = events['video_proxy_response'] || [];
  const proxy413 = proxyResponses.filter(e => e.status === 413).length;
  if (proxyResponses.length > 0) {
    logAnalysis.computed_slos['Streaming: Proxy 413 rate'] = {
      value: (proxy413 / proxyResponses.length * 100).toFixed(3) + '%',
      numerator: proxy413, denominator: proxyResponses.length,
    };
  }

  const guestSuccess = (events['auth_guest_join_success'] || []).length;
  const guestFailure = (events['auth_guest_join_failure'] || []).length;
  if (guestSuccess + guestFailure > 0) {
    logAnalysis.computed_slos['Auth: Guest join success'] = {
      value: (guestSuccess / (guestSuccess + guestFailure) * 100).toFixed(3) + '%',
      numerator: guestSuccess, denominator: guestSuccess + guestFailure,
    };
  }
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
md += '| measurable_now | ' + summary.measurable_now.length + ' | Server-side events available for ratio computation |\\n';
md += '| instrumented_not_computable | ' + summary.instrumented_not_computable.length + ' | Events exist but client-only (needs telemetry sink) |\\n';
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
    md += '\\n### Computed SLO Ratios\\n\\n';
    md += '| SLO | Value | Sample |\\n|-----|-------|--------|\\n';
    for (const [slo, data] of Object.entries(logAnalysis.computed_slos)) {
      md += '| ' + slo + ' | ' + data.value + ' | ' + data.numerator + '/' + data.denominator + ' |\\n';
    }
  }
} else {
  md += '\\n## Log Analysis\\n\\nNo telemetry input provided. Run with \`--input <file.jsonl>\` or \`--log-dir <path>\` to compute SLO ratios.\\n';
}

md += '\\n---\\n\\n';
md += '## Next Steps\\n\\n';
md += '1. Implement client-side telemetry sink to capture Hydra/video events server-side\\n';
md += '2. Enable server file logging or wire periodic SLO computation\\n';
md += '3. Build dashboards from computed ratios\\n';
md += '4. Define events for blocked SLOs (crash-free sessions, duplicate commands, token refresh)\\n';

fs.writeFileSync('$OUTPUT_MD', md);

console.log('SLO snapshot generated:');
console.log('  Markdown: $OUTPUT_MD');
console.log('  JSON:     $OUTPUT_JSON');
console.log('');
console.log('Classification:');
console.log('  measurable_now:              ' + summary.measurable_now.length);
console.log('  instrumented_not_computable: ' + summary.instrumented_not_computable.length);
console.log('  blocked:                     ' + summary.blocked.length);
"

echo ""
echo "Done. Output: $OUTPUT_MD, $OUTPUT_JSON"
