---
slice: phase-B-orch-conformance-cleanups
date: 2026_06_04
status: implemented — gate green
---

# Phase B mechanical conformance cleanups (aqua / error-route / motion)

Three small raw-value→token cleanups landed as ONE serialized slice (all touch the shared
`orchestratorColorAudit.test.ts`, per the backlog Forward-slices serialization constraint — one
integrator owns the test edits). TDD: extend the audit (RED) → route the CSS (GREEN).

## What changed
- **`elevation-aqua-cleanup` (D7.4)** — deleted the 7 dead `--aqua-*` compatibility shims +
  their comment from `OrchestratorView.css` (grep-verified **zero `var(--aqua-*)` consumers**).
  Audit now asserts `OrchestratorView.css` contains no `--aqua-`.
- **`error-state-route` (D8.5 tripwire)** — `PresetBrowser.css .error` routed off raw
  `var(--orch-red)` onto `var(--orch-danger)` (same Solarized hue via the role token); removed the
  deferred `.error` carve-out from the audit's `stripNeutralChromeAllowlist`, so the file-wide
  raw-hue sweep now covers it. The "deferred" audit assertion flipped to assert the routed state.
- **`motion-tokenize` (D7.2 residual)** — the 3 raw `transition:` declarations in `PresetBrowser.css`
  (`:34`, `:76` 0.2s pairs; `:119` 180ms + raw `cubic-bezier`) routed onto `--orch-motion-base` +
  `--orch-ease-standard`. The looping `shimmer` (1.2s) and `sendAckSpin` (800ms) `animation:`
  declarations stay **exempt per §4.3** (determinate looping affordances, reduce-motion-guarded).
  Audit asserts no raw transition duration/easing remains in `PresetBrowser.css`.

## Tests (TDD RED → GREEN)
`orchestratorColorAudit.test.ts`: + an aqua-absence assertion, + a PresetBrowser-transition
tokenization assertion, the file-wide raw-hue sweep now reaches `.error` (allowlist entry removed),
and the former "error deferred" assertion flipped to "routes through `--orch-danger`". 28/28 pass.

Gate: full `npm test`, typecheck, lint, slices:check.

## Notes
- `breakpoints-lockstep` deliberately NOT included (separate slice; CSS custom properties cannot be
  used inside `@media` conditions — needs a real single-source mechanism).
- No visual change expected: `--orch-danger` === `--orch-red` (alias), and `--orch-motion-base` 180ms
  ≈ the prior 0.2s/180ms durations with the same easing curve. Steph visual gate optional/low-risk.

## Rollback
`git revert <merge-sha>`.
