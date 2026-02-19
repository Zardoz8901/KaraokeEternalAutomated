#!/usr/bin/env bash
# test-slo-snapshot.sh — Validate slo-snapshot.sh against test fixtures
#
# Runs the SLO pipeline with synthetic data and verifies output.
# Exit 0 = pass, exit 1 = fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMPDIR=$(mktemp -d)
trap "rm -rf '$TMPDIR'" EXIT

echo "=== SLO Pipeline Test ==="
echo "Output dir: $TMPDIR"
echo ""

# Run the snapshot with test fixtures
"$SCRIPT_DIR/slo-snapshot.sh" \
  --input "$SCRIPT_DIR/test-fixtures/slo-events.jsonl" \
  --output-dir "$TMPDIR"

echo ""
echo "--- Validating output ---"

# Find generated files (date-stamped)
JSON_FILE=$(ls "$TMPDIR"/slo_snapshot_*.json 2>/dev/null | head -1)
MD_FILE=$(ls "$TMPDIR"/slo_snapshot_*.md 2>/dev/null | head -1)

FAILURES=0

# 1. JSON file exists and is valid JSON
if [[ -z "$JSON_FILE" || ! -f "$JSON_FILE" ]]; then
  echo "FAIL: JSON output file not found"
  FAILURES=$((FAILURES + 1))
else
  if ! node -e "JSON.parse(require('fs').readFileSync('$JSON_FILE','utf8'))" 2>/dev/null; then
    echo "FAIL: JSON output is not valid JSON"
    FAILURES=$((FAILURES + 1))
  else
    echo "PASS: JSON output is valid"
  fi
fi

# 2. Markdown file exists
if [[ -z "$MD_FILE" || ! -f "$MD_FILE" ]]; then
  echo "FAIL: Markdown output file not found"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: Markdown output exists"
fi

# 3. Check all expected computed_slos keys are present
EXPECTED_KEYS=(
  "queue_command_apply_success"
  "streaming_proxy_413_rate"
  "auth_guest_join_success"
  "hydra_preset_load_success"
  "hydra_first_frame_p95_ms"
  "video_init_success"
  "video_init_firefox"
  "video_first_frame_p95_ms"
  "reconnect_p95_ms"
  "crash_free_sessions"
  "queue_sent_vs_acked"
  "memory_max_observed_mb"
  "auth_permission_denied_count"
)

for key in "${EXPECTED_KEYS[@]}"; do
  if node -e "
    const j = JSON.parse(require('fs').readFileSync('$JSON_FILE','utf8'));
    if (!j.log_analysis?.computed_slos?.['$key']) { process.exit(1); }
  " 2>/dev/null; then
    echo "PASS: computed_slo key '$key' present"
  else
    echo "FAIL: computed_slo key '$key' MISSING"
    FAILURES=$((FAILURES + 1))
  fi
done

# 4. Check classification counts
node -e "
  const j = JSON.parse(require('fs').readFileSync('$JSON_FILE','utf8'));
  const c = j.classification;
  let failures = 0;

  if (c.measurable_now < 10) {
    console.log('FAIL: measurable_now count too low: ' + c.measurable_now);
    failures++;
  } else {
    console.log('PASS: measurable_now = ' + c.measurable_now);
  }

  if (c.blocked > 2) {
    console.log('FAIL: too many blocked SLOs: ' + c.blocked);
    failures++;
  } else {
    console.log('PASS: blocked = ' + c.blocked);
  }

  if (c.instrumented_not_computable > 1) {
    console.log('FAIL: instrumented_not_computable still high: ' + c.instrumented_not_computable);
    failures++;
  } else {
    console.log('PASS: instrumented_not_computable = ' + c.instrumented_not_computable);
  }

  process.exit(failures);
" || FAILURES=$((FAILURES + $?))

# 5. Check mode is 'analysis' (not classification_only)
if node -e "
  const j = JSON.parse(require('fs').readFileSync('$JSON_FILE','utf8'));
  if (j.mode !== 'analysis') process.exit(1);
" 2>/dev/null; then
  echo "PASS: mode = analysis"
else
  echo "FAIL: mode should be 'analysis'"
  FAILURES=$((FAILURES + 1))
fi

# 6. Check Markdown contains classification table
if grep -q "measurable_now" "$MD_FILE" && grep -q "Computed SLO" "$MD_FILE"; then
  echo "PASS: Markdown contains classification and computed SLOs"
else
  echo "FAIL: Markdown missing expected sections"
  FAILURES=$((FAILURES + 1))
fi

echo ""
echo "=== Results ==="
if [[ $FAILURES -eq 0 ]]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "$FAILURES TEST(S) FAILED"
  exit 1
fi
