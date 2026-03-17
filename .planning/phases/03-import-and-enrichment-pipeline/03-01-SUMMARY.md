---
phase: 03-import-and-enrichment-pipeline
plan: 01
subsystem: operator-import
tags: [import, intake, merge, bootstrap, operator]
requires:
  - phase: 02-guided-operator-crud
    provides: Explicit `manage-person` action router, mutation sessions, and person registry lookup
provides:
  - `manage-person import` action
  - Linktree-style source intake
  - Manual freeform link-list intake
  - Conservative merge rules for imported profile/link data
affects: [03-02, 03-03, phase-4-build]
tech-stack:
  added: []
  patterns: [explicit-import-action, source-intake-normalization, conservative-import-merge]
key-files:
  created:
    - scripts/lib/import/contracts.ts
    - scripts/lib/import/import-intake.ts
    - scripts/lib/import/linktree-intake.ts
    - scripts/lib/import/manual-link-list.ts
    - scripts/lib/import/merge-imported-person.ts
    - scripts/lib/manage-person/import-person.ts
  modified:
    - scripts/lib/manage-person/action-contract.ts
    - scripts/manage-person.ts
    - scripts/manage-person.test.ts
    - README.md
    - .agents/skills/manage-person/SKILL.md
key-decisions:
  - "Extended `manage-person` instead of creating a second command family so imports stay inside the main operator surface."
  - "Kept the CLI deterministic and pushed prompt-heavy behavior into the repo-local skill."
  - "Treated scaffold placeholders as replaceable blanks while preserving curated non-placeholder data and link order."
patterns-established:
  - "Source-intake pattern: normalize Linktree-style HTML or pasted text into the same import candidate shape."
  - "Conservative merge pattern: fill blanks, replace bootstrap placeholders, append unique links, and skip obvious duplicates."
requirements-completed: [IMPT-01, IMPT-02]
duration: pending
completed: 2026-03-17
---

# Phase 3 Plan 01: Build the initial import pipeline for Linktree-style URLs and manual link input Summary

**Primary `manage-person import` surface with Linktree/manual intake and conservative merge behavior**

## Accomplishments

- Added `manage-person import` as the Phase 3 bootstrap action.
- Added deterministic import intake for Linktree-style source URLs and pasted freeform link lists.
- Added conservative merge rules that preserve curated data, replace scaffold placeholders, preserve source order, and skip duplicate URLs.
- Documented the new operator flow in the repo README and repo-local `manage-person` skill.

## Evidence

- `scripts/lib/manage-person/import-person.ts`
- `scripts/lib/import/import-intake.ts`
- `scripts/lib/import/linktree-intake.ts`
- `scripts/lib/import/manual-link-list.ts`
- `scripts/lib/import/merge-imported-person.ts`
- `scripts/manage-person.test.ts`

## Verification

- `bun test scripts/manage-person.test.ts --filter import-action`
- `bun test scripts/manage-person.test.ts --filter import-merge`

## Next Readiness

`03-02` can now reuse the import action’s stable intake/merge contract to materialize a single-person workspace, invoke upstream `open-links`, and persist cache artifacts back into the repo.
