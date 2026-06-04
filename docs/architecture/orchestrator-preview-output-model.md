# Orchestrator Preview/Output Model

This guide defines the product language for Orchestrator preview, Player output, and Player-applied runtime state. It exists so future UI work can improve confidence without implying that the local Hydra preview is an authoritative mirror of what the audience sees.

## Context

The Orchestrator has a fast local Hydra preview. It is useful for edit feedback and preset audition, but it is not the Player's rendered output. Phase 7A added Player-applied runtime truth, and Phase 7B/7B.1 made `initVideo()` source binding deterministic when Player MP4 media is available. Those slices improved runtime truth, but separate Hydra runtimes can still diverge visually because they render in different browser contexts with different timing, audio inputs, and device conditions.

Historical Apple Human Interface Guidelines are useful here as archival product guidance: make state visible, keep the user's mental model concrete, make direct actions produce immediate feedback, avoid hidden modes, and keep labels consistent with behavior. For this app, that means the UI must not collapse local preview, broadcast sync, Player application, and actual audience output into one "live" label.

## Decision

Use these terms consistently:

| Term | Meaning | Allowed claim |
| --- | --- | --- |
| Local Preview | This client's local Hydra render for fast editing and audition. | "This is approximate local feedback." |
| Preview using Player MP4 | Local Preview is borrowing the current Player MP4 source and clock. | "This preview uses Player media, but it is still local." |
| Preview waiting for Player media | Local Preview is intentionally held because the Hydra code needs `initVideo()` and the required Player MP4 provider is not ready. | "The preview is waiting rather than falling back to random external video." |
| Fallback external source | Hydra used external/random video because no current Player MP4 source is available or required. | "This source is not the Player MP4." |
| Applied on Player | The Player confirmed eval, first tick, and sanitized source-binding data for an accepted visualizer run. | "The Player applied this run." |
| Player Output | The actual visual output rendered by the Player display for the audience. | "This is the authoritative audience truth." |
| Player Live | A continuous mirror, stream, or snapshot of Player Output. Not built and not a roadmap item under Option A; would require a fresh ADR (see [ADR](orchestrator-player-live-decision.md)). | Forbidden as a label on Local Preview; usable only if such a feature is ever built. |

Never label the local Hydra preview as **Live**, **Player Output**, **Now Playing**, or **On Display**.

Allowed current labels:

- Local Preview
- Preview using Player MP4
- Preview waiting for Player media
- Applied on Player
- Synced
- Fallback external source

## Placement Rules

- The preview panel owns `Local Preview` and source-binding copy such as `Preview using Player MP4` or `Preview waiting for Player media`.
- Preset rows and nearby status surfaces own `Applied on Player` when the applied metadata matches the preset or gallery key.
- Broadcast state remains separate: `Sending`, `Synced`, `Failed`, and remote-update copy describe socket/broadcast flow, not Player output.
- `Player Output` should describe the actual display surface. Do not use it for inferred status text.
- `Player Live` and `Player Output` must not be introduced as labels for the Local Preview. The Orchestrator surfaces no mirror or snapshot of Player output; under Option A this prohibition is permanent.
- Source-binding warnings should appear near the preview or affected preset action, not in a detached help banner.

## Consequences

Future UI work improves Local Preview clarity only: rename and annotate the existing preview/status copy without adding runtime protocol. `Local Preview` is the terminal Orchestrator preview surface.

The Player still renders actual audience output; the Orchestrator does not surface a copy of it. Per the Owner Decision (2026-06-04), Option A is adopted: no Player-output snapshot or live mirror is on the roadmap. A mirror or snapshot (Option C) would be a later high-risk architecture slice for actual Player-output transport, rendering, validation, and failure states, and would require a fresh ADR before adoption.

This guide intentionally does not change server/socket protocol, Player rendering, route guards, preset CRUD, package, Nix, workflow, or e2e behavior.

