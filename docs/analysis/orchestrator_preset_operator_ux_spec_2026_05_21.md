# Orchestrator Preset Operator UX Spec - 2026-05-21

## Context

This docs-first slice defines the Preset operator and Browse-only UX contract before runtime UI implementation. It follows the Orchestrator workspace-model refactor, which made it practical to change Presets, Stage, and role-aware shell behavior without returning to a large route component.

The current-state file referenced by `AGENTS.md` (`docs/analysis/current_state_2026_03_05.md`) is not present in this checkout, so this dated note is the completion log for the slice.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: registered and activated the phase-5 docs slice.
  - `docs/architecture/orchestrator-preset-operator-ux.md`: added the decision spec for Preset operator and Browse-only behavior.
  - `docs/architecture/orchestrator-synthesis-ui-style-guide.md`: linked the spec and fixed the product-model wording to separate Orchestrator workspace modes from the Player runtime role.
  - `docs/ARCHITECTURE.md`: linked the new spec from related documentation.
  - `docs/analysis/orchestrator_preset_operator_ux_spec_2026_05_21.md`: recorded this completion note.
- Dependency chain:
  - Spec -> next runtime Orchestrator Presets implementation -> current capability helpers and backend enforcement.
  - No runtime code, socket contract, backend route, room policy, package, Nix, e2e, or workflow file changes.
- Invariant overlap:
  - Access invariants remain documented only; backend and socket enforcement are unchanged.
  - Visualizer authority boundary remains owner/admin live-code and collaborator saved-DB-preset-only.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Implementation ambiguity: medium likelihood / high impact / mitigated by required spec sections, explicit action matrix, exact Load definition, and state-truth model.
- Future false live-state claims: medium likelihood / high impact / mitigated by making Applied on Player protocol-dependent.
- Docs-only gap: low likelihood / medium impact / mitigated by clearly stating this slice does not change runtime UI.

Blast radius: documentation and work-control only.

## REDTEAM

- Auth bypass: no route guard, backend, socket, or capability enforcement changes.
- Guest privilege drift: the spec explicitly requires hiding guest management controls that backend would reject.
- Data loss: no destructive runtime actions added; delete/move/rename behavior is only documented.
- Payload injection: no Hydra dispatch or eval path changes.
- Protocol overclaiming: the spec forbids "Applied on Player" or "Live preset" labels until a player-applied ack exists.

## TESTS

- PASS `rg -n "Preset Operator UX|orchestrator-preset-operator-ux" docs`.
- PASS `npm run slices:check` with pre-existing stale merged-branch warnings.
- PASS `npm run typecheck`.
- PASS `npm run lint`.

## Rollback

After merge, rollback is `git revert <final phase-5-orchestrator-preset-operator-ux-spec commit>`. This slice does not include database migrations, backend changes, package changes, Nix changes, or workflow changes.
