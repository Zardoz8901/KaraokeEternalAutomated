# G4 Flake Rate Proof: 2026-02-19

## Gate Requirement

G4 (CI and test gate minimums) requires flake rate < 2% over rolling 20 runs.

## Method

```
./scripts/flake-check.sh --runs 20 --suite vitest
```

- Command: `npx vitest run --config config/vitest.config.ts`
- Machine: Linux 6.12.59, NixOS, Node.js v22.21.1
- Test suite: 85 test files, 1037 tests
- Date: 2026-02-19

## Results

| Metric | Value |
|--------|-------|
| Total runs | 20 |
| Pass | 20 |
| Fail | 0 |
| Flake rate | 0.0% |
| Duration min | 11142ms |
| Duration avg | 11610ms |
| Duration max | 12565ms |
| Duration total | 232219ms (~3m 52s) |

### Per-Run Detail

| Run | Result | Duration (ms) |
|----:|--------|---------------|
| 1 | pass | 11142 |
| 2 | pass | 11595 |
| 3 | pass | 11449 |
| 4 | pass | 12565 |
| 5 | pass | 12430 |
| 6 | pass | 11142 |
| 7 | pass | 12354 |
| 8 | pass | 11387 |
| 9 | pass | 11419 |
| 10 | pass | 11367 |
| 11 | pass | 11641 |
| 12 | pass | 11590 |
| 13 | pass | 11504 |
| 14 | pass | 11734 |
| 15 | pass | 11721 |
| 16 | pass | 11269 |
| 17 | pass | 11459 |
| 18 | pass | 11637 |
| 19 | pass | 11621 |
| 20 | pass | 11193 |

## G4 Verdict

**PASS** -- 0.0% flake rate is below the 2% threshold over 20 consecutive runs.

## Notes

- Duration variance is low (11.1s-12.6s), indicating stable test execution time.
- This proof covers local runs. CI flake rate should be validated separately via artifact collection (see `.github/workflows/ci.yml` artifact upload).
- E2E flake rate (Chromium) was not measured in this run. Firefox E2E has a known pre-existing WebGL failure in headless mode (`this.regl is null` in hydra-synth).

## Rollback

```
git revert <sha>
```
