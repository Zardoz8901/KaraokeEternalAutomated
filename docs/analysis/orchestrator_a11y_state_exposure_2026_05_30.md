# Orchestrator A11y State Exposure

## Context

Gate 3 already locked the Orchestrator status vocabulary and surface ownership, but several state changes were still exposed only visually:

- remote update banner appearance/count changes;
- Stage status strip authority/broadcast/camera pills;
- CodeEditor send and lint feedback;
- HydraPreview source/audio truth;
- Stage preview buffer selection;
- PresetTree row badge states.

The slice goal was attribute/markup-only exposure of those existing truths. It intentionally did not relabel copy, change status ownership, alter CSS/tokens, or change runtime logic.

## Decision

- Added polite live-region exposure to the remote-update banner, status strip, CodeEditor send feedback, and HydraPreview status overlay.
- Added accessible names to status-strip pills so the spoken form includes the concept and value while visible text stays unchanged:
  - `Authority: ...`
  - `Broadcast: ...`
  - `Camera: ...`
- Marked the Stage buffer controls as a labelled radiogroup, with each option exposed as a radio and its active state represented by `aria-checked`.
- Composed existing PresetTree badge truths into each preset row's accessible name for `Loaded in preview`, `Applied on Player`, `Start`, and `Cam`.

## Consequences

- Screen readers now receive state changes and selected buffer state without introducing new labels or moving ownership between surfaces.
- The OrchestratorStatusStrip remains action-free; the remote-update banner still owns Apply/Dismiss.
- The PresetTree row accessible name is more descriptive for stateful rows, while `aria-pressed` still carries row selection.
- This slice leaves Stage-header layout, focus/density CSS, Player Output snapshot, server/socket/shared contracts, and Player rendering untouched.

## Verification

RED:

- Added tests first for missing live regions, pill accessible names, buffer selector state, preview live region, and preset row badge names. The targeted suite failed on those missing attributes before production edits.

GREEN:

- `npm test -- src/routes/Orchestrator/views/OrchestratorView.test.tsx src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx src/routes/Orchestrator/components/CodeEditor.test.tsx src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/components/PresetTree.test.tsx`

Full gate:

- `npm run slices:check`
- `npm run typecheck`
- `npm run lint`

## Rollback

After merge, rollback with:

```sh
git revert <merge-sha>
```
