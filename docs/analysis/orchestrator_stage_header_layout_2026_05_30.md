# Orchestrator Stage Header Layout

## Context

The Gate 3 Stage Header Contract defines a stable information hierarchy:

1. left: Stage label and Preview qualifier;
2. center: status strip, width-limited and truncating before crowding controls;
3. right: camera pipeline and preview buffer controls.

The remaining HiG backlog item for this surface was that the mobile header hid the `Preview` qualifier, leaving the operator's primary device with a bare `Stage` label and weakening the Local Preview mental model.

## Decision

- Locked the Stage header into named grid areas: `label`, `status`, and `controls`.
- Kept the status strip in the center slot and added explicit overflow handling on the slot.
- Kept camera pipeline and buffer controls in the right/control slot.
- Made the `Preview` qualifier visible at mobile and desktop widths with compact `Stage · Preview` visual treatment.
- Preserved the mobile three-row wrap order: label, status, controls.
- Kept mobile buffer buttons at `--orch-touch-target`.

## Consequences

- The Stage header now has an executable CSS-source contract for order, truncation, mobile qualifier visibility, and touch sizing.
- No status vocabulary, status ownership, HydraPreview rendering, Player Output snapshot, server/socket/shared contracts, or Player rendering changed.
- jsdom cannot evaluate media queries or measure collision, so the slice verifies mobile/layout behavior through raw CSS source assertions rather than screenshots. Local Nix Chromium e2e remains blocked.

## Verification

RED:

- Added raw-CSS assertions for named grid areas, mobile `Preview` visibility, status-slot overflow, status-pill ellipsis, and mobile buffer touch sizing. The test failed before the CSS contract was applied.

GREEN:

- `npm test -- src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/views/orchestratorShellModel.test.ts`
- `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`

Full gate:

- `npm run slices:check`
- `npm run typecheck`
- `npm run lint`

## Rollback

After merge, rollback with:

```sh
git revert <merge-sha>
```
