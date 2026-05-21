# Visualizer Player Video Source Sync — 2026-05-21

## Context

Phase 7B follows Phase 7A's accepted/applied runtime truth layer. Before this
slice, Hydra presets that called `sN.initVideo(...)` created independent video
elements in the Player and Orchestrator preview. That made video-based visuals
look unrelated to the currently playing MP4, and Orchestrator could not tell
whether the Player actually bound a Player media source or fell back to a
standalone external source.

## Decision

- Player status now carries media-clock truth: `mediaId`, `mediaType`,
  `queueId`, `position` in seconds, `isPlaying`, and `statusAt` as Unix
  milliseconds.
- Player identity registration is emitted once without throttle before the
  Player/Hydra subtree mounts. Regular status updates remain throttled.
- New accepted visualizer runs clear stale applied state, and Orchestrator row
  mapping ignores applied state whose run id does not match the currently
  accepted run id.
- The Player-applied protocol accepts a sanitized source-binding summary only
  from the pinned Player identity. Raw URLs and malformed fields are ignored.
- `applyVideoProxyOverride()` can bind borrowed Player/shadow MP4 elements as
  the default `initVideo()` source. Borrowed elements are never paused,
  removed, `src`-cleared, loaded, or track-stopped by Hydra cleanup.
- Active Player MP4 media intentionally overrides artist-authored
  `sN.initVideo(...)` URLs while current MP4 media is available. Existing
  external/random behavior remains fallback when no current MP4 source exists.
- Orchestrator preview creates a muted same-origin shadow video from
  `/api/media/${mediaId}?type=video`, seeks from the Player media clock, mirrors
  pause/play, and corrects drift above 0.75 seconds. This is not frame-perfect
  cross-device sync.
- Player visualizer mount policy remains unchanged: CDG mounts Hydra,
  video-keyed MP4 mounts Hydra, plain MP4 does not.

## REDTEAM

- Auth/source spoofing: applied source-binding data is accepted only from the
  pinned `{socketId, playerInstanceId}` and is sanitized server-side.
- Payload injection: source summary is limited to enum status, positive numeric
  ids/timestamps, non-negative position, and `s0`-`s3` source keys. Raw URLs are
  not broadcast.
- Identity race: the Player emits an unthrottled identity/status registration
  before the visualizer subtree can mount and emit applied state.
- Borrowed-element lifecycle: provider-returned Player/shadow video elements
  are owned by their provider, not by Hydra's source cleanup.
- Mount broadening: tests lock CDG and video-keyed MP4 as visualizer-enabled,
  and plain MP4 as visualizer-disabled.

## Verification

- PASS: `npm ci` in the Phase 7B worktree. The local toolchain reports Node
  `v22.22.0`/npm `10.9.4` against package engines `node >=24`, `npm >=11`; the
  install completed from the lockfile.
- PASS: `npm test -- server/Player/socket.test.ts src/store/modules/status.test.ts src/lib/videoProxyOverride.test.ts src/routes/Player/components/Player/playerVisualizerMountPolicy.test.ts src/routes/Orchestrator/components/presetOperatorUx.test.ts src/routes/Orchestrator/components/HydraPreview.test.tsx`
- PASS: `npm test -- server/Player/socket.test.ts src/lib/videoProxyOverride.test.ts src/routes/Player src/routes/Orchestrator src/store/modules/status.test.ts`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npm test` — 110 files / 1229 tests.
- PASS: `npm run slices:check` — warnings only for stale merged cleanup
  branches.

## Manual Validation

Not completed in this automated pass. Before production deployment, run the
high-risk camera/player/orchestrator smoke matrix from `AGENTS.md`, plus this
Phase 7B-specific smoke:

- Start the Player on an MP4 with video-keying enabled.
- Send a Hydra preset that calls `s0.initVideo(...)`.
- Confirm the Player visual uses the current MP4 instead of random external
  start time.
- Open Orchestrator and confirm preview follows the same MP4 media URL and
  approximate clock.
- Switch buffers/source keys and confirm they reuse the Player media source.
- Switch to plain MP4 without video keying and confirm Hydra does not mount.

## Rollback

Before merge, from the feature branch tip use `git revert HEAD`.

After merge, use `git revert <phase-7b-sha>` to remove Phase 7B.
