# Orchestrator Workspace Model - 2026-05-21

## Context

This slice follows Visuals productization by extracting the Orchestrator runtime decisions out of `OrchestratorView`. The intent is architectural: the route view should compose the workspace, while pure helpers and a thin integration hook own state transitions, Redux wiring, camera wiring, resize persistence, and remote/send timing.

The current-state file referenced by `AGENTS.md` (`docs/analysis/current_state_2026_03_05.md`) is not present in this checkout, so this dated note is the completion log for the slice.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: registered and activated the phase-4 slice/worktree.
  - `src/routes/Orchestrator/views/OrchestratorView.tsx`: reduced the route view to direct composition of Presets/API, Stage, Code, status strip, Library escape, mobile tabs, and remote banner.
  - `src/routes/Orchestrator/views/useOrchestratorWorkspace.ts`: added the thin integration facade for Redux selectors/dispatch, dynamic visualizer reducer injection, `fetchCurrentRoom()`, `useCameraSender()`, timers/effects, and typed plain prop objects.
  - `src/routes/Orchestrator/views/orchestratorSendState.ts`: added pure send ack state transitions for sending, matched remote ack, timeout error, synced reset, and edit reset.
  - `src/routes/Orchestrator/views/orchestratorRemoteState.ts`: added pure remote-code sync, pending remote replacement/counting, apply/dismiss, and preset-index auto-apply transitions.
  - `src/routes/Orchestrator/views/orchestratorWorkspaceModel.ts`: composed shell normalization, preview sizing, remote visualizer source selection, and effective workspace code derivation.
  - `src/routes/Orchestrator/views/orchestratorWorkspaceResize.ts`: added pure ref-panel width clamp, storage, serialization, and pointer calculations.
  - Focused tests under `src/routes/Orchestrator/views/`: covered send state, remote state, workspace model, resize bounds, and view import boundaries.
- Dependency chain:
  - `/orchestrator` route -> `OrchestratorView` -> `useOrchestratorWorkspace` -> pure workspace/send/remote/resize helpers -> existing Orchestrator components.
  - Workspace hook -> Redux state (`user`, `rooms`, `status`, lazy `playerVisualizer`) -> visualizer source selection -> Stage preview/Code editor props.
  - Workspace hook -> `VISUALIZER_HYDRA_CODE_REQ` dispatch -> existing server socket contract -> player visualizer runtime.
  - Workspace hook -> `useCameraSender()` unchanged -> existing camera relay socket lifecycle.
- Invariant overlap:
  - Camera relay lifecycle: the camera sender hook is not modified, but ownership is moved behind the workspace facade.
  - Visualizer runtime behavior: send ack timing, remote update banners, preset auto-apply, and preview code derivation are preserved in focused tests.
  - Access consistency: capability derivation and previous UI dispatch gates remain in use; no backend/socket enforcement changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- God-hook regression: medium likelihood / high impact / mitigated by keeping `useOrchestratorWorkspace` as a facade and moving deterministic behavior into pure helpers.
- Camera relay lifecycle regression: low-medium likelihood / high impact / mitigated by leaving `useCameraSender()` unchanged and logging camera validation status.
- Send/remote behavior drift: medium likelihood / high impact / mitigated by exact tests for ack matching, timeout, synced reset, pre-edit sync, pending replacement/counting, apply/dismiss, and preset-index auto-apply.
- Route view backslide: medium likelihood / medium impact / mitigated by `orchestratorViewBoundary.test.ts`, which bans direct imports for Redux hooks, action types, reducer injection, camera sender, layout/status/shell/runtime helpers, and capability helpers.

Blast radius: `/orchestrator` desktop/mobile, visualizer send UX, remote update banner, Stage preview, Code editor send/resend state, camera relay toggle wiring, Presets/API panel switching, and Orchestrator test surface.

## REDTEAM

- Data loss: no destructive server/data paths changed.
- Auth bypass: no backend enforcement, socket contract, route guard, or room policy route changed. Client capability gating remains driven by the existing helpers.
- Admin lockout: owner/admin capabilities still resolve through `getOrchestratorCapabilities`; the refactor does not alter room ownership or admin rules.
- Scalability: no new process-global maps, caches, sockets, or persistent stores added. Timers and RAF callbacks are component-scoped and cleaned up by effects.
- Payload injection: Hydra payload validation remains server-side; this slice only preserves the existing client dispatch path.
- Camera relay: the sender hook remains unchanged; risk is lifecycle ownership by composition, not signaling logic. Manual camera validation is still required on physical devices.

## TESTS

- RED -> GREEN focused tests:
  - PASS `npm test -- src/routes/Orchestrator/views/orchestratorSendState.test.ts src/routes/Orchestrator/views/orchestratorRemoteState.test.ts src/routes/Orchestrator/views/orchestratorWorkspaceModel.test.ts src/routes/Orchestrator/views/orchestratorWorkspaceResize.test.ts src/routes/Orchestrator/views/orchestratorViewBoundary.test.ts` - 5 files / 27 tests.
  - PASS `npm test -- src/routes/Orchestrator` - 37 files / 250 tests.
- Full verification:
  - PASS `npm run typecheck`.
  - PASS `npm test` - 106 files / 1185 tests.
  - PASS `npm run lint`.
  - PASS `npm run slices:check` with pre-existing stale merged-branch warnings.
  - PASS `npm run build` with pre-existing webpack license and bundle-size warnings.
  - PASS `nix develop -c npm run test:e2e -- --project=chromium` - 3 Chromium tests.

## Validation

Automated Orchestrator tests, full Vitest, lint, typecheck, build, and Nix Chromium Playwright pass. Manual camera/player validation remains the high-risk runtime check because this environment cannot perform iPhone Safari hardware-camera validation.

Required manual checks to record before declaring physical-device completion:

1. iPhone Safari opens `/camera`, grants permission, starts relay; player displays live feed.
2. Stop and restart relay without page reload; feed resumes.
3. With relay active, switch non-camera preset to camera preset; camera feed binds immediately.
4. Send visualizer from Orchestrator while relay active; player applies without requiring relay restart.
5. Standard user joins another standard user's room and stays in host room context.
6. If room relay is allowed by prefs, guest/standard account page shows `Open Camera Relay` action.

## Rollback

After merge, rollback is `git revert <final phase-4-orchestrator-workspace-model commit>`. This slice does not include database migrations, backend socket changes, package changes, Nix changes, or workflow changes.
