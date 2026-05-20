# Orchestrator Capability UX - 2026-05-20

## Context

This slice aligns the Orchestrator UI with the backend Hydra authority boundary from `server/Player/socket.ts`. The backend remains authoritative; this work prevents the UI from offering or dispatching sends that the socket handler will reject.

## ARCH

- Files touched:
  - `src/routes/Orchestrator/components/orchestratorCapabilities.ts`: shared client capability contract.
  - `src/routes/Orchestrator/views/OrchestratorView.tsx`: handler-level raw code and preset dispatch gates.
  - `src/routes/Orchestrator/components/CodeEditor.tsx`: live-code send/resend disabled for non-managers.
  - `src/routes/Orchestrator/components/PresetPicker.tsx`: gallery raw-code send path available only when `onSend` is provided by a manager-capable parent.
  - `src/routes/Orchestrator/components/PresetBrowser.tsx` / `PresetTree.tsx`: saved preset send uses one predicate for click and keyboard activation.
  - Focused tests for capability rules, CodeEditor, PresetPicker, and PresetTree.
- Dependency chain: Orchestrator UI -> `VISUALIZER_HYDRA_CODE_REQ` -> `server/Player/socket.ts` policy -> room broadcast -> Player visualizer runtime.
- Invariant overlap: Access invariants and visualizer socket broadcast policy.
- Known issue overlap: M-2 remains a backend accepted/deferred risk; this slice reduces UI-level accidental or stale rejected sends but does not change socket authority.

## Implementation

- Added `getOrchestratorCapabilities()` as the single client-side authority model for the Orchestrator.
- Room owner/admin can live-code and send gallery/raw-code presets.
- Collaborator/guest send requires both `allowGuestOrchestrator` and `allowRoomCollaboratorsToSendVisualizer`, plus a real saved DB preset id.
- When collaborators are restricted to a party preset folder, client send capability also requires the preset to be in that folder.
- Room visual policy management remains owner-only, matching `/api/rooms/my/prefs`.
- Preset/folder CRUD authorization is preserved as admin-or-author.

## REDTEAM

- Raw code bypass via `handleSendCode`, `handleSendPreset(string)`, and `handleResend`: mitigated with handler-level capability checks.
- Gallery picker as raw-code send path: mitigated by omitting gallery Send controls unless the parent has manager raw-code capability.
- Preset row keyboard bypass: mitigated by sharing `canSendPreset` across Space-key and Send-button paths.
- Backend/UI policy drift: mitigated with focused tests for both room pref gates, DB preset id requirement, gallery manager-only behavior, and party-folder restriction.
- Admin policy expansion: not introduced; room policy management remains owner-only because the backend route is own-room only.

Open residual risk: manual multi-user browser smoke was not run in this slice. Backend still enforces all security decisions if a client is modified.

## TESTS

- RED confirmed before implementation: new capability, PresetTree, PresetPicker, and CodeEditor tests failed.
- GREEN:
  - `nix develop -c npm test -- src/routes/Orchestrator/components/orchestratorCapabilities.test.ts src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/PresetPicker.test.tsx src/routes/Orchestrator/components/CodeEditor.test.tsx src/routes/Orchestrator/views/orchestratorViewHelpers.test.ts`
  - `nix develop -c npm test` (93 files / 1127 tests)
  - `nix develop -c npm run typecheck`
  - `nix develop -c npm run lint`
  - `nix develop -c npm run slices:check`
  - `nix develop -c npm run build`

Notes: Vitest emits existing jsdom/media and CSS-module warnings; tests pass. The production build emits existing license and asset-size warnings; build passes.

## Rollback

Before coding, `git stash push -m "pre-orchestrator-capability-ux-savepoint"` reported no local changes to save. After merge, rollback command is `git revert aa594b49`.
