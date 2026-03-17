---
phase: 02-guided-operator-crud
plan: 02
subsystem: operator-crud
tags: [crud, create, update, rollback, validation]
requires:
  - phase: 02-guided-operator-crud
    plan: 01
    provides: Stable manage-person skill surface, CLI router, and searchable person registry
provides:
  - Working `create` action with auto-generated ids and optional seed URL capture
  - Task-based `update` action for common profile/site/orchestration edits
  - Rollback-safe mutation session that restores prior state on blocking validation failures
affects: [02-03, phase-3-import]
tech-stack:
  added: []
  patterns: [write-first-validate-later, rollback-safe-mutation-session, task-based-crud]
key-files:
  created:
    - scripts/lib/manage-person/create-person.ts
    - scripts/lib/manage-person/update-person.ts
    - scripts/lib/manage-person/mutation-session.ts
    - scripts/lib/manage-person/update-tasks.ts
  modified:
    - scripts/scaffold-person.ts
    - scripts/lib/manage-person/action-contract.ts
    - scripts/manage-person.ts
    - scripts/manage-person.test.ts
    - README.md
    - .agents/skills/manage-person/SKILL.md
key-decisions:
  - "Kept create on top of the Phase 1 scaffold primitive instead of introducing a second file-writing path."
  - "Made update task-based and narrow-scope so the operator can change common fields without opening raw JSON files."
  - "Validated after writes and restored from snapshots on blocking failures so the repo never stays in a broken intermediate state."
patterns-established:
  - "Create/update summaries should include remediation-friendly warning and suggestion output."
  - "Common CRUD mutations should flow through `runMutationSession` rather than ad hoc writes."
requirements-completed: [OPER-01, OPER-03]
completed: 2026-03-17
---

# Phase 2 Plan 02: Guided create/update CRUD flows Summary

**Create and update now work through one deterministic operator surface with rollback-safe validation**

## Accomplishments
- Implemented `create` so a new person can be scaffolded from only a name, with an optional seed URL persisted into source metadata.
- Implemented task-based `update` actions for common profile, site, and orchestration fields without requiring direct JSON editing.
- Added a shared mutation-session helper that snapshots touched files, reruns validation, and restores the previous state when blocking problems appear.
- Expanded CLI-contract tests to cover auto-generated ids, optional seed URL handling, successful updates, and rollback on validation failure.

## Verification
- `bun test scripts/manage-person.test.ts`
- `bun run typecheck`

## Deviations from Plan

None.

## Next Phase Readiness

`02-03` can build lifecycle metadata and disable/archive flows directly on top of the new rollback-safe CRUD primitives.
