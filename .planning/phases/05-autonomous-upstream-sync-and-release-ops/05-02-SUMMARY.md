---
phase: 05-autonomous-upstream-sync-and-release-ops
plan: 02
subsystem: pinned-upstream-deploy-context
tags: [deploy, pages, nightly, upstream, github-actions]
requires:
  - phase: 05-autonomous-upstream-sync-and-release-ops
    plan: 01
    provides: Source-controlled upstream revision tracking and daily sync workflow
provides:
  - Deploy context resolution from pinned upstream state
  - Nightly GitHub Pages backstop mode on the centralized deploy workflow
  - Deploy summaries that include trigger mode and pinned upstream revision
affects: [05-03]
tech-stack:
  added: []
  patterns: [pinned-upstream-builds, nightly-deploy-backstop, mode-aware-pages-summary]
key-files:
  created:
    - scripts/lib/release-ops/nightly-deploy.ts
    - scripts/lib/release-ops/deploy-context.ts
    - scripts/resolve-deploy-context.ts
  modified:
    - .github/workflows/deploy.yml
    - scripts/deploy-pages-plan.ts
    - scripts/deploy-pages-plan.test.ts
    - scripts/lib/deploy/pages-summary.ts
    - README.md
key-decisions:
  - "Made `config/upstream-open-links.json` a deploy-relevant input so upstream sync commits naturally trigger the normal push deploy path."
  - "Kept deployment centralized in `deploy.yml` by adding schedule-aware context resolution instead of creating a second Pages workflow."
  - "Made non-push deploys full-build backstop runs while preserving push-only changed-path optimization."
patterns-established:
  - "Pinned-upstream builds: every deploy run resolves and checks out the exact upstream commit recorded in source control."
  - "Nightly backstop mode: scheduled deploys rebuild current `main`, compare to the live Pages manifest, and no-op or deploy from the same artifact path."
requirements-completed: [DEPL-03]
duration: pending
completed: 2026-03-17
---

# Phase 5 Plan 02: Implement nightly delta detection and deployment orchestration Summary

**Pinned-upstream deploy context plus nightly Pages convergence on the existing deploy path**

## Accomplishments

- Added deploy-context helpers and a small resolver CLI that expose deploy mode plus the pinned upstream commit to GitHub Actions.
- Updated `deploy.yml` to include nightly scheduled runs and to treat `config/upstream-open-links.json` as a build-relevant input.
- Changed deploy checkout behavior so push, manual, and nightly deploy runs all build against the pinned upstream commit instead of floating upstream `main`.
- Extended Pages summaries to include trigger mode and pinned upstream details, and documented the nightly backstop behavior in the README.

## Evidence

- `scripts/lib/release-ops/nightly-deploy.ts`
- `scripts/lib/release-ops/deploy-context.ts`
- `scripts/resolve-deploy-context.ts`
- `.github/workflows/deploy.yml`
- `scripts/lib/deploy/pages-summary.ts`
- `scripts/deploy-pages-plan.ts`
- `scripts/deploy-pages-plan.test.ts`

## Verification

- `bun run scripts/resolve-deploy-context.ts -- --root "$PWD" --event-name schedule --format json`
- `bun test scripts/deploy-pages-plan.test.ts`
- `bun run check`
- `bun run validate`
- `bun run build:site -- --root "$PWD" --public-origin https://example.com/open-links-sites`
- `bun run deploy:pages:plan -- --site-dir generated/site --public-origin https://example.com/open-links-sites --deploy-mode nightly --upstream-commit "<commit>" --upstream-repository pRizz/open-links`

## Next Readiness

`05-03` can now harden both automation paths around one shared release-verification contract, deterministic non-overlap rules, and concise failure summaries.
