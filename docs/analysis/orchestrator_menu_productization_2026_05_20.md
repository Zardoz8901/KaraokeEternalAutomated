# Orchestrator Menu Productization - 2026-05-20

## Context

This slice turns `/orchestrator` from a known endpoint into a discoverable Visuals product area. The work also makes the Orchestrator shell mode-aware so collaborators do not see a reduced host/code workspace when their authority is preset-only or browse-only.

The current-state file referenced by `AGENTS.md` (`docs/analysis/current_state_2026_03_05.md`) is not present in this checkout, so this dated note is the completion log for the slice.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: registered and activated the phase-3 slice/worktree.
  - `src/components/Navigation/Navigation.tsx`, `Navigation.css`, `src/components/Icon/icons.ts`: added visible Library/Queue/Visuals/Account app navigation with route-helper-gated Visuals access.
  - `src/routes/Orchestrator/views/OrchestratorView.tsx`, `OrchestratorView.css`, `orchestratorShellModel.ts`: added host/operator/browse shell model, Library escape, mobile tablist separation, and operator Stage-expanded layout.
  - `src/routes/Orchestrator/components/orchestratorStatus.ts`, `OrchestratorStatusStrip.tsx`, `OrchestratorStatusStrip.css`: added Browse-only status and priority hierarchy for authority vs signal indicators.
  - `src/routes/Orchestrator/components/PresetBrowser.tsx`, `PresetBrowser.css`, `presetEmptyState.ts`: moved policy/empty copy into a deterministic Presets-panel helper.
  - `flake.nix`: added Nix Chromium and exported `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for Playwright.
  - `src/store/store.ts`: added a narrow immutable-check ignore for `redux-optimistic-ui` wrapper history after Playwright screenshots exposed a dev overlay.
  - `e2e/orchestrator-visuals.spec.ts`: added authenticated desktop/mobile Visuals discovery checks.
  - `docs/architecture/orchestrator-synthesis-ui-style-guide.md`: recorded Visuals navigation, Library escape, and host/operator layout contract.
- Dependency chain:
  - App nav -> `getRouteAccessDecision('/orchestrator')` -> current user/room prefs -> `/orchestrator` route.
  - Orchestrator route -> capability derivation -> shell model -> desktop panels/mobile tabs/status authority -> Stage/Code/Preset surfaces.
  - Preset browser -> scoped preset tree -> panel state helper -> Presets-local policy/empty copy.
- Invariant overlap:
  - Access invariants: route guards remain the enforcement source; nav only mirrors the shared route helper.
  - Runtime visualizer policy: client dispatch gates from the prior capability slice are preserved.
  - UI accessibility: visible nav labels, link accessible names, mobile tablist semantics, and 44px touch targets.
- Known Issue overlap:
  - No open Known Issue overlap in this slice.

## RISKS

- Nav drift from route guard: medium likelihood / high impact / mitigated by calling `getRouteAccessDecision` from Navigation instead of duplicating rules.
- Hidden-but-reachable Code/API panels after capability changes: medium likelihood / medium impact / mitigated by pure shell model plus active panel/tab normalization.
- Operator layout dead space: medium likelihood / medium impact / mitigated by `operatorStageExpanded` and CSS row span for Stage.
- Playwright on Nix: medium likelihood / medium impact / mitigated by Nix Chromium and explicit executable path.
- Dev-only optimistic history overlay: medium likelihood / medium impact / mitigated by ignoring only `queue.history` and `userStars.history` wrapper bookkeeping while preserving immutable checks on current state.

Blast radius: app bottom navigation, `/orchestrator` desktop/mobile shell, Presets panel messaging, Orchestrator status strip, Redux dev middleware configuration, Nix dev shell, and Playwright Chromium e2e.

## REDTEAM

- Auth bypass: Visuals nav visibility is not enforcement. Existing `RequireAuth`/route guard remains the gate; Navigation only mirrors it for discoverability.
- Capability bypass: Code/API surfaces are hidden by shell model, while send handlers remain capability-gated from the previous slice. This slice does not loosen backend or socket enforcement.
- Admin lockout: owner/admin path still resolves `host` mode regardless of room collaborator prefs.
- Guest/collaborator confusion: browse-only status and Presets-local policy copy distinguish "can browse" from "can send."
- Scalability/persistence: no new server state or persistence layer changes.

## TESTS

- RED -> GREEN focused tests:
  - `src/components/Navigation/Navigation.test.tsx`
  - `src/routes/Orchestrator/views/orchestratorShellModel.test.ts`
  - `src/routes/Orchestrator/components/orchestratorStatus.test.ts`
  - `src/routes/Orchestrator/components/presetEmptyState.test.ts`
- Regression tests:
  - `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
  - `src/routes/Orchestrator/components/PresetBrowser.test.ts`
- Required verification:
  - PASS `npm test` - 101 files / 1158 tests.
  - PASS `npx tsc -b --noEmit`.
  - PASS `npm run lint`.
  - PASS `npm run slices:check` with pre-existing stale merged-branch warnings.
  - PASS `npm run build` with pre-existing webpack license and bundle-size warnings.
  - PASS `nix develop -c npm run test:e2e -- --project=chromium` - 3 Chromium tests.

## Visual QA

Playwright captures Visuals screenshots at:

- `.tmp/playwright-visuals-desktop.png` for 1440x900.
- `.tmp/playwright-visuals-mobile.png` for 390x844.

Acceptance checks cover Visuals discovery from Library, visible Library escape in Orchestrator, host status, desktop Presets/API tabs, mobile Stage/Code/Presets tablist, and no document-level horizontal overflow.

Screenshots were manually reviewed after the Redux optimistic-history overlay fix and showed the expected host split and mobile Library-plus-tablist layout.

## Rollback

After merge, rollback is `git revert <final phase-3-orchestrator-menu-productization commit>`. This slice does not include database migrations or server persistence changes.
