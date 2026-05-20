# Orchestrator Solarized Foundation UX - 2026-05-20

## Context

This slice applies the Orchestrator synthesis UI style guide to the working app shell. The target is a token-driven Solarized foundation that makes authority, broadcast, camera, editor, preset, and reference state legible without changing backend visualizer policy.

The red-team correction for this slice is part of the acceptance criteria: CodeMirror syntax highlighting is in scope, the Stage header status strip has a concrete collision contract, every Orchestrator modal gets the scoped modal class, and visual QA cannot claim authenticated Playwright coverage unless the auth path is explicit.

## ARCH

- Files touched:
  - `src/routes/Orchestrator/views/OrchestratorView.tsx`: derives the status-strip model from existing capabilities, send state, pending remote count, and camera state.
  - `src/routes/Orchestrator/views/OrchestratorView.css`: owns the Solarized token block and semantic Orchestrator variables.
  - `src/routes/Orchestrator/components/StagePanel.tsx` / `StagePanel.css`: inserts the Stage-header status slot and fixes desktop/mobile layout order.
  - `src/routes/Orchestrator/components/OrchestratorStatusStrip.tsx` / `OrchestratorStatusStrip.css`: renders authority, broadcast, and camera status pills.
  - `src/routes/Orchestrator/components/orchestratorStatus.ts`: central status-label model.
  - `src/routes/Orchestrator/components/CodeEditor.tsx`, `CodeEditor.css`, and `hydraHighlightStyle.ts`: moves CodeMirror chrome and Hydra syntax highlighting to Solarized variables.
  - `src/routes/Orchestrator/components/PresetBrowser.tsx` / `PresetBrowser.css`: scopes all five Orchestrator modal instances and tokenizes the preset browser surface.
  - `src/routes/Orchestrator/components/PresetPicker.css`, `PresetTree.css`, and `ApiReference.css`: tokenizes preset and reference surfaces.
  - `src/routes/Orchestrator/components/*test*`: adds focused status, modal, and deterministic color-audit coverage.
  - `docs/architecture/orchestrator-synthesis-ui-style-guide.md`: records the token, layout, modal, and QA contracts.
  - `docs/plans/active-slices.yaml`: tracks the slice and exact verification commands.
- Dependency chain: Orchestrator route -> StagePanel / CodeEditor / PresetBrowser / ApiReference -> existing socket dispatch helpers -> backend visualizer authority -> Player visualizer. This slice does not change socket action contracts.
- Invariant overlap: access invariants are mirrored in status copy through the existing capability helper; backend enforcement remains authoritative.
- Known issue overlap: M-2 is not changed. This slice does not alter FFT/status broadcast policy.

## Implementation

- Added a small Orchestrator status model that exposes:
  - authority: `Host live coding`, `Preset operator`, or `Policy blocked`;
  - broadcast: `Preview ready`, `Local edits`, `Sending`, `Synced`, `Failed`, or `Remote update`;
  - camera: `Camera idle`, `Camera connecting`, `Camera live`, or `Camera error`.
- Placed the status strip in the Stage header center column. Desktop order is title/preset picker, status strip, camera/buffer controls. Mobile order wraps those groups into three rows.
- Replaced one-off GitHub/neon editor colors with Solarized variables in both CodeMirror theme setup and Hydra syntax highlighting.
- Centralized raw Solarized values in a single token block and added a static color audit that fails on `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()` outside that block.
- Scoped Orchestrator modal styling through `styles.orchestratorModal` on all five `PresetBrowser` modal usages.
- Updated the style guide to align code tokens with Figma-style primitive/semantic variable structure.

## REDTEAM

- CodeMirror exception risk: mitigated by including both `CodeEditor.tsx` and `hydraHighlightStyle.ts` in implementation and color audit scope.
- Status collision risk: mitigated by making Stage header order explicit and by truncating/wrapping status before camera and buffer controls are displaced.
- Modal drift risk: mitigated by a static test that counts every `PresetBrowser` `Modal` usage and requires the scoped class on each one.
- Subjective color review risk: mitigated by an exact file-list audit and exact banned literal patterns.
- Authenticated Playwright risk: the project has a seed/login auth path in `e2e/smoke.spec.ts` using `/api/setup` with `/api/login` fallback. No persistent storage-state file is defined in `config/playwright.config.ts`; screenshot QA should reuse that explicit setup/login path or be recorded as manual QA with viewport sizes.
- Data loss / auth bypass / admin lockout: no backend, room policy, auth, destructive action, or DB mutation behavior changed.

## TESTS

- RED confirmed before implementation:
  - missing status helper/component tests failed;
  - color audit failed on existing hard-coded Orchestrator colors;
  - modal-scope test failed because `PresetBrowser` modal instances lacked the scoped class.
- GREEN:
  - `nix develop -c npm test -- src/routes/Orchestrator/components/orchestratorStatus.test.ts src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx src/routes/Orchestrator/components/orchestratorColorAudit.test.ts src/routes/Orchestrator/components/PresetBrowser.test.ts`
  - `nix develop -c npm test -- src/routes/Orchestrator/views/orchestratorLayout.test.ts src/routes/Orchestrator/views/orchestratorViewHelpers.test.ts src/routes/Orchestrator/components/orchestratorCapabilities.test.ts src/routes/Orchestrator/components/orchestratorStatus.test.ts src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx src/routes/Orchestrator/components/orchestratorColorAudit.test.ts src/routes/Orchestrator/components/PresetBrowser.test.ts src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/components/CodeEditor.test.tsx src/routes/Orchestrator/components/PresetPicker.test.tsx src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/ApiReference.test.tsx`
  - `nix develop -c npm test`
  - `nix develop -c npm run typecheck`
  - `nix develop -c npm run lint`
  - `nix develop -c npm run slices:check`
  - `nix develop -c npm run build`

Vitest warnings remain the existing jsdom/CSS-module warnings in nearby Orchestrator tests; the focused suites pass.

Playwright note: `nix develop -c npm run test:e2e -- --project=chromium` was attempted and failed before app code ran. The local Nix shell does not provide a Nix-built browser or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, so Playwright tried to launch the downloaded `~/.cache/ms-playwright` Chromium binary and NixOS rejected it with `stub-ld`. This is a dev-shell/browser wiring issue, not an Orchestrator regression.

## Visual QA

Required viewport checks for this slice:

- Desktop: authenticated `/orchestrator` at `1440x900`.
- Mobile: authenticated `/orchestrator` at `390x844`.

Expected checks:

- Stage header preserves title/preset controls, status strip, camera pipeline, and buffer controls without overlap.
- Status pills truncate or wrap before pushing camera/buffer controls out of view.
- Code editor and syntax highlighting read as Solarized, not GitHub/neon.
- Preset browser, preset picker, preset tree, API reference, and Orchestrator modals share the same token family.

Status on 2026-05-20: automated screenshots were not captured because local Playwright Chromium is blocked by the Nix browser issue above. The auth path itself is explicit and reusable from `e2e/smoke.spec.ts`; screenshot automation should use that setup/login pattern once the Nix shell provides a runnable browser.

## Docs Note

`AGENTS.md` references `docs/analysis/current_state_2026_03_05.md`, but that file is not present in this worktree or tracked on `main`. The completion record for this slice is therefore this dated analysis file plus `docs/plans/active-slices.yaml`.

## Rollback

Before coding, the dedicated worktree was created from `main` and the slice was registered in `docs/plans/active-slices.yaml`. After merge, rollback command is:

```sh
git revert 8657488f
```
