---
phase: 04-selective-multi-site-build-and-deploy
plan: 02
subsystem: selective-build
tags: [delta-build, git-diff, restore, prune, fail-open]
requires:
  - phase: 04-selective-multi-site-build-and-deploy
    plan: 01
    provides: Stable full-site builder and self-contained person route output
provides:
  - Changed-person detection
  - Live-site restore for selective builds
  - Selective overlay and route pruning
  - Fail-open full rebuild fallback
affects: [04-03, phase-5-automation]
tech-stack:
  added: []
  patterns: [git-diff-classification, live-site-restore, fail-open-full-rebuild]
key-files:
  created:
    - scripts/lib/build/change-detection.ts
    - scripts/lib/build/restore-live-site.ts
    - scripts/lib/build/selective-build.ts
    - scripts/changed-people.ts
    - scripts/changed-people.test.ts
  modified:
    - scripts/build-site.ts
    - scripts/build-site.test.ts
    - package.json
    - README.md
key-decisions:
  - "Treat any `people/<id>/` path as that person's change surface, including helper cache and import artifacts."
  - "Restore the currently deployed Pages artifact before a targeted build so unchanged people stay present in the final artifact."
  - "Widen to a full rebuild automatically when change classification or live-site restore is uncertain."
patterns-established:
  - "Selective overlay pattern: restore, rebuild only active changed people, then prune removed routes."
  - "Fail-open planning pattern: correctness beats optimization when the minimal target set is uncertain."
requirements-completed: [DEPL-02]
duration: pending
completed: 2026-03-17
---

# Phase 4 Plan 02: Add changed-person detection and selective CI build logic Summary

**Git-diff selection, live-site restore, and selective rebuild fallback behavior**

## Accomplishments

- Added `changed:people` plus shared change-detection logic that separates targeted person changes from full-rebuild triggers.
- Added live-site restore logic that rehydrates the current Pages artifact from `deploy-manifest.json` before a targeted overlay.
- Added selective-build orchestration that rebuilds only active changed people, removes disabled/archived routes, and falls back to a full rebuild when restore or classification fails.
- Added regression coverage for helper-artifact changes, full-rebuild widening, targeted removals, and fallback behavior.

## Evidence

- `scripts/lib/build/change-detection.ts`
- `scripts/lib/build/restore-live-site.ts`
- `scripts/lib/build/selective-build.ts`
- `scripts/changed-people.ts`
- `scripts/changed-people.test.ts`
- `scripts/build-site.test.ts`

## Verification

- `bun test scripts/changed-people.test.ts`
- `bun test scripts/build-site.test.ts --filter selective-merge`
- `bun run build:site -- --changed-paths-file <file> --public-origin <origin>`

## Next Readiness

`04-03` can now finalize `generated/site/` into a Pages artifact, skip deploys when the manifest already matches, and wire the whole flow into GitHub Actions.
