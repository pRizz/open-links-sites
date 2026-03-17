---
phase: 02-guided-operator-crud
plan: 03
subsystem: operator-lifecycle
tags: [crud, lifecycle, disable, archive, validation]
requires:
  - phase: 02-guided-operator-crud
    plan: 02
    provides: Rollback-safe CRUD mutations and validation-backed post-write summaries
provides:
  - Lifecycle metadata contract for active, disabled, and archived people
  - Working `disable` and `archive` actions with explicit confirmation gating
  - Hidden-by-default archived registry behavior with explicit archive-aware lookup
affects: [phase-3-import, phase-4-build]
tech-stack:
  added: []
  patterns: [metadata-driven-lifecycle, confirmation-gated-state-change, hidden-archive-registry]
key-files:
  created:
    - scripts/lib/manage-person/status-person.ts
  modified:
    - schemas/person.schema.json
    - templates/default/person.json
    - scripts/lib/manage-person/action-contract.ts
    - scripts/lib/manage-person/person-registry.ts
    - scripts/lib/validate-person.ts
    - scripts/manage-person.ts
    - scripts/manage-person.test.ts
    - scripts/validate.test.ts
    - README.md
    - .agents/skills/manage-person/SKILL.md
key-decisions:
  - "Represented disable/archive as lifecycle metadata in `person.json` so source folders stay intact and later automation can reason about state transitions explicitly."
  - "Required one explicit `--confirm` flag for status-changing writes while keeping create/update write-first."
  - "Kept archived people hidden by default at the registry layer instead of scattering archive filtering across callers."
patterns-established:
  - "State-changing CRUD actions should flow through `status-person.ts` and reuse `runMutationSession`."
  - "Lifecycle validation should distinguish semantic state mismatches from generic schema failures."
requirements-completed: [OPER-04]
completed: 2026-03-17
---

# Phase 2 Plan 03: Lifecycle disable/archive flows Summary

**Disable and archive now work as metadata state changes, with archived entries hidden by default**

## Accomplishments
- Added lifecycle metadata to `person.json` and default templates so active, disabled, and archived states have an explicit contract.
- Extended validation with lifecycle-specific semantic checks for enabled/status consistency and required timestamps.
- Implemented `disable` and `archive` actions with one explicit confirmation gate and rollback-safe metadata writes.
- Added regression coverage for lifecycle schema defaults, confirmation gating, disable semantics, and hidden-by-default archived lookup behavior.

## Verification
- `bun test scripts/manage-person.test.ts --filter lifecycle-schema`
- `bun test scripts/manage-person.test.ts --filter lifecycle-actions`
- `bun run typecheck`
- `bun run validate`

## Deviations from Plan

None.

## Next Phase Readiness

Phase 3 can now assume one stable repo-local CRUD surface for create, update, disable, and archive flows while layering import and enrichment work on top.
