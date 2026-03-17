---
phase: 03-import-and-enrichment-pipeline
plan: 03
subsystem: import-observability
tags: [reporting, remediation, validation, partial-success, observability]
requires:
  - phase: 03-import-and-enrichment-pipeline
    plan: 01
    provides: Stable import intake and conservative source writes
  - phase: 03-import-and-enrichment-pipeline
    plan: 02
    provides: Upstream runner bridge and per-person cache synchronization
provides:
  - Stage-aware import reports
  - Concise operator-facing import summaries
  - Partial-success handling with retained source data
  - Validation coverage for helper artifacts
affects: [phase-4-build, phase-5-automation]
tech-stack:
  added: []
  patterns: [stage-aware-import-report, partial-success-retention, remediation-first-summary]
key-files:
  created:
    - scripts/lib/import/import-run-report.ts
    - scripts/lib/import/import-summary.ts
  modified:
    - scripts/lib/manage-person/import-person.ts
    - scripts/manage-person.test.ts
    - scripts/validate.test.ts
    - README.md
    - .agents/skills/manage-person/SKILL.md
key-decisions:
  - "Represented source write, upstream work, and cache sync as separate report stages so failures stay attributable."
  - "Kept useful source data when upstream enrichment fails later, but returned a nonzero exit code for blocking upstream failures."
  - "Surfaced skipped upstream work and rerun guidance directly in the operator summary instead of hiding it behind raw logs."
patterns-established:
  - "Partial-success import pattern: retain useful source writes, persist a report, and tell the operator exactly what to rerun."
  - "Helper-artifact validation pattern: `cache/` and `imports/` remain outside the canonical required contract while still coexisting under each person."
requirements-completed: [IMPT-01, IMPT-02, IMPT-03, IMPT-04]
duration: pending
completed: 2026-03-17
---

# Phase 3 Plan 03: Add observability and failure handling for crawl, extract, and cache steps Summary

**Stage-aware import reporting, concise summaries, and retained partial success after upstream failure**

## Accomplishments

- Added machine-readable per-person import reports under `people/<id>/imports/last-import.json`.
- Added concise operator summaries that call out applied imports, skipped duplicates, skipped upstream work, blocking failures, and rerun guidance.
- Kept imported source data in place when later upstream enrichment fails, instead of rolling the whole import back.
- Added validation coverage proving helper artifacts do not weaken the canonical source contract.

## Evidence

- `scripts/lib/import/import-run-report.ts`
- `scripts/lib/import/import-summary.ts`
- `scripts/lib/manage-person/import-person.ts`
- `scripts/manage-person.test.ts`
- `scripts/validate.test.ts`

## Verification

- `bun test scripts/manage-person.test.ts --filter import-report`
- `bun test scripts/manage-person.test.ts --filter import-summary`
- `bun test scripts/validate.test.ts --filter helpers`

## Next Readiness

Phase 4 can now build on a stable imported/enriched person contract with durable helper artifacts and clear failure evidence for CI or nightly automation flows.
