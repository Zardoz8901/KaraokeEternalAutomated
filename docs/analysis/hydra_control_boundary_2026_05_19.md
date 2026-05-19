# Hydra Control Boundary — 2026-05-19

## Context

Hydra started as an admin-only live visual control surface. The current room-policy model lets collaborators use `/orchestrator`, but live Hydra code is executable browser state that is broadcast and replayed to the room.

The slice decision is:
- room owner/admin sockets may continue to broadcast arbitrary Hydra code;
- collaborators and guests may only broadcast persisted DB presets that the server resolves and validates against room policy;
- client-supplied code and folder metadata are not trusted for collaborator sends.

## Decision

`VISUALIZER_HYDRA_CODE_REQ` now resolves a broadcast payload through server-side access policy.

Owner/admin sends preserve the existing arbitrary-code behavior. Non-manager sends must include a real `hydraPresetId`; the server loads that preset from `hydraPresets`, uses the DB code/name/folder metadata for broadcast, and rejects the request if the room disables orchestrator access, disables collaborator visual sends, or restricts collaborators to a different party folder.

Room visualizer replay state is stored as an attributed state object with room ID, author user/name, update timestamp, and normalized payload. Replays keep the existing `VISUALIZER_HYDRA_CODE` action shape while adding attribution fields that current reducers ignore safely.

## Consequences

Collaborators can still drive party visuals, but only through saved presets that the server can validate. Arbitrary live-code remains a host/admin power.

Gallery presets remain owner/admin-only in this slice because gallery code is bundled client-side rather than represented by a server-validatable DB row.

## Red-Team Pass

- Auth bypass: collaborator payloads with forged `hydraPresetFolderId`, forged `hydraPresetName`, or arbitrary `code` are rejected unless backed by a DB preset.
- Guest escalation: guests follow the same non-manager path and require both room orchestrator access and collaborator visual-send policy.
- Stored-XSS-as-feature: still accepted for owner/admin arbitrary code; constrained for collaborators to persisted presets.
- Stale replay: replay state now has a single clear function and is cleared on room empty, explicit admin room delete, and idle ephemeral cleanup.
- Data loss: no DB schema or preset mutation changes.
- Scalability: replay state remains in-memory and per-room; this matches the current single-instance deployment model.

## Verification

- `npm test` — 91 files / 1118 tests
- `npm test -- server/Player/socket.test.ts`
- `npm test -- server/Rooms/router.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run slices:check` — passed with existing warnings for already-merged cleanup branches

## Rollback

Pre-change savepoint command was run in the clean feature worktree; no local changes existed to stash.

After merge, rollback with:

```sh
git revert c50912d7
```
