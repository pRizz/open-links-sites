---
phase: 03-import-and-enrichment-pipeline
plan: 02
subsystem: upstream-bridge
tags: [upstream, enrichment, cache, materialize, bridge]
requires:
  - phase: 03-import-and-enrichment-pipeline
    plan: 01
    provides: Stable imported source writes and deterministic import action routing
provides:
  - Per-person cache/import helper layout
  - Generated workspace cache projection
  - Upstream `open-links` runner bridge
  - Helper-cache synchronization back into `people/<id>/cache/`
affects: [03-03, phase-4-build, phase-5-automation]
tech-stack:
  added: []
  patterns: [generated-workspace-bridge, helper-cache-layout, upstream-script-runner]
key-files:
  created:
    - scripts/lib/import/cache-layout.ts
    - scripts/lib/import/cache-sync.ts
    - scripts/lib/import/upstream-open-links-runner.ts
  modified:
    - scripts/lib/person-contract.ts
    - scripts/lib/materialize-person.ts
    - scripts/materialize-person.test.ts
    - scripts/lib/manage-person/import-person.ts
key-decisions:
  - "Kept the upstream boundary thin by invoking upstream script files against `generated/<id>/` instead of reimplementing enrichment locally."
  - "Persisted stable helper artifacts per person under `cache/` and `imports/` without expanding the canonical required source contract."
  - "Made incremental reruns the default by replaying helper artifacts into the generated workspace, with `--full-refresh` clearing refreshable caches first."
patterns-established:
  - "Generated-workspace bridge: source-of-truth lives under `people/<id>/`, while upstream tooling runs only against `generated/<id>/`."
  - "Helper-cache sync: stable upstream outputs are mirrored back into per-person helper paths after each run."
requirements-completed: [IMPT-03, IMPT-04]
duration: pending
completed: 2026-03-17
---

# Phase 3 Plan 02: Integrate upstream `open-links` extraction and caching for person-level enrichment Summary

**Materialized workspace bridge into upstream `open-links`, with per-person helper-cache persistence**

## Accomplishments

- Defined the per-person helper layout under `people/<id>/cache/` and `people/<id>/imports/`.
- Extended materialization so generated single-person workspaces replay helper cache artifacts into the exact upstream `data/` and `public/` paths the upstream scripts expect.
- Added a thin upstream runner that executes enrichment, avatar sync, content-image sync, public-rich sync, and validation against `generated/<id>/`.
- Synced stable workspace artifacts back into per-person helper paths after each import/enrichment run.

## Evidence

- `scripts/lib/import/cache-layout.ts`
- `scripts/lib/import/cache-sync.ts`
- `scripts/lib/import/upstream-open-links-runner.ts`
- `scripts/lib/materialize-person.ts`
- `scripts/materialize-person.test.ts`
- `scripts/manage-person.test.ts`

## Verification

- `bun test scripts/materialize-person.test.ts --filter import-cache-layout`
- `bun test scripts/manage-person.test.ts --filter enrichment-bridge`

## Next Readiness

`03-03` can now turn stage results, skipped upstream work, and blocking upstream failures into durable reports and concise operator-facing summaries.
