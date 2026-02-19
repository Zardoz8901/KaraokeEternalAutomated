#!/usr/bin/env bash
# flake-check.sh — Run test suite N times and report flake rate
#
# Usage:
#   ./scripts/flake-check.sh                              # 20 vitest runs (default)
#   ./scripts/flake-check.sh --runs 5 --suite vitest      # 5 vitest runs
#   ./scripts/flake-check.sh --runs 10 --suite e2e --project chromium

set -euo pipefail

RUNS=20
SUITE="vitest"
PROJECT=""
THRESHOLD=2  # G4 threshold: < 2% flake rate

while [[ $# -gt 0 ]]; do
  case $1 in
    --runs)     RUNS="$2"; shift 2 ;;
    --suite)    SUITE="$2"; shift 2 ;;
    --project)  PROJECT="$2"; shift 2 ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--runs N] [--suite vitest|e2e] [--project chromium|firefox] [--threshold N]"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Build command
case "$SUITE" in
  vitest)
    CMD="npx vitest run --config config/vitest.config.ts"
    ;;
  e2e)
    CMD="npx playwright test --config config/playwright.config.ts"
    if [[ -n "$PROJECT" ]]; then
      CMD="$CMD --project=$PROJECT"
    fi
    ;;
  *)
    echo "Error: Unknown suite '$SUITE'. Use 'vitest' or 'e2e'." >&2
    exit 1
    ;;
esac

echo "=== Flake Rate Check ==="
echo "Suite:     $SUITE"
echo "Command:   $CMD"
echo "Runs:      $RUNS"
echo "Threshold: < ${THRESHOLD}%"
echo ""

PASS=0
FAIL=0
RESULTS=()
DURATIONS=()

for i in $(seq 1 "$RUNS"); do
  START=$(date +%s%N)
  echo -n "Run $i/$RUNS... "

  if eval "$CMD" > /dev/null 2>&1; then
    END=$(date +%s%N)
    DURATION_MS=$(( (END - START) / 1000000 ))
    echo "PASS (${DURATION_MS}ms)"
    PASS=$((PASS + 1))
    RESULTS+=("pass")
    DURATIONS+=("$DURATION_MS")
  else
    END=$(date +%s%N)
    DURATION_MS=$(( (END - START) / 1000000 ))
    echo "FAIL (${DURATION_MS}ms)"
    FAIL=$((FAIL + 1))
    RESULTS+=("fail")
    DURATIONS+=("$DURATION_MS")
  fi
done

echo ""
echo "=== Results ==="
echo "Total:  $RUNS"
echo "Pass:   $PASS"
echo "Fail:   $FAIL"

if [[ $RUNS -gt 0 ]]; then
  # Use awk for floating-point arithmetic
  FLAKE_RATE=$(awk "BEGIN { printf \"%.1f\", ($FAIL / $RUNS) * 100 }")
  echo "Flake rate: ${FLAKE_RATE}%"
  echo ""

  # Compute duration stats
  TOTAL_DURATION=0
  MIN_DURATION=999999999
  MAX_DURATION=0
  for d in "${DURATIONS[@]}"; do
    TOTAL_DURATION=$((TOTAL_DURATION + d))
    [[ $d -lt $MIN_DURATION ]] && MIN_DURATION=$d
    [[ $d -gt $MAX_DURATION ]] && MAX_DURATION=$d
  done
  AVG_DURATION=$((TOTAL_DURATION / RUNS))
  echo "Duration (ms): min=$MIN_DURATION avg=$AVG_DURATION max=$MAX_DURATION total=$TOTAL_DURATION"
  echo ""

  # G4 verdict
  PASSES_THRESHOLD=$(awk "BEGIN { print ($FLAKE_RATE < $THRESHOLD) ? 1 : 0 }")
  if [[ "$PASSES_THRESHOLD" -eq 1 ]]; then
    echo "G4 VERDICT: PASS (${FLAKE_RATE}% < ${THRESHOLD}%)"
  else
    echo "G4 VERDICT: FAIL (${FLAKE_RATE}% >= ${THRESHOLD}%)"
  fi

  # Per-run detail
  echo ""
  echo "=== Per-Run Detail ==="
  echo "| Run | Result | Duration (ms) |"
  echo "|----:|--------|---------------|"
  for i in $(seq 0 $((RUNS - 1))); do
    echo "| $((i + 1)) | ${RESULTS[$i]} | ${DURATIONS[$i]} |"
  done
fi
