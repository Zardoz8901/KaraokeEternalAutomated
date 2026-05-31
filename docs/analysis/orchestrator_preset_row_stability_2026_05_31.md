# Orchestrator Preset Row Stability

## Context

The early-HiG red-team kept the dense PresetTree row shape, but identified two remaining debts:

- badge changes could reflow rows mid-set;
- row activation collapsed `Selected` and `Loaded in preview` by loading on row click/Enter.

The visual-system direction also made badge order a firm rule: strongest truth first, matching the Stage strip's authority-first pattern. Gallery identity also needed to live on each gallery row, not only the gallery folder header.

## Decision

- Decoupled row selection from local preview loading:
  - row click and Enter now select the preset only;
  - the explicit Load button is the only path that marks `Loaded in preview` and invokes the preview load callback;
  - Space-to-send remains gated by the existing row UX model.
- Reordered row badge rendering and accessible-name composition to:
  - `Applied on Player`
  - `Loaded in preview`
  - `Selected`
  - `Start`
  - `Cam`
  - `Gallery`
- Rendered `Gallery` as a preset-row badge for gallery leaves.
- Added a fixed-height, no-wrap badge lane with hidden overflow and badge ellipsis so row geometry stays stable as badges appear/disappear.

## Consequences

- Selection is now an inert row operation; loading is an explicit object action.
- `Selected` and `Loaded in preview` remain visually and semantically separate.
- The strongest current room truth, `Applied on Player`, is first in visual and assistive-tech reading order.
- This slice does not change labels, status ownership, send/manage gates, socket behavior, Player runtime, preset CRUD, or server contracts.
- Layout verification is source/test based. Local Nix Chromium e2e remains blocked, so no screenshot evidence is claimed.

## Verification

RED:

- Added tests first for row click/Enter selecting without loading, explicit Load doing the preview load, strongest-truth badge order, Gallery row identity, and fixed no-wrap badge lane CSS. The targeted suite failed before implementation.

GREEN:

- `npm test -- src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/PresetBrowser.test.tsx`
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
