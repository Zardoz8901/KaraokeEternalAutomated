# Contributing to Karaoke Hydra

Thank you for your interest in contributing!

## Quick Guide

### I found a bug

First, search [existing issues](https://github.com/Zardoz8901/KaraokeEternalAutomated/issues) and [discussions](https://github.com/Zardoz8901/KaraokeEternalAutomated/discussions) — your issue might have already been reported or fixed.

If not, open an [Issue Triage](https://github.com/Zardoz8901/KaraokeEternalAutomated/discussions/new?category=issue-triage) discussion. Include:
- Steps to reproduce
- Expected vs actual behavior
- Browser/environment details

### I have a feature idea

Open a [Feature Request](https://github.com/Zardoz8901/KaraokeEternalAutomated/discussions/new?category=feature-requests) discussion.

### I have a question

Open a [Q&A](https://github.com/Zardoz8901/KaraokeEternalAutomated/discussions/new?category=q-a) discussion.

### I'd like to contribute code

All [issues](https://github.com/Zardoz8901/KaraokeEternalAutomated/issues) are actionable. Pick one and start working on it. If you need guidance, comment on the issue.

---

## Issues are Actionable

**Users cannot create Issues directly** — please create a Discussion first.

Unlike some projects, this repository does not use the issue tracker for discussion or feature requests. Instead, we use GitHub Discussions. Once a discussion reaches a point where a well-understood, actionable item is identified, it is moved to the issue tracker by the maintainer.

**This pattern makes it easier for contributors to find issues to work on since _every issue_ is ready to be worked on.**

Any Discussion which clearly identifies a problem and can be confirmed will be converted to an Issue by the maintainer — you don't do any extra work.

## Pull Requests

PRs should be associated with a previously accepted Issue. If you open a PR for something that wasn't previously discussed, it may be closed or remain stale.

Before submitting:
1. Reference the Issue number in your PR
2. Run `npm run lint && npm test`
3. Keep commits atomic and focused

## Development Environment

```bash
nix develop
npm install
npm run dev
```

The flake development shell is the current canonical local toolchain. It
provides the Node.js and npm versions expected by `package.json`, so validation
should run inside it when possible:

```bash
nix develop -c npm ci
nix develop -c npm run lint
nix develop -c npm run typecheck
nix develop -c npm test
```

When working in multiple Git worktrees, install dependencies per worktree with
`nix develop -c npm ci --prefer-offline --ignore-scripts`. Avoid sharing
`node_modules` between worktrees with symlinks; module resolution can drift
between worktree paths and produce misleading test failures.

### Future devenv direction

The intended developer-experience improvement is to move this setup into a
checked-in `devenv`/`direnv` workflow. That should make entering the repository
automatically select the correct Node.js/npm toolchain and expose the standard
validation commands without retyping `nix develop -c`.

A future `devenv` slice should:

1. Add the minimal `devenv` files needed to reproduce the current flake shell.
2. Keep Node.js 24 and npm 11 aligned with `package.json`.
3. Preserve per-worktree `node_modules` installs; do not introduce shared
   `node_modules` symlinks.
4. Document the expected first-run command for each worktree, likely
   `npm ci --prefer-offline --ignore-scripts`.
5. Leave production packaging in `flake.nix` unchanged unless a separate Nix
   packaging slice explicitly owns that work.

## Contributor License Agreement

By contributing, you agree to the [CLA](.github/CLA.md).

## Security

For vulnerabilities, **do not** open a Discussion or Issue. Use [GitHub Security Advisories](https://github.com/Zardoz8901/KaraokeEternalAutomated/security/advisories).
