# Orchestrator Color Role Map

## Context

The Orchestrator visual-system direction resolved C8-Q1 as:

- cyan = camera;
- violet = Applied on Player;
- green = synced/success.

Before this slice, the semantic role layer defined `--orch-live` but did not define `--orch-applied` or `--orch-success`. Applied-on-Player reused cyan, the Cam badge used blue, and the generic Gallery badge also inherited cyan. That blurred camera, applied Player truth, and synced success into the same signal family.

## Decision

- Added semantic role tokens:
  - `--orch-success: var(--orch-green)`
  - `--orch-applied: var(--orch-violet)`
- Routed StatusStrip success/live tones through semantic role tokens:
  - `success` → `--orch-success`
  - `live` → `--orch-live`
- Retoned PresetTree badges:
  - `Applied on Player` → `--orch-applied`
  - `Cam` → `--orch-live`
  - generic/Gallery badge → neutral surface/muted treatment so camera remains the only cyan row badge.
- Extended `orchestratorColorAudit.test.ts` to resolve the relevant role tokens and assert that live/applied/success map to distinct Solarized hues.

## Consequences

- No status tone names, labels, markup, behavior, socket contracts, Player code, or shared types changed.
- The broader "no raw hue past the role layer" audit remains out of scope; this slice only locks the live/applied/success distinction and the immediate badge/status consumers.
- The PresetTree reserved badge lane and strongest-truth-first ordering remain separate follow-on work.
- Visual verification is source/test based. Local Nix Chromium e2e remains blocked, so no screenshot evidence is claimed.

## Verification

RED:

- Added audit assertions for `--orch-applied`, `--orch-success`, distinct live/applied/success hue resolution, and Applied/Cam/Success role-token routing. The audit failed before the role tokens and CSS retone.

GREEN:

- `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- `npm test -- src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx`

Full gate:

- `npm run slices:check`
- `npm run typecheck`
- `npm run lint`

## Rollback

After merge, rollback with:

```sh
git revert <merge-sha>
```
