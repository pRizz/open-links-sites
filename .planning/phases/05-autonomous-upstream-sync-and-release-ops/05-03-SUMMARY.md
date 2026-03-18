---
phase: 05-autonomous-upstream-sync-and-release-ops
plan: 03
subsystem: release-ops-hardening
tags: [release, verification, smoke-checks, summaries, concurrency]
requires:
  - phase: 05-autonomous-upstream-sync-and-release-ops
    plan: 01
    provides: Daily upstream sync workflow and pinned upstream state
  - phase: 05-autonomous-upstream-sync-and-release-ops
    plan: 02
    provides: Nightly deploy backstop and pinned-upstream deploy context
provides:
  - Shared `release:verify` gate for sync and deploy workflows
  - Lightweight smoke checks for Pages-ready output
  - Consistent stage-based workflow summaries and non-overlap guardrails
affects: [phase-verification, milestone-audit]
tech-stack:
  added: []
  patterns: [shared-release-gate, lightweight-smoke-checks, release-main-concurrency]
key-files:
  created:
    - scripts/lib/release-ops/release-verify.ts
    - scripts/lib/release-ops/smoke-check.ts
    - scripts/lib/release-ops/workflow-summary.ts
    - scripts/release-verify.ts
    - scripts/release-verify.test.ts
  modified:
    - scripts/lib/release-ops/upstream-sync.ts
    - package.json
    - .github/workflows/upstream-sync.yml
    - .github/workflows/deploy.yml
    - README.md
key-decisions:
  - "Used one shared `release:verify` entrypoint in both workflows so 'releasable' means the same thing before a sync push and before a Pages deploy."
  - "Kept smoke checks lightweight and artifact-focused: root output, deploy-manifest presence, landing assets, and one representative person route."
  - "Moved sync and deploy workflows onto one `release-main` concurrency group so relevant automation cannot overlap unpredictably."
patterns-established:
  - "Shared release gate: combine check, validate, build, Pages planning, and smoke checks under one CLI and summary format."
  - "Fix-forward release ops: failures stop before publish, upload diagnostics, and rely on rerun or forward fixes instead of rollback."
requirements-completed: [AUTO-02, DEPL-03]
duration: pending
completed: 2026-03-17
---

# Phase 5 Plan 03: Harden fail-fast reporting, rollback expectations, and operational checks Summary

**One shared release gate, lightweight smoke checks, and deterministic workflow guardrails**

## Accomplishments

- Added the shared `release:verify` entrypoint and library that both sync and deploy workflows now call.
- Added lightweight smoke checks over the Pages-ready artifact and representative route output.
- Standardized workflow summaries around explicit stages and failure remediation targets.
- Moved the release-critical workflows onto the same concurrency group and documented the fix-forward operational posture.

## Evidence

- `scripts/lib/release-ops/release-verify.ts`
- `scripts/lib/release-ops/smoke-check.ts`
- `scripts/lib/release-ops/workflow-summary.ts`
- `scripts/release-verify.ts`
- `scripts/release-verify.test.ts`
- `.github/workflows/upstream-sync.yml`
- `.github/workflows/deploy.yml`

## Verification

- `bun test scripts/release-verify.test.ts`
- `bun run check`
- `bun run validate`
- `bun run release:verify -- --root "$PWD" --public-origin https://example.com/open-links-sites --event-name schedule`

## Next Readiness

Phase 5 is ready for phase-level verification and milestone closeout. The remaining work is documentation/state completion plus any milestone audit the operator wants to run next.
