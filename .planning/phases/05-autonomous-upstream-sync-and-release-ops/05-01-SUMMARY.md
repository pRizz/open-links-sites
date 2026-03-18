---
phase: 05-autonomous-upstream-sync-and-release-ops
plan: 01
subsystem: upstream-sync-foundation
tags: [automation, upstream, git, github-actions]
requires:
  - phase: 04-selective-multi-site-build-and-deploy
    plan: 03
    provides: Centralized Pages deploy workflow and deploy-manifest planning
provides:
  - Source-controlled upstream `open-links` revision tracking
  - `sync:upstream` CLI with no-op, changed, and blocked states
  - Daily verify-before-publish workflow for direct-to-`main` upstream sync
affects: [05-02, 05-03]
tech-stack:
  added: []
  patterns: [pinned-upstream-state, stage-based-sync-summary, verify-before-publish]
key-files:
  created:
    - config/upstream-open-links.json
    - scripts/lib/release-ops/upstream-state.ts
    - scripts/lib/release-ops/upstream-sync.ts
    - scripts/lib/release-ops/release-summary.ts
    - scripts/sync-upstream.ts
    - scripts/sync-upstream.test.ts
    - .github/workflows/upstream-sync.yml
  modified:
    - package.json
    - README.md
key-decisions:
  - "Introduced a tracked upstream revision file so upstream-only movement becomes a reproducible repo delta instead of a floating CI assumption."
  - "Kept `sync:upstream` non-publishing: it may update local tracked state, but commit and push remain workflow responsibilities after verification passes."
  - "Used concise stage-based summaries and GitHub output fields from the sync CLI so later release workflows can reuse the same reporting surface."
patterns-established:
  - "Pinned-upstream state: store repository, branch, commit, and sync timestamp in source control."
  - "Verify-before-publish automation: scheduled sync can mutate local state, but it does not write to `main` until repo verification succeeds."
requirements-completed: [AUTO-01]
duration: pending
completed: 2026-03-17
---

# Phase 5 Plan 01: Implement the daily upstream sync workflow and direct-to-main update path Summary

**Pinned upstream state, a sync CLI, and the first direct-to-`main` automation path**

## Accomplishments

- Added `config/upstream-open-links.json` as the source-controlled record of which upstream `open-links` commit this repo is synced to.
- Added release-ops helpers plus the `sync:upstream` CLI that classify runs as `no-op`, `changed`, or `blocked`.
- Added a daily `upstream-sync.yml` workflow that refreshes the pinned upstream state, verifies the repo, and only then commits and pushes to `main`.
- Documented the new upstream-sync contract and operator entrypoint in the README.

## Evidence

- `config/upstream-open-links.json`
- `scripts/lib/release-ops/upstream-state.ts`
- `scripts/lib/release-ops/upstream-sync.ts`
- `scripts/lib/release-ops/release-summary.ts`
- `scripts/sync-upstream.ts`
- `scripts/sync-upstream.test.ts`
- `.github/workflows/upstream-sync.yml`

## Verification

- `bun test scripts/sync-upstream.test.ts`
- `bun run sync:upstream -- --root "$PWD" --upstream-repo-dir /Users/peterryszkiewicz/Repos/open-links --format json`
- `bun run check`
- `bun run validate`

## Next Readiness

`05-02` can now make push and nightly deploys build against the pinned upstream revision instead of a floating upstream checkout.
