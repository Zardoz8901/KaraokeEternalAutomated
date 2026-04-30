# Video Proxy IP Pinning — 2026-04-30

## Context

M-1 was reopened after review because hostname-string denylisting and pre-fetch DNS validation did not fully close DNS rebinding. A hostname could validate as public before fetch, then resolve to a private/link-local address during the actual outbound connection.

## Decision

Route video proxy and cache prewarm outbound HTTPS requests through `server/VideoProxy/resolvedFetch.ts`.

The helper:
- rejects non-HTTPS URLs and private/loopback/link-local/CGNAT/ULA hosts;
- resolves the upstream hostname before connecting;
- requires every DNS answer to be public;
- passes a custom `lookup` function to `https.request` that returns only the already validated IP;
- preserves the original hostname for `Host` and SNI compatibility.

## Consequences

M-1 is closed for the current proxy design. The proxy now owns a custom HTTPS fetch path instead of relying on undici/global `fetch`, so playback should be watched after deploy for edge cases around redirects, range requests, TLS/SNI, and upstream hosts that depend on unusual DNS behavior.

## Red-Team Pass

- DNS rebinding: mitigated by validating DNS answers and pinning the connection lookup to the validated IP.
- Literal private hosts: blocked by existing and extended denylist checks, including IPv4-mapped private IPv6 and `::`.
- Redirects: every redirect hop is revalidated before the next request.
- Cache prewarm: uses the same resolved fetch helper as foreground proxying.
- Residual risk: this remains a general outbound proxy for authenticated users; an upstream allow-list would further narrow policy but would also reduce usefulness.

## Verification

- `npx vitest run --config config/vitest.config.ts server/VideoProxy/resolvedFetch.test.ts server/VideoProxy/router.test.ts server/VideoProxy/cache.test.ts`
- `npx tsc -b --noEmit`
- `npm run lint`
- `npm test` — 90 files / 1107 tests passed

## Rollback

Savepoint before implementation: `stash@{0}: pre-video-proxy-ip-pin-savepoint`.

After commit, rollback with `git revert <sha>`.
