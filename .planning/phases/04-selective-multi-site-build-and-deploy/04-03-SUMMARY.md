---
phase: 04-selective-multi-site-build-and-deploy
plan: 03
subsystem: pages-deploy
tags: [deploy, manifest, github-actions, pages, summaries]
requires:
  - phase: 04-selective-multi-site-build-and-deploy
    plan: 01
    provides: Pages-ready merged site output under `generated/site/`
  - phase: 04-selective-multi-site-build-and-deploy
    plan: 02
    provides: Deterministic full vs selective build selection
provides:
  - Pages artifact finalization
  - Manifest-based no-op deployment planning
  - Centralized GitHub Actions Pages workflow
  - Concise build/deploy summaries
affects: [phase-5-automation]
tech-stack:
  added: []
  patterns: [deploy-manifest-diff, pages-noop-plan, upstream-checkout-in-ci]
key-files:
  created:
    - scripts/lib/deploy/pages-artifact.ts
    - scripts/lib/deploy/pages-plan.ts
    - scripts/lib/deploy/pages-summary.ts
    - scripts/deploy-pages-plan.ts
    - scripts/deploy-pages-plan.test.ts
    - .github/workflows/deploy.yml
  modified:
    - package.json
    - README.md
key-decisions:
  - "Finalized the merged site locally with `.nojekyll` and `deploy-manifest.json` before any deploy decision."
  - "Kept Pages deploy planning local and manifest-driven so no-op deploys can be skipped cleanly."
  - "Made CI check out upstream `open-links` as a sibling repo, install both repos' dependencies, and run the orchestrator from this repo only."
patterns-established:
  - "Pages no-op pattern: compare the new artifact manifest to the live manifest before uploading a deployment artifact."
  - "Centralized CI pattern: build and deploy from one repo while treating upstream as a checked-out renderer dependency."
requirements-completed: [DEPL-01, DEPL-02]
duration: pending
completed: 2026-03-17
---

# Phase 4 Plan 03: Wire centralized GitHub Pages deployment for generated path-based sites Summary

**Pages artifact finalization, manifest diff planning, and centralized GitHub Actions deployment**

## Accomplishments

- Added Pages artifact finalization helpers that write `.nojekyll` and `deploy-manifest.json` for `generated/site/`.
- Added `deploy:pages:plan` to compare the local merged site to the live Pages manifest and report changed vs no-op.
- Added a centralized GitHub Actions workflow that checks out both repos, installs dependencies, builds selectively or fully, plans the Pages deploy, and uploads/deploys only when changed.
- Added concise build/deploy summary helpers and tests for remote-manifest no-op behavior.

## Evidence

- `scripts/lib/deploy/pages-artifact.ts`
- `scripts/lib/deploy/pages-plan.ts`
- `scripts/lib/deploy/pages-summary.ts`
- `scripts/deploy-pages-plan.ts`
- `scripts/deploy-pages-plan.test.ts`
- `.github/workflows/deploy.yml`

## Verification

- `bun test scripts/deploy-pages-plan.test.ts`
- `bun run deploy:pages:plan -- --site-dir <site-dir> --public-origin <origin>`
- `bun run build:site -- --root <temp-root>`

## Next Readiness

Phase 5 can now layer daily upstream sync and nightly deploy automation on top of a stable, selective, manifest-driven build and Pages deployment flow.
