# Orchestrator Preset Operator Runtime UX — 2026-05-21

## Context

Phase 5 documented the Preset operator and Browse-only contract. Phase 6 implements the client-only runtime portion for the Orchestrator Presets surface without changing backend authority, socket protocol, room prefs, route guards, package files, Nix, workflows, or Player runtime behavior.

## Decision

- Non-host Orchestrator workspaces hide preset/folder management controls, including New Folder, Save Preset, gallery Save copy, rename, move, delete, set start, and set player folder.
- Preset keys are deterministic: `preset:<number>` for saved DB presets and `gallery:<string>` for gallery presets.
- `Selected` and `Loaded in preview` are separate client-local states.
- Party-folder restriction limits Send eligibility, not local browsing or local preview visibility.
- Broad policy blockers appear once in the Presets panel. Row-specific copy is reserved for per-row restrictions such as `Not in party folder`.
- Gallery presets are preview-only for non-host users until a server-validatable gallery source exists.

## REDTEAM

- Hidden UI is not authorization. Server and socket enforcement remain unchanged and continue to be the security boundary.
- Hidden management handlers are guarded in `PresetBrowser`, and component tests call the handlers defensively to verify non-host users cannot open management modals through stale props.
- Non-host gallery raw-code send is not added. The Stage picker still only receives gallery send handlers for managers, and PresetTree hides non-host gallery Send/Save copy actions.
- Player-applied/live preset labels are not introduced; the UI only claims local selection, local preview load, send request, and existing synced status.

## Verification

- PASS: `npm test -- src/routes/Orchestrator/components/presetEmptyState.test.ts src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/PresetPicker.test.tsx src/routes/Orchestrator/components/PresetBrowser.test.tsx`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorCapabilities.test.ts src/routes/Orchestrator/views/orchestratorShellModel.test.ts`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm run slices:check`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npm test` — 108 files / 1204 tests.

## Rollback

Feature commit rollback before merge: `git revert bf335538`.

After merge, use `git revert <merge-or-feature-sha>` to remove the runtime UX slice from main.
